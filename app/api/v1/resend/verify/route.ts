import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/src/lib/require-auth";
import { verifyResendCredentials } from "@/lib/resend-verify";
import { db } from "@/src/index";
import { userApiKeys } from "@/src/db/schema";
import { and, eq } from "drizzle-orm";
import { decrypt } from "@/src/lib/crypto";

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    let { apiKey, webhookSecret, senderEmail } = body;

    // If apiKey is missing or masked, attempt to load and decrypt from DB
    if (!apiKey || typeof apiKey !== "string" || apiKey.includes("••••")) {
      const existingKey = await db.query.userApiKeys.findFirst({
        where: and(
          eq(userApiKeys.userId, session.user.id),
          eq(userApiKeys.provider, "Resend")
        ),
      });

      if (existingKey?.encryptedKey) {
        try {
          apiKey = await decrypt(existingKey.encryptedKey);
        } catch (err) {
          console.error("Failed to decrypt stored Resend key for verification:", err);
        }
      }

      if ((!webhookSecret || webhookSecret.includes("••••")) && existingKey?.encryptedWebhookKey) {
        try {
          webhookSecret = await decrypt(existingKey.encryptedWebhookKey);
        } catch (err) {
          console.error("Failed to decrypt stored webhook secret for verification:", err);
        }
      }
    }

    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "Resend API key is required",
          field: "apiKey",
        },
        { status: 400 }
      );
    }

    const result = await verifyResendCredentials({
      apiKey,
      webhookSecret,
      senderEmail,
    });

    if (!result.valid) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Verification failed",
          field: result.field,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Resend API key and webhook verified successfully",
      domains: result.domains || [],
      webhooksCount: result.webhooksCount || 0,
      domainMatch: result.domainMatch,
    });
  } catch (err: any) {
    console.error("Resend verify endpoint error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Internal server error during verification",
      },
      { status: 500 }
    );
  }
}
