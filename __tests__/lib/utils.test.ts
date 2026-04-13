import { describe, it, expect, vi, afterEach } from 'vitest';
import { isExpired, addHours, sanitizeNote, createToken, getBaseUrl, getConfiguredBaseUrl } from '@/lib/utils';

afterEach(() => {
  vi.useRealTimers();
  delete process.env.APP_URL;
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  delete process.env.VERCEL_URL;
});

describe('isExpired', () => {
  it('returns true for a date in the past', () => {
    const past = new Date(Date.now() - 1000);
    expect(isExpired(past)).toBe(true);
  });

  it('returns false for a date in the future', () => {
    const future = new Date(Date.now() + 10_000);
    expect(isExpired(future)).toBe(false);
  });

  it('returns true for exactly now (boundary is non-inclusive)', () => {
    vi.useFakeTimers();
    const now = new Date();
    vi.setSystemTime(now);
    expect(isExpired(now)).toBe(true);
  });
});

describe('addHours', () => {
  it('returns a date the correct number of milliseconds ahead', () => {
    vi.useFakeTimers();
    const base = new Date('2026-01-01T00:00:00.000Z');
    vi.setSystemTime(base);

    const result = addHours(1);
    expect(result.getTime()).toBe(base.getTime() + 60 * 60 * 1000);
  });

  it('works for 24 hours', () => {
    vi.useFakeTimers();
    const base = new Date('2026-01-01T00:00:00.000Z');
    vi.setSystemTime(base);

    const result = addHours(24);
    expect(result.getTime()).toBe(base.getTime() + 24 * 60 * 60 * 1000);
  });
});

describe('sanitizeNote', () => {
  it('returns null for empty string', () => {
    expect(sanitizeNote('')).toBeNull();
    expect(sanitizeNote('   ')).toBeNull();
  });

  it('returns null for undefined/null', () => {
    expect(sanitizeNote(undefined)).toBeNull();
    expect(sanitizeNote(null)).toBeNull();
  });

  it('trims whitespace', () => {
    expect(sanitizeNote('  hello  ')).toBe('hello');
  });

  it('truncates to 140 characters', () => {
    const long = 'a'.repeat(200);
    expect(sanitizeNote(long)).toHaveLength(140);
  });

  it('preserves strings under 140 characters', () => {
    expect(sanitizeNote('short note')).toBe('short note');
  });
});

describe('createToken', () => {
  it('returns a string', () => {
    expect(typeof createToken()).toBe('string');
  });

  it('returns different values on each call', () => {
    expect(createToken()).not.toBe(createToken());
  });

  it('default length produces a non-empty token', () => {
    expect(createToken().length).toBeGreaterThan(0);
  });
});

describe('getBaseUrl', () => {
  it('returns NEXT_PUBLIC_APP_URL when set', () => {
    expect(getBaseUrl()).toBe('http://localhost:3000');
  });

  it('prefers APP_URL over NEXT_PUBLIC_APP_URL', () => {
    process.env.APP_URL = 'https://burnlink.example.com';
    process.env.NEXT_PUBLIC_APP_URL = 'https://public.example.com';

    expect(getBaseUrl()).toBe('https://burnlink.example.com');
  });

  it('extracts origin from request URL when env not set', () => {
    const originalAppUrl = process.env.APP_URL;
    const original = process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;

    const req = new Request('https://cinderpass.com/api/secrets');
    expect(getBaseUrl(req)).toBe('https://cinderpass.com');

    process.env.APP_URL = originalAppUrl;
    process.env.NEXT_PUBLIC_APP_URL = original;
  });

  it('prefers forwarded host headers over request.url origin', () => {
    delete process.env.APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    delete process.env.VERCEL_URL;

    const req = new Request('http://127.0.0.1:3000/api/secrets', {
      headers: {
        'x-forwarded-host': 'burnlink.example.com',
        'x-forwarded-proto': 'https',
      },
    });

    expect(getBaseUrl(req)).toBe('https://burnlink.example.com');
  });
});

describe('getConfiguredBaseUrl', () => {
  it('uses VERCEL_PROJECT_PRODUCTION_URL when explicit app URLs are not set', () => {
    delete process.env.APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'burnlink.vercel.app';

    expect(getConfiguredBaseUrl()).toBe('https://burnlink.vercel.app');
  });
});
