import type { Metadata } from "next";
import { SitePage } from "@/components/site-pages";

export const metadata: Metadata = {
  title: "Automation",
  description:
    "Set up rules and workflows to automate repetitive tasks in your Mailing inbox — powered by Resend.",
};

export default function AutomationPage() {
  return <SitePage type="automation" />;
}
