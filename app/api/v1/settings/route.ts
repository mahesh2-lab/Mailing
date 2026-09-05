import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/src/lib/require-auth';
import { db } from '@/src/index';
import { userSettings } from '@/src/db/schema';
import { eq } from 'drizzle-orm';

const SettingsSchema = z.object({
  senderName: z.string().optional(),
  senderEmail: z.string().email().optional(),
});

export async function GET() {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, session.user.id)
  });

  return NextResponse.json({
    senderName: settings?.senderName || session.user.name || "",
    senderEmail: settings?.senderEmail || session.user.email || "",
  });
}

export async function PATCH(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    
    const parseResult = SettingsSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parseResult.error.format() }, { status: 400 });
    }

    const { senderName, senderEmail } = parseResult.data;
    
    if (senderName !== undefined || senderEmail !== undefined) {
      const existing = await db.query.userSettings.findFirst({
        where: eq(userSettings.userId, session.user.id)
      });
      
      if (existing) {
        await db.update(userSettings)
          .set({
            ...(senderName !== undefined && { senderName }),
            ...(senderEmail !== undefined && { senderEmail }),
            updatedAt: new Date().toISOString()
          })
          .where(eq(userSettings.userId, session.user.id));
      } else {
        await db.insert(userSettings).values({
          userId: session.user.id,
          senderName: senderName ?? session.user.name ?? "",
          senderEmail: senderEmail ?? session.user.email ?? "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
