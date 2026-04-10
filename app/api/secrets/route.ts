import { NextRequest, NextResponse } from 'next/server';
import { logRouteError, requireDatabaseUrl } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { addHours, getBaseUrl, sanitizeNote } from '@/lib/utils';

export async function POST(request: NextRequest) {
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
    };

    if (!body.ciphertext || !body.iv) {
      return NextResponse.json({ error: 'ciphertext and iv are required' }, { status: 400 });
    }

    const ttlHours = [1, 24, 168].includes(Number(body.ttlHours)) ? Number(body.ttlHours) : 24;

    const secret = await prisma.secret.create({
      data: {
        ciphertext: body.ciphertext,
        iv: body.iv,
        expiresAt: addHours(ttlHours),
        note: sanitizeNote(body.note),
        passphraseRequired: Boolean(body.passphraseRequired),
        source: 'direct',
      },
      select: { id: true },
    });

    return NextResponse.json({ url: `${getBaseUrl()}/secret/${secret.id}` });
  } catch (error) {
    logRouteError('POST /api/secrets', error);
    return NextResponse.json({ error: 'Unable to create secret' }, { status: 500 });
  }
}
