import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create account",
  description:
    "Create a free Mailing account — an open-source email client powered by the Resend SDK.",
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
