import { afterEach, describe, expect, it, vi } from 'vitest';

// lib/source reads the build-time env at import, so each case re-imports it.
async function loadWithSha(sha: string | undefined) {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_COMMIT_SHA', sha);
  return import('@/lib/source');
}

afterEach(() => vi.unstubAllEnvs());

describe('source links', () => {
  it('points at the public repository', async () => {
    expect((await loadWithSha(undefined)).REPO_URL).toBe('https://github.com/eleco/cinderpass');
  });
  it('builds a commit link for a real SHA', async () => {
    const sha = 'daa84ff3d96a0cb6f933011fc0e15079696378a1';
    const source = await loadWithSha(sha);
    expect(source.COMMIT_SHA).toBe(sha);
    expect(source.COMMIT_URL).toBe(`https://github.com/eleco/cinderpass/commit/${sha}`);
  });
  it.each([['unknown'], [''], [undefined], ['not-a-sha'], ['abc12']])('omits the commit link for %j instead of linking to a 404', async (sha) => {
    const source = await loadWithSha(sha);
    expect(source.COMMIT_SHA).toBeNull();
    expect(source.COMMIT_URL).toBeNull();
  });
});
