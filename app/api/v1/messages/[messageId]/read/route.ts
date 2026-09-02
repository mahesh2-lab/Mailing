import { NextResponse } from 'next/server';
import { db } from '@/src';
import { emails } from '@/src/db/schema';
import { eq } from 'drizzle-orm';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> | { messageId: string } }
) {
  const { messageId } = await Promise.resolve(params);

  try {
    const email = await db.select().from(emails).where(eq(emails.id, messageId));
    
    if (!email) {
      return NextResponse.json({ error: "Email not found" }, { status: 400 });
    }
    
    await db.update(emails).set({ unread: false }).where(eq(emails.id, messageId));


    return NextResponse.json({ id: messageId, read: true });
  } catch (error) {
    return NextResponse.json({ error: "Error updating message" });
  }
}
