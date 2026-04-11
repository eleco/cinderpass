import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { logRouteError, requireDatabaseUrl } from '@/lib/api';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const databaseConfigError = requireDatabaseUrl();
    if (databaseConfigError) return databaseConfigError;

    const body = (await request.json().catch(() => ({}))) as { destroyToken?: string };

    if (!body.destroyToken) {
      return NextResponse.json({ error: 'destroyToken is required' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const secret = await tx.secret.findUnique({
        where: { id },
        select: { id: true, status: true, destroyToken: true, requestId: true },
      });

      if (!secret) return { error: 'Secret not found', status: 404 as const };
      if (secret.status !== 'ACTIVE') return { error: 'Secret already opened or destroyed', status: 410 as const };
      if (!secret.destroyToken) return { error: 'This secret cannot be destroyed via token', status: 409 as const };

      const expected = Buffer.from(secret.destroyToken, 'hex');
      const actual = Buffer.from(body.destroyToken!, 'hex');
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
        return { error: 'Invalid destroy token', status: 403 as const };
      }

      const now = new Date();
      await tx.secret.update({
        where: { id },
        data: { status: 'DESTROYED', destroyedAt: now },
      });

      if (secret.requestId) {
        await tx.secretRequest.update({
          where: { id: secret.requestId },
          data: { status: 'DESTROYED', destroyedAt: now },
        });
      }

      return { status: 200 as const };
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ destroyed: true });
  } catch (error) {
    logRouteError(`POST /api/secrets/${id}/destroy`, error);
    return NextResponse.json({ error: 'Unable to destroy secret' }, { status: 500 });
  }
}
