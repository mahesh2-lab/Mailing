import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ data: [{ id: 'c1', name: 'Alice', email: 'alice@example.com' }] });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return NextResponse.json({ id: 'c-new', ...body }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
