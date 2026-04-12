import { NextRequest, NextResponse } from 'next/server';
import { logRouteError, requireDatabaseUrl, validateCiphertextPayload } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { getBaseUrl, isExpired, sanitizeNote } from '@/lib/utils';

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  try {
    const databaseConfigError = requireDatabaseUrl();
    if (databaseConfigError) {
      return databaseConfigError;
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

    const requestRow = await prisma.secretRequest.findUnique({ where: { token } });
    if (!requestRow) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }
    if (requestRow.status !== 'OPEN' || isExpired(requestRow.expiresAt)) {
      return NextResponse.json({ error: 'Request is closed' }, { status: 410 });
    }

    const created = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const requestLatest = await tx.secretRequest.findUnique({ where: { token } });
      if (!requestLatest || requestLatest.status !== 'OPEN' || isExpired(requestLatest.expiresAt)) {
        throw new Error('Request is closed');
      }

      const secret = await tx.secret.create({
        data: {
          ciphertext,
          iv,
          note: sanitizeNote(body.note) || requestLatest.label,
          expiresAt: requestLatest.expiresAt,
          passphraseRequired: Boolean(body.passphraseRequired),
          passphraseSalt: body.passphraseSalt ?? null,
          passphraseVerifier: body.passphraseVerifier ?? null,
          source: 'request',
          requestId: requestLatest.id,
        },
        select: { id: true },
      });

      await tx.secretRequest.update({
        where: { id: requestLatest.id },
        data: { status: 'SUBMITTED', submittedAt: now },
      });

      return secret;
    });

    return NextResponse.json({ revealUrl: `${getBaseUrl(request)}/secret/${created.id}` });
  } catch (error) {
    logRouteError(`POST /api/requests/${token}/submit`, error);
    const message = error instanceof Error ? error.message : 'Unable to submit secret';
    const status = message === 'Request is closed' ? 410 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
