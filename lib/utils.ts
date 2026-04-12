import { randomBytes } from 'crypto';

const DEFAULT_DEV_BASE_URL = 'http://localhost:3000';

export function createToken(length = 32): string {
  return randomBytes(length).toString('base64url');
}

function normalizeBaseUrl(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (trimmed === 'undefined' || trimmed === 'null') return null;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    return new URL(withProtocol).origin;
  } catch {
    return null;
  }
}

export function getConfiguredBaseUrl(): string {
  return (
    normalizeBaseUrl(process.env.APP_URL)
    ?? normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL)
    ?? normalizeBaseUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL)
    ?? normalizeBaseUrl(process.env.VERCEL_URL)
    ?? DEFAULT_DEV_BASE_URL
  );
}

export function getBaseUrl(request?: Request): string {
  const configured = normalizeBaseUrl(process.env.APP_URL)
    ?? normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL)
    ?? normalizeBaseUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL)
    ?? normalizeBaseUrl(process.env.VERCEL_URL);

  if (configured) return configured;

  if (request) {
    return new URL(request.url).origin;
  }

  return DEFAULT_DEV_BASE_URL;
}

export function isExpired(date: Date): boolean {
  return date.getTime() <= Date.now();
}

export function addHours(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

export function sanitizeNote(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 140) : null;
}
