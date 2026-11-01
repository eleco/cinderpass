import { NextResponse } from 'next/server';
import { logRouteError, requireStore } from '@/lib/api';
import { destroySecret } from '@/lib/store';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const configError = requireStore();
    if (configError) return configError;

    const body = (await request.json().catch(() => ({}))) as { destroyToken?: string };

    if (typeof body.destroyToken !== 'string' || !body.destroyToken) {
      return NextResponse.json({ error: 'destroyToken is required' }, { status: 400 });
    }

    const result = await destroySecret(id, body.destroyToken);

    switch (result.state) {
      case 'missing':
        return NextResponse.json({ error: 'Secret not found' }, { status: 404 });
      case 'closed':
        return NextResponse.json({ error: 'Secret already opened or destroyed' }, { status: 410 });
      case 'no_token':
        return NextResponse.json({ error: 'This secret cannot be destroyed via token' }, { status: 409 });
      case 'forbidden':
        return NextResponse.json({ error: 'Invalid destroy token' }, { status: 403 });
    }

    return NextResponse.json({ destroyed: true });
  } catch (error) {
    logRouteError(`POST /api/secrets/${id}/destroy`, error);
    return NextResponse.json({ error: 'Unable to destroy secret' }, { status: 500 });
  }
}
