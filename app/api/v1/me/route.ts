import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ id: '1', name: 'Demo User', email: 'demo@example.com' });
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    return NextResponse.json({ id: '1', ...body });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
