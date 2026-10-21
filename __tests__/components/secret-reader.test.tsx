// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RequestSubmitForm, SecretReader } from '@/components/forms';

type Meta = { status: number; body: object } | 'network-error';

// Queue metadata responses in order; each GET /api/retrieve/:id consumes one.
function mockMetadata(...responses: Meta[]) {
  const fetcher = vi.fn(async () => {
    const next = responses.shift();
    if (!next || next === 'network-error') throw new TypeError('Failed to fetch');
    return { status: next.status, ok: next.status < 400, json: async () => next.body };
  });
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}

const ok = (body: object = {}) => ({ status: 200, body: { passphraseRequired: false, passphraseSalt: null, note: null, ...body } });
const revealButton = () => screen.getByRole('button', { name: /reveal secret/i });

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('SecretReader metadata retry', () => {
  it('offers a retry after a rate limit and enables Reveal once it succeeds', async () => {
    const fetcher = mockMetadata({ status: 429, body: { error: 'Too many requests. Please slow down.' } }, ok());
    render(<SecretReader id="abc" />);
    expect(await screen.findByText('Too many requests. Please slow down.')).toBeTruthy();
    expect(revealButton()).toHaveProperty('disabled', true);

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(revealButton()).toHaveProperty('disabled', false));
    expect(screen.queryByText(/too many requests/i)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('offers a retry after a network failure', async () => {
    mockMetadata('network-error', ok());
    render(<SecretReader id="abc" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(revealButton()).toHaveProperty('disabled', false));
  });

  it.each([[404, 'Secret not found'], [410, 'Secret already opened or destroyed']])('does not offer a retry for a final %i', async (status, error) => {
    mockMetadata({ status, body: { error } });
    render(<SecretReader id="abc" />);
    expect(await screen.findByText(error)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });
});

describe('SecretReader switching secrets', () => {
  it('clears the previous secret\'s error and passphrase state', async () => {
    mockMetadata(
      { status: 410, body: { error: 'Secret already opened or destroyed' } },
      ok({ note: 'Second secret' }),
    );
    const { rerender } = render(<SecretReader id="first" />);
    expect(await screen.findByText('Secret already opened or destroyed')).toBeTruthy();

    await act(async () => { rerender(<SecretReader id="second" />); });
    expect(await screen.findByText('Second secret')).toBeTruthy();
    expect(screen.queryByText('Secret already opened or destroyed')).toBeNull();
    expect(revealButton()).toHaveProperty('disabled', false);
  });

  it('does not carry a passphrase requirement over to an unprotected secret', async () => {
    mockMetadata(ok({ passphraseRequired: true, passphraseSalt: 'v2.AAAAAAAAAAAAAAAAAAAAAA==' }), ok());
    const { rerender } = render(<SecretReader id="protected" />);
    expect(await screen.findByText('Passphrase required')).toBeTruthy();

    await act(async () => { rerender(<SecretReader id="plain" />); });
    await waitFor(() => expect(revealButton()).toHaveProperty('disabled', false));
    expect(screen.queryByText('Passphrase required')).toBeNull();
  });
});

describe('RequestSubmitForm on a closed request', () => {
  it('shows a closed notice and never renders the (erased) label', () => {
    const { container } = render(<RequestSubmitForm token="t" label="" note={null} expired expiresAt={new Date().toISOString()} />);
    expect(screen.getByText('This request is no longer open.')).toBeTruthy();
    expect(container.querySelector('strong')).toBeNull();
  });
});
