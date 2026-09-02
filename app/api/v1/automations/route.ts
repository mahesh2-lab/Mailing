import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ data: [{ id: 'a1', name: 'Auto-reply', active: true }] });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return NextResponse.json({ id: 'a-new', ...body }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
