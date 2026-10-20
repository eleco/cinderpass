import { NextRequest, NextResponse } from 'next/server';
import { logRouteError } from '@/lib/api';
import { ERASE_SECRET, ERASE_REQUEST } from '@/lib/erasure';
import { prisma } from '@/lib/prisma';

// Called by Vercel Cron. Protected by CRON_SECRET so only the scheduler
// (or an operator) can trigger it.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[cron/prune] Unauthorized request — missing or invalid CRON_SECRET');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  console.log('[cron/prune] Starting prune run', { at: new Date().toISOString() });

  try {
    const now = new Date();

    const [secrets, requests] = await Promise.all([
      prisma.secret.updateMany({
        where: { status: 'ACTIVE', expiresAt: { lte: now } },
        data: { ...ERASE_SECRET, status: 'EXPIRED', destroyedAt: now },
      }),
      prisma.secretRequest.updateMany({
        where: { status: { in: ['OPEN', 'SUBMITTED'] }, expiresAt: { lte: now } },
        data: { ...ERASE_REQUEST, status: 'EXPIRED', destroyedAt: now },
      }),
    ]);

    // Also scrub tombstones written by an older app instance during a rolling
    // deployment, or reintroduced by restoring a pre-upgrade backup.
    await Promise.all([
      prisma.secret.updateMany({
        where: { status: { not: 'ACTIVE' }, OR: [
          { ciphertext: { not: '' } }, { iv: { not: '' } }, { note: { not: null } },
          { passphraseSalt: { not: null } }, { passphraseVerifier: { not: null } }, { destroyToken: { not: null } },
        ] },
        data: ERASE_SECRET,
      }),
      prisma.secretRequest.updateMany({
        where: { status: { in: ['OPENED', 'EXPIRED', 'DESTROYED'] }, OR: [{ label: { not: '' } }, { note: { not: null } }] },
        data: ERASE_REQUEST,
      }),
    ]);

    const durationMs = Date.now() - startedAt;
    console.log('[cron/prune] Prune complete', {
      secrets: secrets.count,
      requests: requests.count,
      durationMs,
      at: now.toISOString(),
    });

    return NextResponse.json({
      pruned: { secrets: secrets.count, requests: requests.count },
      durationMs,
      at: now.toISOString(),
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    console.error('[cron/prune] Prune failed', { durationMs, error: String(error) });
    logRouteError('GET /api/cron/prune', error);
    return NextResponse.json({ error: 'Prune failed' }, { status: 500 });
  }
}
