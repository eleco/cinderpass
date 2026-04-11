import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { logRouteError, requireDatabaseUrl } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getIp, rateLimitResponse } from '@/lib/ratelimit';
import { addHours, getBaseUrl, sanitizeNote } from '@/lib/utils';

export async function POST(request: NextRequest) {
  if (!checkRateLimit(`secrets:${getIp(request)}`, 10, 60_000)) {
    return rateLimitResponse();
  }

  try {
    const databaseConfigError = requireDatabaseUrl();
    if (databaseConfigError) {
      return databaseConfigError;
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

    if (!body.ciphertext || !body.iv) {
      return NextResponse.json({ error: 'ciphertext and iv are required' }, { status: 400 });
    }

    if (body.passphraseRequired && (!body.passphraseSalt || !body.passphraseVerifier)) {
      return NextResponse.json({ error: 'passphrase proof is required' }, { status: 400 });
    }

    const ttlHours = [1, 24, 168].includes(Number(body.ttlHours)) ? Number(body.ttlHours) : 24;
    const destroyToken = randomBytes(32).toString('hex');

    const secret = await prisma.secret.create({
      data: {
        ciphertext: body.ciphertext,
        iv: body.iv,
        expiresAt: addHours(ttlHours),
        note: sanitizeNote(body.note),
        passphraseRequired: Boolean(body.passphraseRequired),
        passphraseSalt: body.passphraseSalt ?? null,
        passphraseVerifier: body.passphraseVerifier ?? null,
        destroyToken,
        source: 'direct',
      },
      select: { id: true },
    });

    return NextResponse.json({
      url: `${getBaseUrl(request)}/secret/${secret.id}`,
      id: secret.id,
      destroyToken,
    });
  } catch (error) {
    logRouteError('POST /api/secrets', error);
    return NextResponse.json({ error: 'Unable to create secret' }, { status: 500 });
  }
}
