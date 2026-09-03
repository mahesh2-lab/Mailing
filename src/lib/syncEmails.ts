import { db } from "@/src/index";
import { emails } from "@/src/db/schema";
import { resend } from "@/lib/resend";

type EmailInsert = typeof emails.$inferInsert;

function normalizeEmails(
  value: string | string[] | null | undefined,
): string[] {
  if (!value) return [];

  return Array.isArray(value) ? value : [value];
}

export async function syncSentEmails() {
  console.log("Fetching sent emails from Resend...");

  const { data: response, error } = await resend.emails.list();

  if (error) {
    console.error("Failed to fetch sent emails:", error);

    return;
  }

  const sentEmails = response?.data ?? [];

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

      await db.insert(emails).values(emailData).onConflictDoNothing();

      console.log(`Synced sent email: ${email.id}`);
    } catch (error) {
      console.error(`Error syncing sent email ${email.id}:`, error);
    }
  }
}

export async function syncReceivedEmails() {
  console.log("Fetching received emails from Resend...");

  const { data: response, error } = await resend.emails.receiving.list();

  if (error) {
    console.error("Failed to fetch received emails:", error);

    return;
  }

  const receivedEmails = response?.data ?? [];

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

      await db.insert(emails).values(emailData).onConflictDoNothing();

      console.log(`Synced received email: ${email.id}`);
    } catch (error) {
      console.error(`Error syncing received email ${email.id}:`, error);
    }
  }
}
