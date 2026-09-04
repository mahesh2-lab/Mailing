import { NextResponse } from 'next/server';
import { db } from '@/src';
import { emails } from '@/src/db/schema';
import { eq, or, desc } from 'drizzle-orm';
import { getAuthSession } from '@/src/lib/require-auth';

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const data = await db
      .select()
      .from(emails)
      .where(or(eq(emails.folder, 'drafts'), eq(emails.status, 'draft')))
      .orderBy(desc(emails.createdAt));

    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error('Failed to fetch drafts:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { to, cc, bcc, subject, html, text } = await request.json();
    const draftId = `draft_${crypto.randomUUID()}`;
    const recipients = Array.isArray(to) ? to : (to ? [to] : []);
    const now = new Date().toISOString();

    const newDraft = {
      id: draftId,
      to: recipients,
      from: 'Mahesh <mahesh@heymahesh.in>',
      createdAt: now,
      subject: subject || '(Draft) No Subject',
      html: html || '',
      text: text || '',
      cc: cc ? (Array.isArray(cc) ? cc : [cc]) : [],
      bcc: bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : [],
      status: 'draft',
      folder: 'drafts',
      starred: false,
      unread: false,
      labels: ['Draft'],
    };

    await db.insert(emails).values(newDraft);

    return NextResponse.json(newDraft, { status: 201 });
  } catch (error) {
    console.error('Failed to create draft:', error);
    return NextResponse.json({ error: 'Failed to create draft' }, { status: 500 });
  }
}
