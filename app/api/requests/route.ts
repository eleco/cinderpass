import { NextRequest, NextResponse } from 'next/server';
import { logRouteError, requireStore } from '@/lib/api';
import { createRequest } from '@/lib/store';
import { checkRateLimit, getIp, rateLimitResponse } from '@/lib/ratelimit';
import { addHours, getBaseUrl, sanitizeNote } from '@/lib/utils';

export async function POST(request: NextRequest) {
  if (!checkRateLimit(`requests:${getIp(request)}`, 10, 60_000)) {
    return rateLimitResponse();
  }

  try {
    const configError = requireStore();
    if (configError) {
      return configError;
    }

    const body = (await request.json()) as { label?: string; note?: string; ttlHours?: number };
    const label = body.label?.trim();
    if (!label) {
      return NextResponse.json({ error: 'label is required' }, { status: 400 });
    }

    const ttlHours = [1, 24, 168].includes(Number(body.ttlHours)) ? Number(body.ttlHours) : 24;
    const token = await createRequest({
      label: label.slice(0, 100),
      note: sanitizeNote(body.note),
      expiresAt: addHours(ttlHours),
    });

    return NextResponse.json({ requestUrl: `${getBaseUrl(request)}/request/${token}` });
  } catch (error) {
    logRouteError('POST /api/requests', error);
    return NextResponse.json({ error: 'Unable to create request link' }, { status: 500 });
  }
}
