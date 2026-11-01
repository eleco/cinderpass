import { NextRequest, NextResponse } from 'next/server';
import { logRouteError, requireStore, validateCiphertextPayload } from '@/lib/api';
import { submitToRequest } from '@/lib/store';
import { getBaseUrl, sanitizeNote } from '@/lib/utils';

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  try {
    const configError = requireStore();
    if (configError) {
      return configError;
    }

    const body = (await request.json()) as {
      ciphertext?: string;
      iv?: string;
      note?: string;
      passphraseRequired?: boolean;
      passphraseSalt?: string;
      passphraseVerifier?: string;
    };

    const payloadError = validateCiphertextPayload(body.ciphertext, body.iv);
    if (payloadError) {
      return NextResponse.json({ error: payloadError }, { status: 400 });
    }

    if (body.passphraseRequired && (!body.passphraseSalt || !body.passphraseVerifier)) {
      return NextResponse.json({ error: 'passphrase proof is required' }, { status: 400 });
    }

    const { ciphertext, iv } = body as { ciphertext: string; iv: string };

    const result = await submitToRequest(token, {
      ciphertext,
      iv,
      note: sanitizeNote(body.note),
      passphraseRequired: Boolean(body.passphraseRequired),
      passphraseSalt: body.passphraseSalt ?? null,
      passphraseVerifier: body.passphraseVerifier ?? null,
    });

    if (result.state === 'missing') {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }
    if (result.state === 'closed') {
      return NextResponse.json({ error: 'Request is closed' }, { status: 410 });
    }

    return NextResponse.json({ revealUrl: `${getBaseUrl(request)}/secret/${result.id}` });
  } catch (error) {
    logRouteError(`POST /api/requests/${token}/submit`, error);
    return NextResponse.json({ error: 'Unable to submit secret' }, { status: 500 });
  }
}
