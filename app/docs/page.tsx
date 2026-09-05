import { ArrowRight, Globe, Key, Webhook } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { DocsPager } from "@/components/docs/pager";
import Link from "next/link";

export default function DocsIndex() {
  return (
    <div className="prose prose-zinc prose-headings:text-black prose-p:text-black prose-strong:text-black prose-li:text-black text-black max-w-none">
      <h1 className="font-black text-4xl mb-4">Documentation</h1>
      <p className="lead text-xl text-zinc-500 mb-8">
        Learn how to set up your Resend integration to start sending and receiving emails.
      </p>

      <p>
        Mailing uses <strong>Resend</strong> as its underlying email infrastructure. To get started, you will need to configure your Resend account and provide the necessary API keys and webhooks.
      </p>

      <h2 className="mt-12 mb-6">Quick Links</h2>
      <div className="grid gap-4 sm:grid-cols-3 not-prose">
        <Link href="/docs/setup-domain" className="group block p-4 rounded-xl border border-zinc-200 bg-white hover:border-(--brand) hover:shadow-sm transition-all no-underline">
          <Globe className="w-6 h-6 text-(--brand) mb-3" />
          <h3 className="font-semibold text-zinc-900 group-hover:text-(--brand)">Custom Domain</h3>
          <p className="text-sm text-zinc-500 mt-1">Verify your sending domain.</p>
        </Link>
        <Link href="/docs/setup-api-keys" className="group block p-4 rounded-xl border border-zinc-200 bg-white hover:border-(--brand) hover:shadow-sm transition-all no-underline">
          <Key className="w-6 h-6 text-(--brand) mb-3" />
          <h3 className="font-semibold text-zinc-900 group-hover:text-(--brand)">API Keys</h3>
          <p className="text-sm text-zinc-500 mt-1">Generate secure API keys.</p>
        </Link>
        <Link href="/docs/setup-webhooks" className="group block p-4 rounded-xl border border-zinc-200 bg-white hover:border-(--brand) hover:shadow-sm transition-all no-underline">
          <Webhook className="w-6 h-6 text-(--brand) mb-3" />
          <h3 className="font-semibold text-zinc-900 group-hover:text-(--brand)">Webhooks</h3>
          <p className="text-sm text-zinc-500 mt-1">Receive email replies.</p>
        </Link>
      </div>

      <DocsPager 
        next={{ title: "Setup Domain", href: "/docs/setup-domain" }}
      />
    </div>
  );
}
