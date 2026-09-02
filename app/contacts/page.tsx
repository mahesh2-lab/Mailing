import type { Metadata } from "next";
import { SitePage } from "@/components/site-pages";

export const metadata: Metadata = {
  title: "Contacts",
  description:
    "Browse and manage the people you correspond with in Mailing.",
  robots: { index: false, follow: false },
};

export default function ContactsPage() {
  return <SitePage type="contacts" />;
}
