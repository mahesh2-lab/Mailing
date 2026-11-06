import { db } from '@/src';
import { emails } from '@/src/db/schema';
import { and, eq } from 'drizzle-orm';
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
    const body = await request.json();


    const email = await db.select().from(emails).where(and(eq(emails.id, messageId), eq(emails.userId, session.user.id)));
    
    if (email.length === 0) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }
    
    await db.update(emails).set({ starred: body.starred ?? true }).where(and(eq(emails.id, messageId), eq(emails.userId, session.user.id)));

    return NextResponse.json({ id: messageId, starred: body.starred ?? true });
    
  } catch (error) {
    console.error("Failed to update message star:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
