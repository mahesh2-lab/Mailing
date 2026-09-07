import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Starred | Mailing",
  description: "View starred messages.",
};

/**
 * Next.js App Router entrypoint for /starred.
 * The UI is rendered in the parent layout to preserve client workspace state across folder switches.
 */
export default function StarredPage() {
  return null;
}
