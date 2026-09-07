import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Archive | Mailing",
  description: "View archived messages.",
};

/**
 * Next.js App Router entrypoint for /archive.
 * The UI is rendered in the parent layout to preserve client workspace state across folder switches.
 */
export default function ArchivePage() {
  return null;
}
