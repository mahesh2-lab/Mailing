import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ contactId: string }> | { contactId: string } }
) {
  const { contactId } = await Promise.resolve(params);
  return NextResponse.json({ id: contactId, name: 'Alice', email: 'alice@example.com' });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ contactId: string }> | { contactId: string } }
) {
  try {
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
  const { contactId } = await Promise.resolve(params);
  return NextResponse.json({ success: true, deletedContactId: contactId });
}
