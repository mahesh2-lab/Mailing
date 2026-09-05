import { DocsPager } from "@/components/docs/pager";

export default function UserGuideOverview() {
  return (
    <div className="prose prose-zinc prose-headings:text-black prose-p:text-black prose-strong:text-black prose-li:text-black text-black max-w-none">
      <h1 className="font-black text-4xl mb-4">Product Overview</h1>
      <p className="lead text-xl text-zinc-500 mb-8">
        Welcome to Mailing! This guide will help you understand what Mailing is and how to get the most out of your self-hosted email client.
      </p>

      <h2 className="mt-12 mb-6">What is Mailing?</h2>
      <p>
        Mailing is a modern, self-hosted email client designed for individuals and teams who want full control over their email infrastructure. It connects directly to your <strong>Resend</strong> account, meaning you own the sending and receiving pipelines without paying for a traditional email provider seat.
      </p>
      
      <p>
        Unlike a standard inbox, Mailing is built with automation in mind. You can visually build workflows that use Artificial Intelligence to summarize incoming emails, automatically draft replies, or categorize messages based on their intent.
      </p>

      <h2 className="mt-12 mb-6">Key Features</h2>
      <ul>
        <li><strong>Real-time Inbox</strong>: See emails appear the second they arrive, just like a chat application.</li>
        <li><strong>Visual Automations</strong>: Build complex rules with a drag-and-drop node editor.</li>
        <li><strong>AI Native</strong>: Let AI read and draft your emails for you.</li>
        <li><strong>Address Book</strong>: Mailing automatically learns your contacts as you email them.</li>
        <li><strong>Multi-tenant</strong>: Invite your team members, giving each their own isolated inbox and API keys.</li>
      </ul>

      <p className="mt-8">
        Ready to learn how to use it? Let's dive into managing your Inbox.
      </p>

      <DocsPager 
        prev={{ title: "Setup Webhooks", href: "/docs/setup-webhooks" }}
        next={{ title: "Inbox & Emails", href: "/docs/user-guide/inbox" }}
      />
    </div>
  );
}
