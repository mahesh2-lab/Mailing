import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Drafts | Mailing",
  description: "View and continue editing email drafts.",
};

/**
 * Next.js App Router entrypoint for /drafts.
 * The UI is rendered in the parent layout to preserve client workspace state across folder switches.
 */
export default function DraftsPage() {
  return null;
}
