import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> | { threadId: string } }
) {
  const { threadId } = await Promise.resolve(params);
  return NextResponse.json({
    id: threadId,
    messages: [
      { id: 'm1', body: 'First' },
      { id: 'm2', body: 'Reply' }
    ]
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> | { threadId: string } }
) {
  const { threadId } = await Promise.resolve(params);
  return NextResponse.json({ success: true, deletedThreadId: threadId });
}
