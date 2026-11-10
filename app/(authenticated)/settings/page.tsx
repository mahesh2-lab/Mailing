import type { Metadata } from "next";
import { AuthenticatedPageShell } from "@/components/authenticated-page-shell";
import { SettingsView } from "@/components/settings/settings-view";

export const metadata: Metadata = {
  title: "Settings",
  description:
    "Configure Resend API credentials, sending identities, and workspace security preferences.",
  robots: { index: false, follow: false },
};

export default function SettingsPage() {
  return (
    <AuthenticatedPageShell
      title="Settings"
      description="Configure Resend API credentials, outbound sending profiles, and workspace security."
    >
      <SettingsView />
    </AuthenticatedPageShell>
  );
}
