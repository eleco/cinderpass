import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prismaMock } from '../mocks/prisma';

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

import { GET } from '@/app/api/cron/prune/route';

const CRON_SECRET = 'test-cron-secret-xyz';

function makeRequest(authHeader?: string) {
  return new Request('http://localhost/api/cron/prune', {
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = CRON_SECRET;
});

describe('GET /api/cron/prune', () => {
  it('returns 401 when CRON_SECRET env var is not set', async () => {
    delete process.env.CRON_SECRET;

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`) as never);
    expect(res.status).toBe(401);
  });

  it('returns 401 when Authorization header is missing', async () => {
    const res = await GET(makeRequest() as never);
    expect(res.status).toBe(401);
  });

  it('returns 401 for wrong secret', async () => {
    const res = await GET(makeRequest('Bearer wrong-secret') as never);
    expect(res.status).toBe(401);
  });

  it('returns 401 for correct secret without Bearer prefix', async () => {
    const res = await GET(makeRequest(CRON_SECRET) as never);
    expect(res.status).toBe(401);
  });

  it('prunes expired secrets and requests and returns counts', async () => {
    prismaMock.secret.updateMany.mockResolvedValue({ count: 3 });
    prismaMock.secretRequest.updateMany.mockResolvedValue({ count: 1 });

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`) as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.pruned.secrets).toBe(3);
    expect(data.pruned.requests).toBe(1);
    expect(data.at).toBeTruthy();
    expect(data.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('marks expired secrets with status EXPIRED', async () => {
    prismaMock.secret.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.secretRequest.updateMany.mockResolvedValue({ count: 0 });

    await GET(makeRequest(`Bearer ${CRON_SECRET}`) as never);

    expect(prismaMock.secret.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'ACTIVE' }),
        data: expect.objectContaining({ status: 'EXPIRED' }),
      })
    );
  });

  it('marks expired requests with status EXPIRED', async () => {
    prismaMock.secret.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.secretRequest.updateMany.mockResolvedValue({ count: 0 });

    await GET(makeRequest(`Bearer ${CRON_SECRET}`) as never);

    expect(prismaMock.secretRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'OPEN' }),
        data: expect.objectContaining({ status: 'EXPIRED' }),
      })
    );
  });

  it('returns 200 with zero counts when nothing is expired', async () => {
    prismaMock.secret.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.secretRequest.updateMany.mockResolvedValue({ count: 0 });

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`) as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.pruned.secrets).toBe(0);
    expect(data.pruned.requests).toBe(0);
  });
});
