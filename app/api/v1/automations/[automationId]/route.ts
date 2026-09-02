import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ automationId: string }> | { automationId: string } }
) {
  const { automationId } = await Promise.resolve(params);
  return NextResponse.json({ id: automationId, name: 'Auto-reply', active: true });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ automationId: string }> | { automationId: string } }
) {
  try {
    const { automationId } = await Promise.resolve(params);
    const body = await request.json();
    return NextResponse.json({ id: automationId, ...body });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ automationId: string }> | { automationId: string } }
) {
  const { automationId } = await Promise.resolve(params);
  return NextResponse.json({ success: true, deletedAutomationId: automationId });
}
