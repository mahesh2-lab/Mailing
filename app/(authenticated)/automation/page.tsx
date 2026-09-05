import type { Metadata } from "next";
import { AutomationPage } from "@/components/automations/automation-page";

export const metadata: Metadata = {
  title: "Automations",
  description:
    "Set up rules and workflows to automate repetitive tasks in your Mailing inbox — powered by Resend.",
};

export default function AutomationRoute() {
  return <AutomationPage />;
}
