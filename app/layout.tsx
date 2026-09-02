import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { NotificationListener } from "@/components/NotificationListener";
import { PwaRegistration } from "@/components/PwaRegistration";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://mailing.app";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Mailing — Open-source email client powered by Resend",
    template: "%s · Mailing",
  },
  description:
    "Mailing is a free, open-source email client built with Next.js and powered by the Resend SDK. Send, receive, and organise your email with a fast, keyboard-first interface.",
  keywords: [
    "email client",
    "open source",
    "Resend",
    "Next.js",
    "inbox",
    "email app",
    "self-hosted email",
  ],
  authors: [{ name: "Mailing contributors" }],
  creator: "Mailing",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: APP_URL,
    siteName: "Mailing",
    title: "Mailing — Open-source email client powered by Resend",
    description:
      "A fast, keyboard-first email client built with Next.js and the Resend SDK. Free and open-source.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mailing — Open-source email client powered by Resend",
    description:
      "A fast, keyboard-first email client built with Next.js and the Resend SDK. Free and open-source.",
    creator: "@resend",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  appleWebApp: {
    title: "Mailing",
    statusBarStyle: "default",
    capable: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable } ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="bottom-right" richColors closeButton />
        <NotificationListener />
        <PwaRegistration />
      </body>
    </html>
  );
}
