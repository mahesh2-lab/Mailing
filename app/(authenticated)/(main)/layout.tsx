import type { Metadata } from "next";
import MailWorkspace from "@/components/mail-workspace";

export const metadata: Metadata = {
  title: "Inbox",
  description:
    "Your Mailing inbox — send and receive email powered by the Resend SDK.",
  robots: { index: false, follow: false },
};

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MailWorkspace />
      <div style={{ display: "none" }}>{children}</div>
    </>
  );
}   
