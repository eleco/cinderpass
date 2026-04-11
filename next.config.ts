import { execSync } from 'child_process';
import type { NextConfig } from 'next';

function getCommitSha(): string {
  // In CI (GitHub Actions, Vercel, etc.) the SHA is provided as an env var
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA;
  try {
    return execSync('git rev-parse HEAD').toString().trim();
  } catch {
    return 'unknown';
  }
}

const commitSha = getCommitSha();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_COMMIT_SHA: commitSha,
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
};

export default nextConfig;
