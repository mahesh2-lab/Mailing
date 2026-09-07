import { encrypt } from "@/src/lib/crypto";
import { db } from "@/src/";
import { auth } from "@/src/lib/auth";
import { userApiKeys } from "@/src/db/schema";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { verifyResendCredentials, verifyResendWebhookSecret } from "@/lib/resend-verify";
import { decrypt } from "@/src/lib/crypto";

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

    // Verify Resend credentials before proceed
    if (provider === "Resend") {
      const check = await verifyResendCredentials({
        apiKey,
        webhookSecret: webhookKey,
      });
      if (!check.valid) {
        return Response.json(
          { error: check.error || "Resend API key or webhook check failed" },
          { status: 400 }
        );
      }
    }

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

const KeyPatchSchema = z.object({
  provider: z.string().min(1, "Provider is required"),
  apiKey: z.string().optional(),
  webhookKey: z.string().optional(),
  domain: z.string().optional(),
});

export async function PATCH(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session)
      return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parseResult = KeyPatchSchema.safeParse(body);
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

    if (!existing) {
      return Response.json({ error: "Key not found for this provider" }, { status: 404 });
    }

    // Verify Resend credentials before proceed
    if (provider === "Resend" && (apiKey || webhookKey)) {
      let keyToTest = apiKey;
      if (!keyToTest && existing.encryptedKey) {
        try {
          keyToTest = await decrypt(existing.encryptedKey);
        } catch {}
      }

      if (keyToTest) {
        const check = await verifyResendCredentials({
          apiKey: keyToTest,
          webhookSecret: webhookKey,
        });
        if (!check.valid) {
          return Response.json(
            { error: check.error || "Resend API key or webhook check failed" },
            { status: 400 }
          );
        }
      } else if (webhookKey) {
        const whCheck = verifyResendWebhookSecret(webhookKey);
        if (!whCheck.valid) {
          return Response.json(
            { error: whCheck.error || "Invalid Resend webhook secret" },
            { status: 400 }
          );
        }
      }
    }

    const updates: any = {
      updatedAt: new Date().toISOString(),
    };

    if (domain !== undefined) {
      updates.domain = domain;
    }

    if (apiKey) {
      updates.encryptedKey = await encrypt(apiKey);
      updates.keyLastFour = apiKey.slice(-4);
    }

    if (webhookKey) {
      updates.encryptedWebhookKey = await encrypt(webhookKey);
      updates.webhookKeyLastFour = webhookKey.slice(-4);
    }

    await db
      .update(userApiKeys)
      .set(updates)
      .where(eq(userApiKeys.id, existing.id));

    return Response.json({
      success: true,
    });
  } catch (error) {
    console.error("Failed to update API key:", error);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
