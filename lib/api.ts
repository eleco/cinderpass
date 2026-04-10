import { NextResponse } from 'next/server';

export function requireDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return null;
  }

  return NextResponse.json(
    { error: 'Server is not configured: DATABASE_URL is missing.' },
    { status: 503 },
  );
}

export function logRouteError(route: string, error: unknown) {
  console.error(`[${route}]`, error);
}
