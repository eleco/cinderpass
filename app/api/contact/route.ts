import { Buffer } from 'node:buffer';
import { NextRequest, NextResponse } from 'next/server';
import { logRouteError } from '@/lib/api';
import { checkRateLimit, getIp, rateLimitResponse } from '@/lib/ratelimit';

const CONTACT_TO = 'contact@cinderpass.com';
const MAX_NAME_LENGTH = 80;
const MAX_MESSAGE_LENGTH = 4_000;

function getMailgunConfig() {
  const apiKey = process.env.MAILGUN_API_KEY?.trim();
  const domain = process.env.MAILGUN_DOMAIN?.trim();
  const from = process.env.MAILGUN_FROM_EMAIL?.trim();
  const baseUrl = process.env.MAILGUN_API_BASE_URL?.trim() || 'https://api.mailgun.net';

  if (!apiKey || !domain || !from) {
    return null;
  }

  return {
    apiKey,
    domain,
    from,
    baseUrl: baseUrl.replace(/\/+$/, ''),
  };
}

export async function POST(request: NextRequest) {
  if (!checkRateLimit(`contact:${getIp(request)}`, 3, 10 * 60_000)) {
    return rateLimitResponse();
  }

  try {
    const mailgun = getMailgunConfig();
    if (!mailgun) {
      return NextResponse.json(
        { error: 'Contact form is not configured yet.' },
        { status: 503 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      message?: string;
    };

    const name = body.name?.trim();
    const message = body.message?.trim();

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    const safeName = name.slice(0, MAX_NAME_LENGTH);
    const safeMessage = message.slice(0, MAX_MESSAGE_LENGTH);
    const referer = request.headers.get('referer') ?? 'unknown';

    const form = new FormData();
    form.set('from', mailgun.from);
    form.set('to', CONTACT_TO);
    form.set('subject', `Cinderpass contact form from ${safeName}`);
    form.set(
      'text',
      [
        `Name: ${safeName}`,
        `Sent from: ${referer}`,
        '',
        safeMessage,
      ].join('\n'),
    );

    const auth = Buffer.from(`api:${mailgun.apiKey}`).toString('base64');
    const response = await fetch(`${mailgun.baseUrl}/v3/${mailgun.domain}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
      },
      body: form,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      logRouteError('POST /api/contact Mailgun', detail || response.statusText);
      return NextResponse.json(
        { error: 'Unable to send your message right now.' },
        { status: 502 },
      );
    }

    return NextResponse.json({ sent: true });
  } catch (error) {
    logRouteError('POST /api/contact', error);
    return NextResponse.json(
      { error: 'Unable to send your message right now.' },
      { status: 500 },
    );
  }
}
