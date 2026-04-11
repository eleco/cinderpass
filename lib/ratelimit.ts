// Simple in-memory sliding-window rate limiter.
// Works for single-server / single-process deployments. On serverless
// (Vercel) each function instance has its own memory, so this limits
// per-instance — still meaningful protection against bursts on a single
// cold instance. Replace with Redis/Upstash for cross-instance limits.

const windows = new Map<string, number[]>();

export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  const timestamps = (windows.get(key) ?? []).filter((t) => t > cutoff);
  if (timestamps.length >= limit) return false;
  timestamps.push(now);
  windows.set(key, timestamps);
  return true;
}

export function getIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  );
}

export function rateLimitResponse() {
  return Response.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
}
