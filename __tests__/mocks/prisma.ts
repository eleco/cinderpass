import { vi } from 'vitest';

// Unit-test transaction adapter. Real locking is covered by PostgreSQL integration tests.
function makeTxMock(client: ReturnType<typeof makePrismaMock>) {
  return vi.fn(async (fn: (tx: typeof client) => Promise<unknown>) => fn(client));
}

export function makePrismaMock() {
  const client = {
    secret: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    secretRequest: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
    $transaction: null as unknown as ReturnType<typeof vi.fn>,
  };
  client.$transaction = makeTxMock(client);
  return client;
}

// Single shared instance reset between tests via beforeEach in each test file.
export const prismaMock = makePrismaMock();
