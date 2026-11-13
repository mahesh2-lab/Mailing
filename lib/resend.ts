import { Resend } from 'resend';
import { db } from '@/src';
import { userApiKeys } from '@/src/db/schema';
import { and, eq } from 'drizzle-orm';
import { decrypt } from '@/src/lib/crypto';
import dns from 'node:dns';

if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}


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
      } catch (err: unknown) {
        console.error("Failed to decrypt Resend API key for user:", userId, err);
      }
    }
  }

  return null;
}
