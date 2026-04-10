import { NextResponse } from 'next/server';
import { logRouteError, requireDatabaseUrl } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { isExpired } from '@/lib/utils';

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const databaseConfigError = requireDatabaseUrl();
    if (databaseConfigError) {
      return databaseConfigError;
    }

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
