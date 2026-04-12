import { describe, it, expect, vi, afterEach } from 'vitest';
import { checkRateLimit, getIp } from '@/lib/ratelimit';

afterEach(() => {
  vi.useRealTimers();
});

describe('checkRateLimit', () => {
  it('allows requests under the limit', () => {
    const key = `test-${Date.now()}-under`;
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(key, 5, 60_000)).toBe(true);
    }
  });

  it('blocks the request that exceeds the limit', () => {
    const key = `test-${Date.now()}-exceed`;
    for (let i = 0; i < 10; i++) checkRateLimit(key, 10, 60_000);
    expect(checkRateLimit(key, 10, 60_000)).toBe(false);
  });

  it('allows requests again after the window expires', () => {
    vi.useFakeTimers();
    const key = `test-${Date.now()}-window`;
    const windowMs = 1000;

    for (let i = 0; i < 3; i++) checkRateLimit(key, 3, windowMs);
    expect(checkRateLimit(key, 3, windowMs)).toBe(false);

    // Advance past the window — all prior timestamps are now stale
    vi.advanceTimersByTime(windowMs + 1);
    expect(checkRateLimit(key, 3, windowMs)).toBe(true);
  });

  it('uses separate counters per key', () => {
    const keyA = `test-${Date.now()}-a`;
    const keyB = `test-${Date.now()}-b`;

    for (let i = 0; i < 3; i++) checkRateLimit(keyA, 3, 60_000);
    expect(checkRateLimit(keyA, 3, 60_000)).toBe(false);
    // Key B is unaffected
    expect(checkRateLimit(keyB, 3, 60_000)).toBe(true);
  });
});

describe('getIp', () => {
  it('extracts IP from x-forwarded-for header', () => {
    const req = new Request('http://localhost/', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    });
    expect(getIp(req)).toBe('1.2.3.4');
  });

  it('falls back to x-real-ip', () => {
    const req = new Request('http://localhost/', {
      headers: { 'x-real-ip': '9.10.11.12' },
    });
    expect(getIp(req)).toBe('9.10.11.12');
  });

  it('returns "unknown" when no IP header is present', () => {
    const req = new Request('http://localhost/');
    expect(getIp(req)).toBe('unknown');
  });
});
