import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trash | Mailing",
  description: "View and restore deleted messages.",
};

/**
 * Next.js App Router entrypoint for /trash.
 * The UI is rendered in the parent layout to preserve client workspace state across folder switches.
 */
export default function TrashPage() {
  return null;
}
