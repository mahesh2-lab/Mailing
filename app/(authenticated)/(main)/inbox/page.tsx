import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Inbox | Mailing",
  description: "Your primary inbox — send and receive email powered by Resend.",
};

/**
 * Next.js App Router entrypoint for /inbox.
 * The UI is rendered in the parent layout to preserve client workspace state across folder switches.
 */
export default function InboxPage() {
  return null;
}
