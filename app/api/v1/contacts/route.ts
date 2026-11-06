import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/src";
import { contacts } from "@/src/db/schema";
import { getAuthSession } from "@/src/lib/require-auth";

const ContactInput = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  notes: z.string().trim().max(2000).optional().default(""),
});

export async function GET() {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = await db.select().from(contacts)
    .where(eq(contacts.userId, session.user.id))
    .orderBy(desc(contacts.createdAt));
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = ContactInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid contact" }, { status: 400 });

  const contact = {
    id: crypto.randomUUID(),
    ...parsed.data,
    userId: session.user.id,
    createdAt: new Date().toISOString(),
  };
  try {
    await db.insert(contacts).values(contact);
    return NextResponse.json({ data: contact }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      return NextResponse.json({ error: "A contact with this email already exists" }, { status: 409 });
    }
    console.error("Failed to create contact:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
