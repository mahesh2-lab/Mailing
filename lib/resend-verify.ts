import { Resend } from "resend";
import { Webhook } from "svix";

export interface DomainItem {
  id: string;
  name: string;
  status: string;
}

export interface WebhookVerifyResult {
  valid: boolean;
  error?: string;
}

export interface ApiKeyVerifyResult {
  valid: boolean;
  error?: string;
  domains?: DomainItem[];
}

export interface CredentialsVerifyResult {
  valid: boolean;
  error?: string;
  field?: "apiKey" | "webhookSecret" | "senderEmail";
  domains?: DomainItem[];
  webhooksCount?: number;
  domainMatch?: {
    domain: string;
    verified: boolean;
    warning?: string;
  };
}

/**
 * Validates a Resend Webhook signing secret format using the official Svix library.
 */
export function verifyResendWebhookSecret(
  secret?: string | null
): WebhookVerifyResult {
  if (!secret || !secret.trim()) {
    return { valid: true };
  }

  const clean = secret.trim().replace(/^["']|["']$/g, "");

  if (!clean.startsWith("whsec_")) {
    return {
      valid: false,
      error: "Resend webhook secret must start with 'whsec_'",
    };
  }

  try {
    new Webhook(clean);
    return { valid: true };
  } catch (err: any) {
    return {
      valid: false,
      error: `Invalid Resend webhook secret: ${err.message || "Invalid Svix Base64 secret"}`,
    };
  }
}

/**
 * Validates a Resend API key against live Resend API endpoints.
 */
export async function verifyResendApiKey(
  apiKey: string
): Promise<ApiKeyVerifyResult> {
  const cleanKey = apiKey.trim();

  if (!cleanKey) {
    return { valid: false, error: "Resend API key is required" };
  }

  if (!cleanKey.startsWith("re_")) {
    return {
      valid: false,
      error: "Invalid format: Resend API keys must start with 're_'",
    };
  }

  try {
    const resend = new Resend(cleanKey);

    // 1. Try domains.list() first to also retrieve verified sending domains
    const { data: domainData, error: domainError } = await resend.domains.list();

    if (!domainError && domainData) {
      const rawDomains = Array.isArray((domainData as any).data)
        ? (domainData as any).data
        : Array.isArray(domainData)
        ? domainData
        : [];

      const domains: DomainItem[] = rawDomains.map((d: any) => ({
        id: d.id,
        name: d.name,
        status: d.status,
      }));

      return { valid: true, domains };
    }

    // 2. Check if domainError is due to an invalid key
    if (domainError) {
      const msg = domainError.message?.toLowerCase() || "";
      if (
        msg.includes("invalid") ||
        msg.includes("unauthorized") ||
        msg.includes("authentication") ||
        msg.includes("not found") ||
        (domainError as any).name === "validation_error"
      ) {
        return {
          valid: false,
          error: domainError.message || "Resend API key is invalid",
        };
      }

      // If the API key is scoped (e.g. sending-only permissions), try emails.list()
      const { data: emailsData, error: emailsError } = await resend.emails.list();
      if (!emailsError && emailsData) {
        return { valid: true, domains: [] };
      }

      // If both failed, return the primary error
      return {
        valid: false,
        error:
          domainError.message ||
          emailsError?.message ||
          "Resend API key validation failed",
      };
    }

    return { valid: false, error: "Unable to verify Resend API key" };
  } catch (err: any) {
    return {
      valid: false,
      error:
        err.message ||
        "Could not connect to Resend API. Please check your network connection.",
    };
  }
}

/**
 * Comprehensive verification for Resend API key, webhook signing secret, and sender domain.
 */
export async function verifyResendCredentials({
  apiKey,
  webhookSecret,
  senderEmail,
}: {
  apiKey: string;
  webhookSecret?: string | null;
  senderEmail?: string | null;
}): Promise<CredentialsVerifyResult> {
  // 1. Validate Webhook Secret format first (synchronous check)
  if (webhookSecret && webhookSecret.trim()) {
    const webhookCheck = verifyResendWebhookSecret(webhookSecret);
    if (!webhookCheck.valid) {
      return {
        valid: false,
        error: webhookCheck.error,
        field: "webhookSecret",
      };
    }
  }

  // 2. Validate Resend API key against live Resend API
  const apiCheck = await verifyResendApiKey(apiKey);
  if (!apiCheck.valid) {
    return {
      valid: false,
      error: apiCheck.error,
      field: "apiKey",
    };
  }

  // 3. Inspect webhooks configured on Resend
  let webhooksCount = 0;
  try {
    const resend = new Resend(apiKey.trim());
    const { data: whData, error: whError } = await resend.webhooks.list();
    if (!whError && whData) {
      const items = Array.isArray((whData as any).data)
        ? (whData as any).data
        : Array.isArray(whData)
        ? whData
        : [];
      webhooksCount = items.length;
    }
  } catch {
    // Non-fatal if key does not have webhooks:read scope
  }

  // 4. Optional domain check against senderEmail
  let domainMatch: CredentialsVerifyResult["domainMatch"];
  if (senderEmail && senderEmail.includes("@")) {
    const emailDomain = senderEmail.split("@")[1].toLowerCase().trim();
    const domains = apiCheck.domains || [];

    // Special testing domain for Resend sandbox
    const isTestDomain = emailDomain === "resend.dev";
    const matchedDomain = domains.find(
      (d) => d.name.toLowerCase() === emailDomain
    );

    const isVerified =
      isTestDomain ||
      (matchedDomain !== undefined && matchedDomain.status === "verified");

    domainMatch = {
      domain: emailDomain,
      verified: isVerified,
      warning:
        !isVerified && domains.length > 0
          ? `Domain "${emailDomain}" is not verified in your Resend account. Verified domains: ${domains
              .map((d) => d.name)
              .join(", ")}`
          : undefined,
    };
  }

  return {
    valid: true,
    domains: apiCheck.domains,
    webhooksCount,
    domainMatch,
  };
}
