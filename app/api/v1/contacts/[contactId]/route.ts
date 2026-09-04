import { NextResponse } from 'next/server';
import { getAuthSession } from '@/src/lib/require-auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ contactId: string }> | { contactId: string } }
) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { contactId } = await Promise.resolve(params);
  return NextResponse.json({ id: contactId, name: 'Alice', email: 'alice@example.com' });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ contactId: string }> | { contactId: string } }
) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { contactId } = await Promise.resolve(params);
    const body = await request.json();
    return NextResponse.json({ id: contactId, ...body });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ contactId: string }> | { contactId: string } }
) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { contactId } = await Promise.resolve(params);
  return NextResponse.json({ success: true, deletedContactId: contactId });
}
