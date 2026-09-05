import type { Metadata } from "next";
import { SitePage } from "@/components/site-pages";

export const metadata: Metadata = {
  title: "Help Center",
  description:
    "Find answers, keyboard shortcuts, and guides for getting the most out of Mailing.",
};

export default function HelpPage() {
  return <SitePage type="help" />;
}
