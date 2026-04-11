import { NextRequest, NextResponse } from 'next/server';
import { logRouteError } from '@/lib/api';
import { prisma } from '@/lib/prisma';

// Called by Vercel Cron. Protected by CRON_SECRET so only the scheduler
// (or an operator) can trigger it.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();

    const [secrets, requests] = await Promise.all([
      prisma.secret.updateMany({
        where: { status: 'ACTIVE', expiresAt: { lt: now } },
        data: { status: 'EXPIRED', destroyedAt: now },
      }),
      prisma.secretRequest.updateMany({
        where: { status: 'OPEN', expiresAt: { lt: now } },
        data: { status: 'EXPIRED', destroyedAt: now },
      }),
    ]);

    return NextResponse.json({
      pruned: { secrets: secrets.count, requests: requests.count },
      at: now.toISOString(),
    });
  } catch (error) {
    logRouteError('GET /api/cron/prune', error);
    return NextResponse.json({ error: 'Prune failed' }, { status: 500 });
  }
}
