import { randomBytes } from 'crypto';

export function createToken(length = 32): string {
  return randomBytes(length).toString('base64url');
}

export function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
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
