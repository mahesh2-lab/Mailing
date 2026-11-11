import { createHash } from "node:crypto";

export function gravatarUrl(from?: string | null): string | undefined {
  const address = from?.match(/<([^>]+)>/)?.[1] ?? from;
  const email = address?.trim().toLowerCase();
  if (!email || !email.includes("@")) return undefined;

  const hash = createHash("sha256").update(email).digest("hex");
  return `https://gravatar.com/avatar/${hash}?s=200&d=404`;
}
