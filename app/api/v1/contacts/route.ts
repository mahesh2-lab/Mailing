import { NextResponse } from 'next/server';
import { getAuthSession } from '@/src/lib/require-auth';

export async function GET() {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ data: [{ id: 'c1', name: 'Alice', email: 'alice@example.com' }] });
}

export async function POST(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    return NextResponse.json({ id: 'c-new', ...body }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
