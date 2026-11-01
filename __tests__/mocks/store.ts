import { vi } from 'vitest';

// Route tests cover HTTP behaviour; the store's scripts run against Redis in __tests__/integration.
export const storeMock = {
  MAX_PASSPHRASE_ATTEMPTS: 5,
  createSecret: vi.fn(),
  getSecretMetadata: vi.fn(),
  revealSecret: vi.fn(),
  destroySecret: vi.fn(),
  createRequest: vi.fn(),
  getRequest: vi.fn(),
  submitToRequest: vi.fn(),
};

export const ratelimitMock = {
  checkRateLimit: vi.fn(() => true),
  getIp: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn(() => new Response(JSON.stringify({ error: 'rate limited' }), { status: 429 })),
};
