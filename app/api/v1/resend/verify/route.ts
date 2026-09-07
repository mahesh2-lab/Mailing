import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/src/lib/require-auth";
import { verifyResendCredentials } from "@/lib/resend-verify";

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { apiKey, webhookSecret, senderEmail } = body;

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
