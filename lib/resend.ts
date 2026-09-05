import { Resend } from 'resend';
import { db } from '@/src';
import { userApiKeys } from '@/src/db/schema';
import { and, eq } from 'drizzle-orm';
import { decrypt } from '@/src/lib/crypto';


export async function getResendClient(userId?: string | null): Promise<Resend | null> {
  if (userId) {
    const apiKeyRecord = await db.query.userApiKeys.findFirst({
      where: and(
        eq(userApiKeys.userId, userId),
        eq(userApiKeys.provider, "Resend")
      )
    });

    if (apiKeyRecord) {
      try {
        const decryptedKey = await decrypt(apiKeyRecord.encryptedKey);
        return new Resend(decryptedKey);
      } catch {
        console.error("Failed to decrypt Resend API key for user:", userId);
      }
    }
  }

  const anyRecord = await db.query.userApiKeys.findFirst({
    where: eq(userApiKeys.provider, "Resend"),
  });
  if (anyRecord) {
    try {
      const decryptedKey = await decrypt(anyRecord.encryptedKey);
      return new Resend(decryptedKey);
    } catch {}
  }

  return null;
}
