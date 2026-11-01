import { NextResponse } from 'next/server';
import { logRouteError, requireStore } from '@/lib/api';
import { checkRateLimit, getIp, rateLimitResponse } from '@/lib/ratelimit';
import { getSecretMetadata, revealSecret, type ClosedReason } from '@/lib/store';

function closedResponse(state: { state: 'missing' } | { state: 'closed'; reason: ClosedReason }) {
  if (state.state === 'missing') return NextResponse.json({ error: 'Secret not found' }, { status: 404 });
  if (state.reason === 'expired') return NextResponse.json({ error: 'Secret has expired' }, { status: 410 });
  return NextResponse.json({ error: 'Secret already opened or destroyed' }, { status: 410 });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!checkRateLimit(`retrieve:${getIp(request)}`, 20, 60_000)) {
    return rateLimitResponse();
  }

  try {
    const configError = requireStore();
    if (configError) return configError;

    const secret = await getSecretMetadata(id);
    if (secret.state !== 'active') return closedResponse(secret);

    return NextResponse.json({
      passphraseRequired: secret.passphraseRequired,
      passphraseSalt: secret.passphraseSalt,
      note: secret.note,
    });
  } catch (error) {
    logRouteError(`GET /api/retrieve/${id}`, error);
    return NextResponse.json({ error: 'Unable to check secret' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const configError = requireStore();
    if (configError) {
      return configError;
    }

    const body = (await request.json().catch(() => ({}))) as {
      passphraseVerifier?: string;
    };
    const verifier = typeof body?.passphraseVerifier === 'string' && body.passphraseVerifier
      && body.passphraseVerifier.length <= 128 ? body.passphraseVerifier : null;

    const result = await revealSecret(id, verifier);

    switch (result.state) {
      case 'missing':
      case 'closed':
        return closedResponse(result);
      case 'locked':
        return NextResponse.json({ error: 'Too many incorrect passphrase attempts. This secret is locked.' }, { status: 403 });
      case 'proof_required':
        return NextResponse.json({ error: 'Passphrase proof is required' }, { status: 400 });
      case 'wrong':
        return NextResponse.json({
          error: result.remaining > 0
            ? `Incorrect passphrase. ${result.remaining} attempt${result.remaining === 1 ? '' : 's'} remaining.`
            : 'Incorrect passphrase. This secret is now locked.',
        }, { status: 403 });
    }

    return NextResponse.json(
      { ...result.payload, openedAt: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    logRouteError(`POST /api/retrieve/${id}`, error);
    return NextResponse.json({ error: 'Unable to retrieve secret' }, { status: 500 });
  }
}
