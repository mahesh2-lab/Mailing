import { encrypt } from "@/src/lib/crypto";
import { db } from "@/src/";
import { auth } from "@/src/lib/auth";
import { userApiKeys } from "@/src/db/schema";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

const KeyPostSchema = z.object({
  provider: z.string().min(1, "Provider is required"),
  apiKey: z.string().min(1, "API Key is required"),
  webhookKey: z.string().optional(),
  domain: z.string().optional(),
});

const KeyDeleteSchema = z.object({
  provider: z.string().min(1, "Provider is required"),
});

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session)
      return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parseResult = KeyPostSchema.safeParse(body);
    if (!parseResult.success) {
      return Response.json({ error: "Invalid payload", details: parseResult.error.format() }, { status: 400 });
    }

    const { provider, apiKey, webhookKey, domain } = parseResult.data;

    const existing = await db.query.userApiKeys.findFirst({
      where: and(
        eq(userApiKeys.userId, session.user.id),
        eq(userApiKeys.provider, provider),
      ),
    });

    const values = {
      userId: session.user.id,
      provider,
      domain: domain ?? null,
      encryptedKey: await encrypt(apiKey),
      keyLastFour: apiKey.slice(-4),
      ...(webhookKey && {
        encryptedWebhookKey: await encrypt(webhookKey),
        webhookKeyLastFour: webhookKey.slice(-4),
      }),
      updatedAt: new Date().toISOString(),
    };

    if (existing) {
      await db
        .update(userApiKeys)
        .set(values)
        .where(eq(userApiKeys.id, existing.id));
    } else {
      await db.insert(userApiKeys).values({
        ...values,
        createdAt: new Date().toISOString(),
      });
    }

    return Response.json({
      success: true,
      keyLastFour: values.keyLastFour,
      ...(values.webhookKeyLastFour && { webhookKeyLastFour: values.webhookKeyLastFour }),
    });
  } catch (error) {
    console.error("Failed to save API key:", error);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session)
      return Response.json({ error: "Unauthorized" }, { status: 401 });

    const keys = await db.query.userApiKeys.findMany({
      where: eq(userApiKeys.userId, session.user.id),
      columns: {
        id: true,
        provider: true,
        domain: true,
        keyLastFour: true,
        webhookKeyLastFour: true,
        createdAt: true,
        updatedAt: true,
        // never return encrypted values
        encryptedKey: false,
        encryptedWebhookKey: false,
      },
    });

    return Response.json({ keys });
  } catch (error) {
    console.error("Failed to fetch API keys:", error);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session)
      return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parseResult = KeyDeleteSchema.safeParse(body);
    if (!parseResult.success) {
      return Response.json({ error: "Invalid payload", details: parseResult.error.format() }, { status: 400 });
    }

    const { provider } = parseResult.data;

    await db
      .delete(userApiKeys)
      .where(
        and(
          eq(userApiKeys.userId, session.user.id),
          eq(userApiKeys.provider, provider),
        ),
      );

    return Response.json({ success: true });
  } catch (error) {
    console.error("Failed to delete API key:", error);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
