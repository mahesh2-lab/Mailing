import { db } from '@/src';
import { emails } from '@/src/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> | { messageId: string } }
) {
  const { messageId } = await Promise.resolve(params);
  try {
    const body = await request.json();


    const email = await db.select().from(emails).where(eq(emails.id, messageId));
    
    if (!email) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }
    
    await db.update(emails).set({ starred: body.starred ?? true }).where(eq(emails.id, messageId));

    return NextResponse.json({ id: messageId, starred: body.starred ?? true });
    
  } catch (error) {
    console.log(error);
    return NextResponse.json({ id: messageId, starred: true });
  }
}
