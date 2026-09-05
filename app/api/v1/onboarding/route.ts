import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src";
import { userApiKeys, userSettings } from "@/src/db/schema";
import { getAuthSession } from "@/src/lib/require-auth";
import { encrypt } from "@/src/lib/crypto";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const { senderName, senderEmail, resendApiKey, resendWebhookSecret, profileName, profileImage } = await req.json();

    if (!senderName || !senderEmail || !resendApiKey) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Update user profile
    if (profileName || profileImage) {
      const { user } = await import("@/src/db/auth-schema");
      await db.update(user).set({
        ...(profileName ? { name: profileName } : {}),
        ...(profileImage ? { image: profileImage } : {}),
        updatedAt: new Date(),
      }).where(eq(user.id, userId));
    }

    // Upsert userSettings
    const existingSettings = await db.query.userSettings.findFirst({
      where: eq(userSettings.userId, userId)
    });

    if (existingSettings) {
      await db.update(userSettings).set({
        senderName,
        senderEmail,
        updatedAt: new Date().toISOString()
      }).where(eq(userSettings.userId, userId));
    } else {
      await db.insert(userSettings).values({
        userId,
        senderName,
        senderEmail,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    // Upsert userApiKeys for Resend
    const encryptedKey = await encrypt(resendApiKey);
    const keyLastFour = resendApiKey.slice(-4);
    
    let encryptedWebhookKey = null;
    let webhookKeyLastFour = null;
    if (resendWebhookSecret) {
      encryptedWebhookKey = await encrypt(resendWebhookSecret);
      webhookKeyLastFour = resendWebhookSecret.slice(-4);
    }

    const existingKey = await db.query.userApiKeys.findFirst({
      where: and(
        eq(userApiKeys.userId, userId),
        eq(userApiKeys.provider, "Resend")
      )
    });

    if (existingKey) {
      await db.update(userApiKeys).set({
        encryptedKey,
        keyLastFour,
        encryptedWebhookKey,
        webhookKeyLastFour,
        updatedAt: new Date().toISOString()
      }).where(eq(userApiKeys.id, existingKey.id));
    } else {
      await db.insert(userApiKeys).values({
        userId,
        provider: "Resend",
        encryptedKey,
        keyLastFour,
        encryptedWebhookKey,
        webhookKeyLastFour,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Onboarding error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
