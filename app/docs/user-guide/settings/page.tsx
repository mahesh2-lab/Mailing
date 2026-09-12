import { DocsPager } from "@/components/docs/pager";

export default function UserGuideSettings() {
  return (
    <div className="prose dark:prose-invert prose-zinc max-w-none text-foreground">
      <h1 className="text-3xl font-bold tracking-tight mb-2">Settings &amp; Profile</h1>
      <p className="lead text-muted-foreground text-base mb-8">
        Manage how you appear to the people you email and update your system preferences.
      </p>

      <h2 className="mt-12 mb-6">Sender Identity</h2>
      <p>
        When you send an email, the recipient sees a "From Name" and a "From Address". You can configure your default sender identity in the <strong>Settings</strong> tab.
      </p>
      <ul>
        <li><strong>Sender Name</strong>: Your full name, or your company's name (e.g., "Jane Doe" or "Acme Corp Support").</li>
        <li><strong>Sender Email</strong>: The email address people will reply to (e.g., "jane@acmecorp.com"). Note that this domain <em>must</em> match the domain you verified in Resend during onboarding, otherwise Resend will block the email.</li>
      </ul>

      <h2 className="mt-12 mb-6">Updating API Keys</h2>
      <p>
        If you ever need to rotate your Resend API keys or update your webhook secrets, you can do this securely from the Settings page. Simply enter the new keys and save. Mailing will automatically encrypt them using your server's secure encryption key before storing them in the database.
      </p>

      <DocsPager 
        prev={{ title: "Contacts & Address Book", href: "/docs/user-guide/contacts" }}
      />
    </div>
  );
}
