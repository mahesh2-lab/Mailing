import { NextResponse } from 'next/server';
import { db } from '@/src';
import { emails } from '@/src/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { getAuthSession } from '@/src/lib/require-auth';

export async function POST(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const rawIds = body.messageIds || body.ids;
    const action = body.action;

    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return NextResponse.json({ error: 'Invalid message IDs' }, { status: 400 });
    }

    let targetFolder: string | null = null;
    if (action === 'archive') {
      targetFolder = 'archive';
    } else if (action === 'trash') {
      targetFolder = 'trash';
    } else if (action === 'restore') {
      targetFolder = 'inbox';
    }

    if (targetFolder) {
      await db
        .update(emails)
        .set({ folder: targetFolder })
        .where(and(inArray(emails.id, rawIds), eq(emails.userId, session.user.id)));
    }
    
    return NextResponse.json({ success: true, updatedIds: rawIds });
  } catch (error) {
    console.error("Bulk message action failed:", error);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

