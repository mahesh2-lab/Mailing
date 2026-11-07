import { db } from '@/src';
import { emails } from '@/src/db/schema';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getAuthSession } from '@/src/lib/require-auth';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { messageId } = await params;

  try {

    const email = await db.select().from(emails).where(and(eq(emails.id, messageId), eq(emails.userId, session.user.id)));
    
    if (email.length === 0) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }
    
    await db.update(emails).set({ folder: 'trash' }).where(and(eq(emails.id, messageId), eq(emails.userId, session.user.id)));

    return NextResponse.json({ id: messageId, folder: 'trash' });
  } catch (error) {
    console.error("Failed to trash message:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
