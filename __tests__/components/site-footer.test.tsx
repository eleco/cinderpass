import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';

const REPO = 'https://github.com/eleco/cinderpass';
const SHA = 'daa84ff3d96a0cb6f933011fc0e15079696378a1';

async function render(sha: string | undefined, load: () => Promise<ReactElement>) {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_COMMIT_SHA', sha);
  return renderToStaticMarkup(await load());
}

const footer = (props = {}) => async () => {
  const { SiteFooter } = await import('@/components/SiteFooter');
  return <SiteFooter {...props} />;
};

afterEach(() => vi.unstubAllEnvs());

describe('SiteFooter', () => {
  it('always links to the repository', async () => {
    const html = await render('unknown', footer());
    expect(html).toContain(`href="${REPO}"`);
    expect(html).toContain('Open source on GitHub');
  });
  it('never links to /commit/unknown when the build has no git metadata', async () => {
    const html = await render('unknown', footer());
    expect(html).not.toContain('/commit/');
    expect(html).not.toContain('build ');
  });
  it('links the short build hash to the deployed commit when known', async () => {
    const html = await render(SHA, footer());
    expect(html).toContain(`href="${REPO}/commit/${SHA}"`);
    expect(html).toContain('build daa84ff');
  });
  it('can hide the Home link on the homepage', async () => {
    expect(await render(SHA, footer())).toContain('href="/"');
    expect(await render(SHA, footer({ showHome: false }))).not.toContain('href="/"');
  });
});

// Every public page must show the source link, as the FAQ promises.
const pages: [string, () => Promise<ReactElement>][] = [
  ['home', async () => { const { default: Page } = await import('@/app/page'); return <Page />; }],
  ['architecture', async () => { const { default: Page } = await import('@/app/architecture/page'); return <Page />; }],
  ['faq', async () => { const { default: Page } = await import('@/app/faq/page'); return <Page />; }],
  ['alternatives', async () => { const { default: Page } = await import('@/app/one-time-secret-alternatives/page'); return <Page />; }],
  ['one-time-link', async () => { const { default: Page } = await import('@/app/one-time-link/page'); return <Page />; }],
  ['secure-password-sharing', async () => { const { default: Page } = await import('@/app/secure-password-sharing/page'); return <Page />; }],
  ['send-secret-message', async () => { const { default: Page } = await import('@/app/send-secret-message/page'); return <Page />; }],
  ['secret reveal', async () => { const { default: Page } = await import('@/app/secret/[id]/page'); return Page({ params: Promise.resolve({ id: 'fixture' }) }); }],
];

describe.each(pages)('%s page footer', (_name, load) => {
  it('links to the source and deployed commit without dead links', async () => {
    const html = await render(SHA, load);
    expect(html).toContain(`href="${REPO}"`);
    expect(html).toContain(`href="${REPO}/commit/${SHA}"`);
    expect((await render('unknown', load))).not.toContain('/commit/unknown');
  });
});

describe('homepage open-source prominence', () => {
  it('shows the open-source pill, hero tag and feature card', async () => {
    const html = await render(SHA, async () => { const { default: Page } = await import('@/app/page'); return <Page />; });
    expect(html).toContain('Open source · MIT');
    expect(html).toContain('Open source on GitHub ↗');
    expect(html).toContain('Open source, verifiable');
    expect(html.split(`href="${REPO}"`).length - 1).toBeGreaterThanOrEqual(4);
  });
});
