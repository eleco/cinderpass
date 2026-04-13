import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/ratelimit', () => ({
  checkRateLimit: vi.fn(() => true),
  getIp: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn(() => new Response(JSON.stringify({ error: 'rate limited' }), { status: 429 })),
}));

import { POST as contact } from '@/app/api/contact/route';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  process.env.MAILGUN_API_KEY = 'key-test';
  process.env.MAILGUN_DOMAIN = 'mg.cinderpass.com';
  process.env.MAILGUN_FROM_EMAIL = 'Cinderpass <contact@mg.cinderpass.com>';
  process.env.MAILGUN_API_BASE_URL = 'https://api.mailgun.net';
});

describe('POST /api/contact', () => {
  it('sends the message through Mailgun', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: 'queued' }), { status: 200 }));

    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        referer: 'https://cinderpass.com/',
      },
      body: JSON.stringify({ name: 'Eric', message: 'Hello from the contact form.' }),
    });

    const res = await contact(req as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.sent).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.mailgun.net/v3/mg.cinderpass.com/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: expect.stringMatching(/^Basic /),
        }),
      }),
    );
  });

  it('returns 400 when name is missing', async () => {
    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Hello' }),
    });

    const res = await contact(req as never);
    expect(res.status).toBe(400);
  });

  it('returns 400 when message is missing', async () => {
    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Eric' }),
    });

    const res = await contact(req as never);
    expect(res.status).toBe(400);
  });

  it('returns 503 when Mailgun is not configured', async () => {
    delete process.env.MAILGUN_API_KEY;

    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Eric', message: 'Hello' }),
    });

    const res = await contact(req as never);
    const data = await res.json();

    expect(res.status).toBe(503);
    expect(data.error).toContain('not configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
