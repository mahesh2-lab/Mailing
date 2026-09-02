import type { Metadata } from "next";
import { NotFoundPage } from "@/components/site-pages";

export const metadata: Metadata = {
  title: "Page not found",
  description: "The page you're looking for doesn't exist. Return to your Mailing inbox.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return <NotFoundPage />;
}
