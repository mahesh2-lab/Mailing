import { NextResponse } from 'next/server';
import { db } from '@/src';
import { emails } from '@/src/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ draftId: string }> | { draftId: string } }
) {
  try {
    const { draftId } = await Promise.resolve(params);

    const [draft] = await db
      .select()
      .from(emails)
      .where(eq(emails.id, draftId))
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
  { params }: { params: Promise<{ draftId: string }> | { draftId: string } }
) {
  try {
    const { draftId } = await Promise.resolve(params);
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
      .where(eq(emails.id, draftId));

    return NextResponse.json({ id: draftId, success: true });
  } catch (error) {
    console.error('Failed to update draft:', error);
    return NextResponse.json({ error: 'Failed to update draft' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ draftId: string }> | { draftId: string } }
) {
  try {
    const { draftId } = await Promise.resolve(params);

    await db.delete(emails).where(eq(emails.id, draftId));

    return NextResponse.json({ success: true, deletedDraftId: draftId });
  } catch (error) {
    console.error('Failed to delete draft:', error);
    return NextResponse.json({ error: 'Failed to delete draft' }, { status: 500 });
  }
}
