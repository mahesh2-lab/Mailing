import { NextResponse } from 'next/server';
import { db } from '@/src';
import { emails } from '@/src/db/schema';
import { and, eq } from 'drizzle-orm';
import { getAuthSession } from '@/src/lib/require-auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ draftId: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { draftId } = await params;

    const [draft] = await db
      .select()
      .from(emails)
      .where(and(eq(emails.id, draftId), eq(emails.userId, session.user.id)))
      .limit(1);

    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    return NextResponse.json(draft);
  } catch (error) {
    console.error('Failed to get draft:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ draftId: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { draftId } = await params;
    const { to, cc, bcc, subject, html, text } = await request.json();
    const recipients = Array.isArray(to) ? to : (to ? [to] : []);
    const now = new Date().toISOString();

    await db
      .update(emails)
      .set({
        to: recipients,
        subject: subject || '(Draft) No Subject',
        html: html || '',
        text: text || '',
        cc: cc ? (Array.isArray(cc) ? cc : [cc]) : [],
        bcc: bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : [],
        createdAt: now,
      })
      .where(and(eq(emails.id, draftId), eq(emails.userId, session.user.id)));

    return NextResponse.json({ id: draftId, success: true });
  } catch (error) {
    console.error('Failed to update draft:', error);
    return NextResponse.json({ error: 'Failed to update draft' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ draftId: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { draftId } = await params;

    await db.delete(emails).where(and(eq(emails.id, draftId), eq(emails.userId, session.user.id)));

    return NextResponse.json({ success: true, deletedDraftId: draftId });
  } catch (error) {
    console.error('Failed to delete draft:', error);
    return NextResponse.json({ error: 'Failed to delete draft' }, { status: 500 });
  }
}
