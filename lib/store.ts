import { createHash } from 'crypto';
import { getRedis } from './redis';
import { createToken } from './utils';

// Storage layout. Every key carries its own expiry, so nothing needs pruning:
//   secret:<id>             hash: ciphertext, iv, note, expiresAt, passphrase salt + verifier hash,
//                           destroy-token hash, failed attempts, request token. Deleted on burn.
//   secret:<id>:closed      why the link no longer works ("expired" | "opened" | "destroyed").
//                           Holds no payload; outlives the secret by CLOSED_NOTICE_MS.
//   request:<token>         hash: label, note, expiresAt, id of the submitted secret.
//   request:<token>:closed  same idea as the secret marker.
// Tokens and passphrase verifiers are stored as SHA-256 hashes and compared inside the scripts,
// so string comparison timing reveals nothing about the stored values.

export const MAX_PASSPHRASE_ATTEMPTS = 5;
export const CLOSED_NOTICE_MS = 24 * 60 * 60 * 1000;

const secretKey = (id: string) => `secret:${id}`;
const requestKey = (token: string) => `request:${token}`;
const closedKey = (key: string) => `${key}:closed`;

export function hashProof(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export type ClosedReason = 'expired' | 'opened' | 'destroyed';
type Missing = { state: 'missing' } | { state: 'closed'; reason: ClosedReason };

export type NewSecret = {
  ciphertext: string;
  iv: string;
  note: string | null;
  expiresAt: Date;
  passphraseRequired: boolean;
  passphraseSalt: string | null;
  passphraseVerifier: string | null;
};

function secretFields(secret: NewSecret) {
  const fields: Record<string, string> = {
    ciphertext: secret.ciphertext,
    iv: secret.iv,
    expiresAt: String(secret.expiresAt.getTime()),
    passphraseRequired: secret.passphraseRequired ? '1' : '0',
  };
  if (secret.note) fields.note = secret.note;
  if (secret.passphraseRequired && secret.passphraseSalt && secret.passphraseVerifier) {
    fields.passphraseSalt = secret.passphraseSalt;
    fields.verifierHash = hashProof(secret.passphraseVerifier);
  }
  return fields;
}

// Without automatic deserialization the SDK returns HMGET's raw reply: values in field order.
async function hmget(key: string, ...fields: string[]) {
  return (await getRedis().hmget(key, ...fields)) as unknown as (string | null)[];
}

async function closedState(key: string): Promise<Missing> {
  const reason = await getRedis().get<string>(closedKey(key));
  return reason ? { state: 'closed', reason: reason as ClosedReason } : { state: 'missing' };
}

export async function createSecret(secret: NewSecret, destroyToken: string) {
  const id = createToken(16);
  const key = secretKey(id);
  const expiresAt = secret.expiresAt.getTime();
  await getRedis().multi()
    .hset(key, { ...secretFields(secret), destroyHash: hashProof(destroyToken.toLowerCase()) })
    .pexpireat(key, expiresAt)
    .set(closedKey(key), 'expired', { pxat: expiresAt + CLOSED_NOTICE_MS })
    .exec();
  return id;
}

export async function getSecretMetadata(id: string) {
  const [expiresAt, passphraseRequired, passphraseSalt, note] = await hmget(
    secretKey(id), 'expiresAt', 'passphraseRequired', 'passphraseSalt', 'note',
  );
  if (!expiresAt) return closedState(secretKey(id));
  if (Number(expiresAt) <= Date.now()) return { state: 'closed', reason: 'expired' } as const;
  return {
    state: 'active',
    passphraseRequired: passphraseRequired === '1',
    passphraseSalt,
    note,
  } as const;
}

const LOAD_SECRET = `
local fields = redis.call('HGETALL', KEYS[1])
if #fields == 0 then
  local reason = redis.call('GET', KEYS[2])
  if reason then return {'closed', reason} end
  return {'missing'}
end
local s = {}
for i = 1, #fields, 2 do s[fields[i]] = fields[i + 1] end
`;

// Verification, failed-attempt accounting and burn run as one script, so concurrent
// retrievals are serialized and only one of them receives the payload.
const REVEAL = `${LOAD_SECRET}
if tonumber(s.expiresAt) <= tonumber(ARGV[1]) then
  redis.call('DEL', KEYS[1])
  return {'closed', 'expired'}
end
if s.passphraseRequired == '1' then
  local max = tonumber(ARGV[3])
  if tonumber(s.attempts or '0') >= max then return {'locked'} end
  if ARGV[2] == '' then return {'proof_required'} end
  if ARGV[2] ~= s.verifierHash then
    return {'wrong', tostring(max - redis.call('HINCRBY', KEYS[1], 'attempts', 1))}
  end
end
redis.call('DEL', KEYS[1])
redis.call('SET', KEYS[2], 'opened', 'PX', ARGV[4])
return {'opened', s.ciphertext, s.iv, s.note or '', s.passphraseRequired, s.passphraseSalt or '', s.requestToken or ''}
`;

const DESTROY = `${LOAD_SECRET}
if not s.destroyHash then return {'no_token'} end
if ARGV[1] ~= s.destroyHash then return {'forbidden'} end
redis.call('DEL', KEYS[1])
redis.call('SET', KEYS[2], 'destroyed', 'PX', ARGV[2])
return {'destroyed', s.requestToken or ''}
`;

function asMissing(result: string[]): Missing | null {
  if (result[0] === 'missing') return { state: 'missing' };
  if (result[0] === 'closed') return { state: 'closed', reason: result[1] as ClosedReason };
  return null;
}

// The request's label and note go with the secret it delivered.
async function closeRequest(token: string, reason: ClosedReason) {
  if (!token) return;
  const key = requestKey(token);
  await getRedis().multi().del(key).set(closedKey(key), reason, { px: CLOSED_NOTICE_MS }).exec();
}

export type RevealResult =
  | Missing
  | { state: 'locked' }
  | { state: 'proof_required' }
  | { state: 'wrong'; remaining: number }
  | {
      state: 'opened';
      payload: { ciphertext: string; iv: string; note: string | null; passphraseRequired: boolean; passphraseSalt: string | null };
    };

export async function revealSecret(id: string, passphraseVerifier: string | null): Promise<RevealResult> {
  const key = secretKey(id);
  const result = await getRedis().eval<string[], string[]>(REVEAL, [key, closedKey(key)], [
    String(Date.now()), passphraseVerifier ? hashProof(passphraseVerifier) : '',
    String(MAX_PASSPHRASE_ATTEMPTS), String(CLOSED_NOTICE_MS),
  ]);
  const missing = asMissing(result);
  if (missing) return missing;
  if (result[0] === 'locked' || result[0] === 'proof_required') return { state: result[0] };
  if (result[0] === 'wrong') return { state: 'wrong', remaining: Number(result[1]) };

  const [, ciphertext, iv, note, passphraseRequired, passphraseSalt, requestToken] = result;
  await closeRequest(requestToken, 'opened');
  return {
    state: 'opened',
    payload: { ciphertext, iv, note: note || null, passphraseRequired: passphraseRequired === '1', passphraseSalt: passphraseSalt || null },
  };
}

export type DestroyResult = Missing | { state: 'no_token' } | { state: 'forbidden' } | { state: 'destroyed' };

export async function destroySecret(id: string, destroyToken: string): Promise<DestroyResult> {
  const key = secretKey(id);
  const result = await getRedis().eval<string[], string[]>(DESTROY, [key, closedKey(key)], [
    hashProof(destroyToken.toLowerCase()), String(CLOSED_NOTICE_MS),
  ]);
  const missing = asMissing(result);
  if (missing) return missing;
  if (result[0] === 'no_token' || result[0] === 'forbidden') return { state: result[0] };
  await closeRequest(result[1], 'destroyed');
  return { state: 'destroyed' };
}

export async function createRequest(request: { label: string; note: string | null; expiresAt: Date }) {
  const token = createToken(24);
  const key = requestKey(token);
  const expiresAt = request.expiresAt.getTime();
  const fields: Record<string, string> = { label: request.label, expiresAt: String(expiresAt) };
  if (request.note) fields.note = request.note;
  await getRedis().multi()
    .hset(key, fields)
    .pexpireat(key, expiresAt)
    .set(closedKey(key), 'expired', { pxat: expiresAt + CLOSED_NOTICE_MS })
    .exec();
  return token;
}

export async function getRequest(token: string) {
  const [label, note, expiresAtMs, secretId] = await hmget(requestKey(token), 'label', 'note', 'expiresAt', 'secretId');
  if (!expiresAtMs) return closedState(requestKey(token));
  const expiresAt = new Date(Number(expiresAtMs));
  return {
    state: secretId || expiresAt.getTime() <= Date.now() ? 'used' : 'open',
    label: label ?? '',
    note,
    expiresAt,
  } as const;
}

// Creates the secret and marks the request as used in one step; a request accepts one secret.
const SUBMIT = `
local r = redis.call('HMGET', KEYS[1], 'label', 'expiresAt', 'secretId')
if not r[2] then
  if redis.call('EXISTS', KEYS[2]) == 1 then return {'closed'} end
  return {'missing'}
end
if r[3] or tonumber(r[2]) <= tonumber(ARGV[1]) then return {'closed'} end
redis.call('HSET', KEYS[1], 'secretId', ARGV[2])
redis.call('HSET', KEYS[3], 'note', r[1], 'expiresAt', r[2], 'requestToken', ARGV[3])
for i = 5, #ARGV, 2 do redis.call('HSET', KEYS[3], ARGV[i], ARGV[i + 1]) end
redis.call('PEXPIREAT', KEYS[3], r[2])
redis.call('SET', KEYS[4], 'expired', 'PXAT', tonumber(r[2]) + tonumber(ARGV[4]))
return {'submitted'}
`;

export async function submitToRequest(token: string, secret: Omit<NewSecret, 'expiresAt'>) {
  const id = createToken(16);
  const fields = secretFields({ ...secret, expiresAt: new Date(0) });
  delete (fields as Partial<typeof fields>).expiresAt;
  const rKey = requestKey(token);
  const sKey = secretKey(id);
  // ARGV[5..] are field/value pairs; a submitted note replaces the default (the request label).
  const [state] = await getRedis().eval<string[], string[]>(SUBMIT, [rKey, closedKey(rKey), sKey, closedKey(sKey)], [
    String(Date.now()), id, token, String(CLOSED_NOTICE_MS), ...Object.entries(fields).flat(),
  ]);
  return state === 'submitted' ? { state, id } as const : { state: state as 'missing' | 'closed' };
}
