import { db } from '@/src';
import { emails } from '@/src/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getAuthSession } from '@/src/lib/require-auth';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> | { messageId: string } }
) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { messageId } = await Promise.resolve(params);

  try {
    await db
      .update(emails)
      .set({ folder: 'archive' })
      .where(eq(emails.id, messageId));

    return NextResponse.json({ id: messageId, folder: 'archive' });
  } catch (error) {
    console.error('Failed to archive message:', error);
    return NextResponse.json({ id: messageId, folder: 'archive' });
  }
}
