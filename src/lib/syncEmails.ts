import { db } from "@/src/index";
import { emails } from "@/src/db/schema";
import { getResendClient } from "@/lib/resend";

type EmailInsert = typeof emails.$inferInsert;

function normalizeEmails(
  value: string | string[] | null | undefined,
): string[] {
  if (!value) return [];

  return Array.isArray(value) ? value : [value];
}

export async function syncSentEmails(userId: string) {
  console.log("Fetching sent emails from Resend...");

  let stats = { found: 0, new: 0 };

  const resend = await getResendClient(userId);
  if (!resend) {
    console.error("Resend client not configured for user", userId);
    return stats;
  }

  const { data: response, error } = await resend.emails.list();

  if (error) {
    console.error("Failed to fetch sent emails:", error);

    return stats;
  }

  const sentEmails = response?.data ?? [];
  stats.found = sentEmails.length;
  console.log(`Found ${sentEmails.length} sent emails`);

  for (const email of sentEmails) {
    try {
      const { data: fullEmail, error: emailError } = await resend.emails.get(
        email.id,
      );

      if (emailError || !fullEmail) {
        console.error(`Failed to fetch sent email ${email.id}:`, emailError);

        continue;
      }

      const { data: attachmentsResponse, error: attachmentsError } =
        await resend.emails.attachments.list({
          emailId: email.id,
        });

      if (attachmentsError) {
        console.error(
          `Failed to fetch attachments for ${email.id}:`,
          attachmentsError,
        );
      }

      const attachments =
        attachmentsResponse?.data ?? attachmentsResponse ?? [];

      const emailData: EmailInsert = {
        id: fullEmail.id,
        userId,
        to: normalizeEmails(fullEmail.to),
        from: fullEmail.from,
        createdAt: fullEmail.created_at,
        subject: fullEmail.subject ?? null,
        html: fullEmail.html ?? null,
        text: fullEmail.text ?? null,
        bcc: normalizeEmails(fullEmail.bcc),
        cc: normalizeEmails(fullEmail.cc),
        replyTo: normalizeEmails(fullEmail.reply_to),
        headers: (fullEmail as any).headers ?? {},
        attachments: Array.isArray(attachments)
          ? attachments
          : ((attachments as any)?.data ?? []),
        status: (fullEmail as any).status ?? "sent",
        folder: "sent",
        unread: false,
        starred: false,
        labels: [],
      };

      const inserted = await db.insert(emails).values(emailData).onConflictDoNothing().returning({ id: emails.id });
      if (inserted.length > 0) {
        stats.new += 1;
        console.log(`Synced NEW sent email: ${email.id}`);
      } else {
        console.log(`Sent email already synced: ${email.id}`);
      }
    } catch (error) {
      console.error(`Error syncing sent email ${email.id}:`, error);
    }
  }
  
  return stats;
}

export async function syncReceivedEmails(userId: string) {
  console.log("Fetching received emails from Resend...");

  let stats = { found: 0, new: 0 };

  const resend = await getResendClient(userId);
  if (!resend) {
    console.error("Resend client not configured for user", userId);
    return stats;
  }

  const { data: response, error } = await resend.emails.receiving.list();

  if (error) {
    console.error("Failed to fetch received emails:", error);

    return stats;
  }

  const receivedEmails = response?.data ?? [];
  stats.found = receivedEmails.length;
  console.log(`Found ${receivedEmails.length} received emails`);

  for (const email of receivedEmails) {
    try {
      const { data: fullEmail, error: emailError } =
        await resend.emails.receiving.get(email.id);

      if (emailError || !fullEmail) {
        console.error(
          `Failed to fetch received email ${email.id}:`,
          emailError,
        );

        continue;
      }

      const { data: attachmentsResponse, error: attachmentsError } =
        await resend.emails.receiving.attachments.list({
          emailId: email.id,
        });

      if (attachmentsError) {
        console.error(
          `Failed to fetch received attachments for ${email.id}:`,
          attachmentsError,
        );
      }

      const attachments =
        attachmentsResponse?.data ?? attachmentsResponse ?? [];

      const emailData: EmailInsert = {
        id: fullEmail.id,
        userId,
        to: normalizeEmails(fullEmail.to),
        from: fullEmail.from,
        createdAt: fullEmail.created_at,
        subject: fullEmail.subject ?? null,
        html: fullEmail.html ?? null,
        text: fullEmail.text ?? null,
        bcc: normalizeEmails(fullEmail.bcc),
        cc: normalizeEmails(fullEmail.cc),
        replyTo: normalizeEmails(fullEmail.reply_to),
        headers: fullEmail.headers ?? {},
        attachments: Array.isArray(attachments)
          ? attachments
          : ((attachments as any)?.data ?? []),
        status: "received",
        folder: "inbox",
        unread: true,
        starred: false,
        labels: [],
      };

      const inserted = await db.insert(emails).values(emailData).onConflictDoNothing().returning({ id: emails.id });
      if (inserted.length > 0) {
        stats.new += 1;
        console.log(`Synced NEW received email: ${email.id}`);
      } else {
        console.log(`Received email already synced: ${email.id}`);
      }
    } catch (error) {
      console.error(`Error syncing received email ${email.id}:`, error);
    }
  }
  
  return stats;
}
