import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/src/lib/require-auth";
import { db } from "@/src/index";
import { userSettings, userApiKeys } from "@/src/db/schema";
import { eq, and } from "drizzle-orm";
import { encrypt, decrypt } from "@/src/lib/crypto";

const SettingsSchema = z.object({
  senderName: z.string().optional(),
  senderEmail: z.string().optional(),
  replyToEmail: z.string().optional(),
  resendApiKey: z.string().optional(),
  resendWebhookSecret: z.string().optional(),
});

export async function GET() {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, session.user.id),
  });

  const apiKeyRecord = await db.query.userApiKeys.findFirst({
    where: and(
      eq(userApiKeys.userId, session.user.id),
      eq(userApiKeys.provider, "Resend")
    ),
  });

  const senderName = settings?.senderName || session.user.name || "";
  const senderEmail = settings?.senderEmail || session.user.email || "";

  let resendApiKey = "";
  let resendWebhookSecret = "";

  if (apiKeyRecord?.encryptedKey) {
    try {
      resendApiKey = await decrypt(apiKeyRecord.encryptedKey);
    } catch (err) {
      console.error("Failed to decrypt stored Resend API key:", err);
      resendApiKey = apiKeyRecord.keyLastFour ? `re_••••••••${apiKeyRecord.keyLastFour}` : "";
    }
  }

  if (apiKeyRecord?.encryptedWebhookKey) {
    try {
      resendWebhookSecret = await decrypt(apiKeyRecord.encryptedWebhookKey);
    } catch (err) {
      console.error("Failed to decrypt stored Resend Webhook key:", err);
      resendWebhookSecret = apiKeyRecord.webhookKeyLastFour ? `whsec_••••••••${apiKeyRecord.webhookKeyLastFour}` : "";
    }
  }

  const payload = {
    senderName,
    senderEmail,
    replyToEmail: senderEmail,
    resendApiKey,
    resendWebhookSecret,
    domain: apiKeyRecord?.domain || (senderEmail.includes("@") ? senderEmail.split("@")[1] : ""),
  };

  return NextResponse.json({
    data: payload,
    ...payload,
  });
}

async function handleUpdate(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parseResult = SettingsSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { senderName, senderEmail, resendApiKey, resendWebhookSecret } = parseResult.data;

    // Update userSettings
    if (senderName !== undefined || senderEmail !== undefined) {
      const existing = await db.query.userSettings.findFirst({
        where: eq(userSettings.userId, session.user.id),
      });

      if (existing) {
        await db
          .update(userSettings)
          .set({
            ...(senderName !== undefined && { senderName }),
            ...(senderEmail !== undefined && { senderEmail }),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(userSettings.userId, session.user.id));
      } else {
        await db.insert(userSettings).values({
          userId: session.user.id,
          senderName: senderName ?? session.user.name ?? "",
          senderEmail: senderEmail ?? session.user.email ?? "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    // Update Resend userApiKeys if new raw keys were submitted (not masked)
    const hasNewApiKey =
      resendApiKey &&
      resendApiKey.trim() !== "" &&
      !resendApiKey.includes("••••");

    const hasNewWebhookSecret =
      resendWebhookSecret &&
      resendWebhookSecret.trim() !== "" &&
      !resendWebhookSecret.includes("••••");

    if (hasNewApiKey || hasNewWebhookSecret) {
      const existingKey = await db.query.userApiKeys.findFirst({
        where: and(
          eq(userApiKeys.userId, session.user.id),
          eq(userApiKeys.provider, "Resend")
        ),
      });

      const updates: any = {
        updatedAt: new Date().toISOString(),
      };

      if (hasNewApiKey) {
        updates.encryptedKey = await encrypt(resendApiKey!.trim());
        updates.keyLastFour = resendApiKey!.trim().slice(-4);
      }

      if (hasNewWebhookSecret) {
        updates.encryptedWebhookKey = await encrypt(resendWebhookSecret!.trim());
        updates.webhookKeyLastFour = resendWebhookSecret!.trim().slice(-4);
      }

      if (existingKey) {
        await db
          .update(userApiKeys)
          .set(updates)
          .where(eq(userApiKeys.id, existingKey.id));
      } else if (hasNewApiKey) {
        await db.insert(userApiKeys).values({
          userId: session.user.id,
          provider: "Resend",
          encryptedKey: updates.encryptedKey,
          keyLastFour: updates.keyLastFour,
          encryptedWebhookKey: updates.encryptedWebhookKey || null,
          webhookKeyLastFour: updates.webhookKeyLastFour || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        senderName: senderName ?? "",
        senderEmail: senderEmail ?? "",
      },
    });
  } catch (error: any) {
    console.error("Settings update error:", error);
    return NextResponse.json({ error: error.message || "Invalid request" }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  return handleUpdate(request);
}

export async function PATCH(request: Request) {
  return handleUpdate(request);
}
