import type { Metadata } from "next";
import { SitePage } from "@/components/site-pages";

export const metadata: Metadata = {
  title: "Profile",
  description:
    "Manage your Mailing profile — update your name, avatar, and password.",
  robots: { index: false, follow: false },
};

export default function ProfilePage() {
  return <SitePage type="profile" />;
}
