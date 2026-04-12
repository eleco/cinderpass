import { describe, it, expect, vi, afterEach } from 'vitest';
import { isExpired, addHours, sanitizeNote, createToken, getBaseUrl } from '@/lib/utils';

afterEach(() => {
  vi.useRealTimers();
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

  it('extracts origin from request URL when env not set', () => {
    const original = process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;

    const req = new Request('https://cinderpass.com/api/secrets');
    expect(getBaseUrl(req)).toBe('https://cinderpass.com');

    process.env.NEXT_PUBLIC_APP_URL = original;
  });
});
