import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { logRouteError, requireDatabaseUrl } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getIp, rateLimitResponse } from '@/lib/ratelimit';
import { isExpired } from '@/lib/utils';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!checkRateLimit(`retrieve:${getIp(request)}`, 20, 60_000)) {
    return rateLimitResponse();
  }

  try {
    const databaseConfigError = requireDatabaseUrl();
    if (databaseConfigError) return databaseConfigError;

    const secret = await prisma.secret.findUnique({
      where: { id },
      select: { status: true, expiresAt: true, passphraseRequired: true, passphraseSalt: true, note: true },
    });

    if (!secret) return NextResponse.json({ error: 'Secret not found' }, { status: 404 });
    if (secret.status !== 'ACTIVE') return NextResponse.json({ error: 'Secret already opened or destroyed' }, { status: 410 });
    if (isExpired(secret.expiresAt)) return NextResponse.json({ error: 'Secret has expired' }, { status: 410 });

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
    const databaseConfigError = requireDatabaseUrl();
    if (databaseConfigError) {
      return databaseConfigError;
    }

    const body = (await request.json().catch(() => ({}))) as {
      passphraseVerifier?: string;
    };

    // Pre-flight: read and validate without burning. This is not the atomic
    // step — it is only used for early rejection (not found, expired, wrong
    // passphrase). The actual burn is the atomic updateMany below.
    const secret = await prisma.secret.findUnique({ where: { id } });
    if (!secret) return NextResponse.json({ error: 'Secret not found' }, { status: 404 });
    if (secret.status !== 'ACTIVE') return NextResponse.json({ error: 'Secret already opened or destroyed' }, { status: 410 });
    if (isExpired(secret.expiresAt)) {
      await prisma.secret.updateMany({ where: { id, status: 'ACTIVE' }, data: { status: 'EXPIRED', destroyedAt: new Date() } });
      return NextResponse.json({ error: 'Secret has expired' }, { status: 410 });
    }

    const MAX_PASSPHRASE_ATTEMPTS = 5;

    if (secret.passphraseRequired) {
      if (!secret.passphraseSalt || !secret.passphraseVerifier) {
        return NextResponse.json({ error: 'This secret is missing passphrase verification data. Ask the sender to create a new secret.' }, { status: 409 });
      }
      if (secret.passphraseAttempts >= MAX_PASSPHRASE_ATTEMPTS) {
        return NextResponse.json({ error: 'Too many incorrect passphrase attempts. This secret is locked.' }, { status: 403 });
      }
      if (!body.passphraseVerifier) {
        return NextResponse.json({ error: 'Passphrase proof is required' }, { status: 400 });
      }
      const expected = Buffer.from(secret.passphraseVerifier, 'base64');
      const actual = Buffer.from(body.passphraseVerifier, 'base64');
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
        // Increment atomically — don't await the result to avoid leaking timing info
        void prisma.secret.update({
          where: { id },
          data: { passphraseAttempts: { increment: 1 } },
        });
        const remaining = MAX_PASSPHRASE_ATTEMPTS - secret.passphraseAttempts - 1;
        const msg = remaining > 0
          ? `Incorrect passphrase. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          : 'Incorrect passphrase. This secret is now locked.';
        return NextResponse.json({ error: msg }, { status: 403 });
      }
    }

    // Atomic burn: only one concurrent request can transition ACTIVE → OPENED.
    // If count === 0, another request won the race between our pre-flight read
    // and this update — treat it as already consumed.
    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
      const burned = await tx.secret.updateMany({
        where: { id, status: 'ACTIVE', expiresAt: { gt: now } },
        data: { status: 'OPENED', openedAt: now, destroyedAt: now },
      });

      if (burned.count === 0) {
        return { error: 'Secret already opened or destroyed', status: 410 as const };
      }

      if (secret.requestId) {
        await tx.secretRequest.update({
          where: { id: secret.requestId },
          data: { status: 'OPENED', openedAt: now, destroyedAt: now },
        });
      }

      return {
        status: 200 as const,
        payload: {
          ciphertext: secret.ciphertext,
          iv: secret.iv,
          passphraseRequired: secret.passphraseRequired,
          passphraseSalt: secret.passphraseSalt,
          note: secret.note,
          openedAt: now.toISOString(),
        },
      };
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.payload);
  } catch (error) {
    logRouteError(`POST /api/retrieve/${id}`, error);
    return NextResponse.json({ error: 'Unable to retrieve secret' }, { status: 500 });
  }
}
