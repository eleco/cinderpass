import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    commit: process.env.NEXT_PUBLIC_COMMIT_SHA ?? 'unknown',
    buildTime: process.env.NEXT_PUBLIC_BUILD_TIME ?? null,
    repo: 'https://github.com/eleco/cinderpass',
  });
}
