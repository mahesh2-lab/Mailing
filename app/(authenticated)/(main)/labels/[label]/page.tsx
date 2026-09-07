import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ label: string }>;
}): Promise<Metadata> {
  const { label } = await params;
  const decoded = decodeURIComponent(label);
  return {
    title: `${decoded} | Mailing`,
    description: `Messages labeled ${decoded}.`,
  };
}

/**
 * Next.js App Router entrypoint for /labels/[label].
 * The UI is rendered in the parent layout to preserve client workspace state across folder switches.
 */
export default function LabelPage() {
  return null;
}
