import { NextRequest, NextResponse } from 'next/server';
import { logRouteError, requireDatabaseUrl } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { addHours, createToken, getBaseUrl, sanitizeNote } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const databaseConfigError = requireDatabaseUrl();
    if (databaseConfigError) {
      return databaseConfigError;
    }

    const body = (await request.json()) as { label?: string; note?: string; ttlHours?: number };
    const label = body.label?.trim();
    if (!label) {
      return NextResponse.json({ error: 'label is required' }, { status: 400 });
    }

    const ttlHours = [1, 24, 168].includes(Number(body.ttlHours)) ? Number(body.ttlHours) : 24;
    const token = createToken(24);

    await prisma.secretRequest.create({
      data: {
        token,
        label: label.slice(0, 100),
        note: sanitizeNote(body.note),
        expiresAt: addHours(ttlHours),
      },
    });

    return NextResponse.json({ requestUrl: `${getBaseUrl()}/request/${token}` });
  } catch (error) {
    logRouteError('POST /api/requests', error);
    return NextResponse.json({ error: 'Unable to create request link' }, { status: 500 });
  }
}
