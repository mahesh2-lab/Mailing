import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen bg-background px-5 py-12 text-foreground sm:py-16">
      <article className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-3 border-b border-border pb-6">
          <Link href="/login" className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">Back to Mailing</Link>
          <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
          <p className="text-sm text-muted-foreground">Last updated November 11, 2026</p>
        </header>

        <div className="space-y-7 text-sm leading-7 text-muted-foreground">
          <p>
            Mailing is open-source email software. If you use a hosted instance, these terms are subject to any additional terms provided by its operator. If you run Mailing yourself, you are the operator and are responsible for your deployment and its users.
          </p>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Your account and configuration</h2>
            <p>Keep your sign-in credentials and provider API keys secure. You are responsible for activity performed through your account and for configuring authorized sending domains and integrations.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Email and automation use</h2>
            <p>Use the app only for lawful purposes and only send messages to recipients you are authorized to contact. You are responsible for your message content, recipients, and compliance with rules that apply to your use.</p>
            <p>Automations can send messages or perform other configured actions. Review workflows before enabling them. Email delivery depends on external providers and recipient systems, so Mailing cannot guarantee delivery or timing.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Availability and changes</h2>
            <p>Features depend on the instance operator, infrastructure, and third-party services. Operators may change, suspend, or discontinue their deployments. Open-source software is provided subject to its repository license; these terms do not replace that license.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Questions</h2>
            <p>For a hosted instance, contact its operator about service or account questions. For a self-hosted instance, contact the person or organization that administers it.</p>
          </section>
        </div>

        <footer className="flex gap-5 border-t border-border pt-5 text-xs text-muted-foreground">
          <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">Privacy Policy</Link>
          <Link href="/login" className="underline underline-offset-4 hover:text-foreground">Sign in</Link>
        </footer>
      </article>
    </main>
  );
}
