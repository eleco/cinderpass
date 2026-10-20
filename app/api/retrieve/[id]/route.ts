import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { logRouteError, requireDatabaseUrl } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getIp, rateLimitResponse } from '@/lib/ratelimit';
import { ERASE_SECRET, ERASE_REQUEST } from '@/lib/erasure';
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
      // Serialize verification, failed-attempt accounting and burn on this row.
      // PostgreSQL holds the lock through commit, including across app instances.
      await tx.$queryRaw`SELECT "id" FROM "Secret" WHERE "id" = ${id} FOR UPDATE`;
      const secret = await tx.secret.findUnique({ where: { id } });
      if (!secret) return { error: 'Secret not found', status: 404 as const };
      if (secret.status !== 'ACTIVE') return { error: 'Secret already opened or destroyed', status: 410 as const };
      if (isExpired(secret.expiresAt)) {
        const now = new Date();
        await tx.secret.update({ where: { id }, data: { ...ERASE_SECRET, status: 'EXPIRED', destroyedAt: now } });
        if (secret.requestId) {
          await tx.secretRequest.update({ where: { id: secret.requestId }, data: { ...ERASE_REQUEST, status: 'EXPIRED', destroyedAt: now } });
        }
        return { error: 'Secret has expired', status: 410 as const };
      }

      const MAX_PASSPHRASE_ATTEMPTS = 5;
      if (secret.passphraseRequired) {
        if (!secret.passphraseSalt || !secret.passphraseVerifier) {
          return { error: 'This secret is missing passphrase verification data. Ask the sender to create a new secret.', status: 409 as const };
        }
        if (secret.passphraseAttempts >= MAX_PASSPHRASE_ATTEMPTS) {
          return { error: 'Too many incorrect passphrase attempts. This secret is locked.', status: 403 as const };
        }
        if (typeof body?.passphraseVerifier !== 'string' || !body.passphraseVerifier || body.passphraseVerifier.length > 128) {
          return { error: 'Passphrase proof is required', status: 400 as const };
        }
        const expected = Buffer.from(secret.passphraseVerifier, 'base64');
        const actual = Buffer.from(body.passphraseVerifier, 'base64');
        if (expected.length === 0 || expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
          const updated = await tx.secret.update({
            where: { id }, data: { passphraseAttempts: { increment: 1 } }, select: { passphraseAttempts: true },
          });
          const remaining = MAX_PASSPHRASE_ATTEMPTS - updated.passphraseAttempts;
          return {
            error: remaining > 0
              ? `Incorrect passphrase. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
              : 'Incorrect passphrase. This secret is now locked.',
            status: 403 as const,
          };
        }
      }

      const now = new Date();
      const burned = await tx.secret.updateMany({
        where: { id, status: 'ACTIVE', expiresAt: { gt: now } },
        data: { ...ERASE_SECRET, status: 'OPENED', openedAt: now, destroyedAt: now },
      });
      if (burned.count === 0) return { error: 'Secret already opened or destroyed', status: 410 as const };
      if (secret.requestId) {
        await tx.secretRequest.update({
          where: { id: secret.requestId },
          data: { ...ERASE_REQUEST, status: 'OPENED', openedAt: now, destroyedAt: now },
        });
      }
      // Only the winning transaction returns its pre-erasure snapshot.
      return {
        status: 200 as const,
        payload: {
          ciphertext: secret.ciphertext, iv: secret.iv,
          passphraseRequired: secret.passphraseRequired, passphraseSalt: secret.passphraseSalt,
          note: secret.note, openedAt: now.toISOString(),
        },
      };
    }, { isolationLevel: 'ReadCommitted' });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.payload, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    logRouteError(`POST /api/retrieve/${id}`, error);
    return NextResponse.json({ error: 'Unable to retrieve secret' }, { status: 500 });
  }
}
