'use client';

import { FormEvent, useState } from 'react';

async function getResponseError(response: Response, fallback: string) {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export function ContactWidget() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setIsError(false);
    setStatus('Sending...');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, message }),
      });

      if (!response.ok) {
        throw new Error(await getResponseError(response, 'Unable to send your message right now.'));
      }

      setStatus('Message sent. We will get back to you by email.');
      setName('');
      setMessage('');
    } catch (error) {
      setIsError(true);
      setStatus(getErrorMessage(error, 'Unable to send your message right now.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={`contact-widget${open ? ' contact-widget-open' : ''}`}>
      {open ? (
        <div className="contact-panel">
          <div className="contact-panel-head">
            <div>
              <div className="contact-eyebrow">Contact</div>
              <h2>Send a note</h2>
            </div>
            <button
              type="button"
              className="contact-close"
              onClick={() => setOpen(false)}
              aria-label="Close contact form"
            >
              ×
            </button>
          </div>

          <p className="contact-copy">
            Ask a question, report an issue, or tell us what you need.
          </p>

          <form className="contact-form" onSubmit={onSubmit}>
            <div>
              <label className="label" htmlFor="contact-name">Name</label>
              <input
                id="contact-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                placeholder="Your name"
                required
              />
            </div>

            <div>
              <label className="label" htmlFor="contact-message">Message</label>
              <textarea
                id="contact-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={4000}
                placeholder="What would you like to discuss?"
                required
              />
            </div>

            <button disabled={isSubmitting || !name.trim() || !message.trim()}>
              {isSubmitting ? 'Sending...' : 'Send message'}
            </button>
            {status ? <p className={`small ${isError ? 'error' : 'muted'}`}>{status}</p> : null}
          </form>
        </div>
      ) : null}

      <button
        type="button"
        className="contact-trigger"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        Contact us
      </button>
    </div>
  );
}
