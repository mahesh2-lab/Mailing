import { Globe, Key, Webhook } from "lucide-react";
import { DocsPager } from "@/components/docs/pager";
import Link from "next/link";

export default function DocsIndex() {
  return (
    <div className="prose dark:prose-invert prose-zinc max-w-none text-foreground">
      <h1 className="text-3xl font-bold tracking-tight mb-2">Documentation</h1>
      <p className="text-muted-foreground text-base mb-8">
        Learn how to configure your Resend integration to start sending and receiving emails.
      </p>

      <p>
        Mailing uses <strong>Resend</strong> as its underlying email infrastructure. To get started, you will need to configure your Resend account and provide the necessary API keys and webhooks.
      </p>

      <h2 className="text-xl font-bold tracking-tight mt-10 mb-4">Quick Links</h2>
      <div className="grid gap-4 sm:grid-cols-3 not-prose">
        <Link
          href="/docs/setup-domain"
          className="group block p-4 rounded-xl border border-border bg-card hover:bg-accent/40 hover:border-primary/40 transition-all no-underline shadow-xs"
        >
          <Globe className="size-5 text-primary mb-2.5" />
          <h3 className="font-semibold text-sm text-foreground">Custom Domain</h3>
          <p className="text-xs text-muted-foreground mt-1">Verify your sending domain.</p>
        </Link>
        <Link
          href="/docs/setup-api-keys"
          className="group block p-4 rounded-xl border border-border bg-card hover:bg-accent/40 hover:border-primary/40 transition-all no-underline shadow-xs"
        >
          <Key className="size-5 text-primary mb-2.5" />
          <h3 className="font-semibold text-sm text-foreground">API Keys</h3>
          <p className="text-xs text-muted-foreground mt-1">Generate secure API keys.</p>
        </Link>
        <Link
          href="/docs/setup-webhooks"
          className="group block p-4 rounded-xl border border-border bg-card hover:bg-accent/40 hover:border-primary/40 transition-all no-underline shadow-xs"
        >
          <Webhook className="size-5 text-primary mb-2.5" />
          <h3 className="font-semibold text-sm text-foreground">Webhooks</h3>
          <p className="text-xs text-muted-foreground mt-1">Receive email replies in real-time.</p>
        </Link>
      </div>

      <DocsPager 
        next={{ title: "Setup Domain", href: "/docs/setup-domain" }}
      />
    </div>
  );
}
