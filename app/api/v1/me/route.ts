import { NextResponse } from 'next/server';
import { getAuthSession } from '@/src/lib/require-auth';

export async function GET() {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ id: '1', name: 'Demo User', email: 'demo@example.com' });
}

export async function PATCH(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    return NextResponse.json({ id: '1', ...body });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
