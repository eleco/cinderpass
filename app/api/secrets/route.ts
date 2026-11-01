import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { logRouteError, requireStore, validateCiphertextPayload } from '@/lib/api';
import { createSecret } from '@/lib/store';
import { checkRateLimit, getIp, rateLimitResponse } from '@/lib/ratelimit';
import { addHours, getBaseUrl, sanitizeNote } from '@/lib/utils';

export async function POST(request: NextRequest) {
  if (!checkRateLimit(`secrets:${getIp(request)}`, 10, 60_000)) {
    return rateLimitResponse();
  }

  try {
    const configError = requireStore();
    if (configError) {
      return configError;
    }

    const body = (await request.json()) as {
      ciphertext?: string;
      iv?: string;
      ttlHours?: number;
      note?: string;
      passphraseRequired?: boolean;
      passphraseSalt?: string;
      passphraseVerifier?: string;
    };

    const payloadError = validateCiphertextPayload(body.ciphertext, body.iv);
    if (payloadError) {
      return NextResponse.json({ error: payloadError }, { status: 400 });
    }
    const { ciphertext, iv } = body as { ciphertext: string; iv: string };

    if (body.passphraseRequired && (!body.passphraseSalt || !body.passphraseVerifier)) {
      return NextResponse.json({ error: 'passphrase proof is required' }, { status: 400 });
    }

    const ttlHours = [1, 24, 168].includes(Number(body.ttlHours)) ? Number(body.ttlHours) : 24;
    const destroyToken = randomBytes(32).toString('hex');

    const id = await createSecret({
      ciphertext,
      iv,
      expiresAt: addHours(ttlHours),
      note: sanitizeNote(body.note),
      passphraseRequired: Boolean(body.passphraseRequired),
      passphraseSalt: body.passphraseSalt ?? null,
      passphraseVerifier: body.passphraseVerifier ?? null,
    }, destroyToken);

    return NextResponse.json({
      url: `${getBaseUrl(request)}/secret/${id}`,
      id,
      destroyToken,
    });
  } catch (error) {
    logRouteError('POST /api/secrets', error);
    return NextResponse.json({ error: 'Unable to create secret' }, { status: 500 });
  }
}
