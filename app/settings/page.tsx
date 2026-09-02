import type { Metadata } from "next";
import { SitePage } from "@/components/site-pages";

export const metadata: Metadata = {
  title: "Settings",
  description:
    "Adjust your Mailing preferences — display name, theme, and notifications.",
  robots: { index: false, follow: false },
};

export default function SettingsPage() {
  return <SitePage type="settings" />;
}
