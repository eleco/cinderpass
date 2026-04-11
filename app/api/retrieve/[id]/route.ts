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

    const result = await prisma.$transaction(async (tx) => {
      const secret = await tx.secret.findUnique({ where: { id } });
      if (!secret) return { error: 'Secret not found', status: 404 as const };
      if (secret.status !== 'ACTIVE') return { error: 'Secret already opened or destroyed', status: 410 as const };
      if (isExpired(secret.expiresAt)) {
        await tx.secret.update({
          where: { id },
          data: { status: 'EXPIRED', destroyedAt: new Date() },
        });
        return { error: 'Secret has expired', status: 410 as const };
      }
      if (secret.passphraseRequired) {
        if (!secret.passphraseSalt || !secret.passphraseVerifier) {
          return { error: 'This secret is missing passphrase verification data. Ask the sender to create a new secret.', status: 409 as const };
        }
        if (!body.passphraseVerifier) {
          return { error: 'Passphrase proof is required', status: 400 as const };
        }

        const expected = Buffer.from(secret.passphraseVerifier, 'base64');
        const actual = Buffer.from(body.passphraseVerifier, 'base64');
        if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
          return { error: 'Incorrect passphrase', status: 403 as const };
        }
      }

      const now = new Date();
      await tx.secret.update({
        where: { id },
        data: { status: 'OPENED', openedAt: now, destroyedAt: now },
      });

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
