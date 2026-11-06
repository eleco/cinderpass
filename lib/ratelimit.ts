// Simple in-memory sliding-window rate limiter.
// Works for single-server / single-process deployments (DigitalOcean App
// Platform with one instance). With several instances each has its own
// memory, so this limits per-instance. Replace with Redis/Upstash for
// cross-instance limits.

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
  // DigitalOcean App Platform sets do-connecting-ip from the TCP connection;
  // the first X-Forwarded-For entry is client-supplied there and spoofable.
  return (
    request.headers.get('do-connecting-ip')?.trim() ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

export function rateLimitResponse() {
  return Response.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
}
