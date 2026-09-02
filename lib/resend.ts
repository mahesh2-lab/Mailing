import { Resend } from 'resend';
import { db } from '@/src';
import { userApiKeys } from '@/src/db/schema';
import { and, eq } from 'drizzle-orm';
import { decrypt } from '@/src/lib/crypto';


export const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null as unknown as Resend;

export async function getResendClient(userId: string): Promise<Resend | null> {
  const apiKeyRecord = await db.query.userApiKeys.findFirst({
    where: and(
      eq(userApiKeys.userId, userId),
      eq(userApiKeys.provider, "Resend")
    )
  });

  if (!apiKeyRecord) return resend || null;

  try {
    const decryptedKey = await decrypt(apiKeyRecord.encryptedKey);
    return new Resend(decryptedKey);
  } catch {
    console.error("Failed to decrypt Resend API key for user:", userId);
    return null;
  }
}
