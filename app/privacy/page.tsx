import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-background px-5 py-12 text-foreground sm:py-16">
      <article className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-3 border-b border-border pb-6">
          <Link href="/login" className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">Back to Mailing</Link>
          <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">Last updated November 11, 2026</p>
        </header>

        <div className="space-y-7 text-sm leading-7 text-muted-foreground">
          <p>
            Mailing is open-source email software that can be self-hosted. The person or organization operating the instance you use (“the operator”) controls its hosting, configuration, and data. This policy describes data the Mailing software handles; an operator may have additional privacy terms for its deployment.
          </p>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Information the app handles</h2>
            <p>Mailing stores account details such as your name and email address, plus authentication records and session data needed to sign you in.</p>
            <p>When configured, it stores email messages and related details such as sender and recipient addresses, message content, timestamps, labels, attachments, contacts, and automation workflows in the operator’s database.</p>
            <p>Mailing stores Resend API keys and webhook secrets encrypted at rest using the instance’s encryption key. Email content is stored in the configured database and is not encrypted by this feature.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">How information is used and shared</h2>
            <p>The app uses this information to authenticate users, display and sync mail, send messages, run automations, and deliver real-time updates.</p>
            <p>Mailing integrates with Resend for email sending, receiving, and delivery events, and Pusher for real-time updates. An operator may configure an AI provider for automation features. Those services process information needed for the features the operator enables; review their policies and the operator’s configuration for details.</p>
            <p>Email content and recipient details are shared with the email provider and message recipients when you send or sync messages. The operator may also access data stored in or processed by the instance.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Cookies and browser storage</h2>
            <p>Authentication uses session cookies. The app may store interface preferences, such as density and reduced-motion choice, in your browser’s local storage.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Retention and your choices</h2>
            <p>Data retention depends on the operator’s hosting, database backups, and configuration. Contact the operator of your instance to ask about access, correction, export, or deletion of account data.</p>
            <p>You can remove saved provider credentials in the app’s settings. Clearing browser storage removes local interface preferences but does not delete server-side account or email data.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Changes and contact</h2>
            <p>The operator is responsible for publishing an up-to-date policy for its deployment and responding to privacy requests. For a self-hosted instance, contact the organization that runs it.</p>
          </section>
        </div>

        <footer className="flex gap-5 border-t border-border pt-5 text-xs text-muted-foreground">
          <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">Terms of Service</Link>
          <Link href="/login" className="underline underline-offset-4 hover:text-foreground">Sign in</Link>
        </footer>
      </article>
    </main>
  );
}
