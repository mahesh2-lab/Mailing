import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/src";
import { contacts } from "@/src/db/schema";
import { getAuthSession } from "@/src/lib/require-auth";

const ContactInput = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  notes: z.string().trim().max(2000).optional().default(""),
});

type Context = { params: Promise<{ contactId: string }> };

export async function GET(_request: Request, { params }: Context) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { contactId } = await params;
  const [contact] = await db.select().from(contacts).where(and(
    eq(contacts.id, contactId), eq(contacts.userId, session.user.id),
  )).limit(1);
  return contact
    ? NextResponse.json({ data: contact })
    : NextResponse.json({ error: "Contact not found" }, { status: 404 });
}

export async function PUT(request: Request, { params }: Context) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = ContactInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid contact" }, { status: 400 });
  const { contactId } = await params;
  const [contact] = await db.update(contacts).set(parsed.data).where(and(
    eq(contacts.id, contactId), eq(contacts.userId, session.user.id),
  )).returning();
  return contact
    ? NextResponse.json({ data: contact })
    : NextResponse.json({ error: "Contact not found" }, { status: 404 });
}

export async function DELETE(_request: Request, { params }: Context) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { contactId } = await params;
  const [deleted] = await db.delete(contacts).where(and(
    eq(contacts.id, contactId), eq(contacts.userId, session.user.id),
  )).returning({ id: contacts.id });
  return deleted
    ? NextResponse.json({ success: true, deletedContactId: deleted.id })
    : NextResponse.json({ error: "Contact not found" }, { status: 404 });
}
