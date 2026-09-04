import { NextResponse } from 'next/server';
import { db } from '@/src';
import { emails } from '@/src/db/schema';
import { eq } from 'drizzle-orm';
import { getAuthSession } from '@/src/lib/require-auth';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> | { messageId: string } }
) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { messageId } = await Promise.resolve(params);

  try {
    const email = await db.select().from(emails).where(eq(emails.id, messageId));
    
    if (!email || email.length === 0) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    let unread = false;
    try {
      const body = await request.json();
      if (typeof body.unread === 'boolean') {
        unread = body.unread;
      } else if (typeof body.read === 'boolean') {
        unread = !body.read;
      }
    } catch {
      // No or empty body; defaults to unread = false (marked as read)
    }
    
    await db.update(emails).set({ unread }).where(eq(emails.id, messageId));

    return NextResponse.json({ id: messageId, unread, read: !unread });
  } catch (error) {
    return NextResponse.json({ error: "Error updating message" }, { status: 500 });
  }
}
