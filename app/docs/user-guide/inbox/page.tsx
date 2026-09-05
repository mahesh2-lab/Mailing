import { DocsPager } from "@/components/docs/pager";

export default function UserGuideInbox() {
  return (
    <div className="prose prose-zinc prose-headings:text-black prose-p:text-black prose-strong:text-black prose-li:text-black text-black max-w-none">
      <h1 className="font-black text-4xl mb-4">Inbox &amp; Emails</h1>
      <p className="lead text-xl text-zinc-500 mb-8">
        Learn how to navigate your inbox, read threads, and compose new messages.
      </p>

      <h2 className="mt-12 mb-6">Navigating the Layout</h2>
      <p>
        The main dashboard is divided into three distinct columns designed to help you power through your emails:
      </p>
      <ol>
        <li><strong>The Sidebar (Left)</strong>: Switch between your Inbox, Drafts, Sent folder, and Trash. You can also access Automations and Settings from here.</li>
        <li><strong>The Thread List (Middle)</strong>: Shows a chronological list of your emails for the selected folder. Unread emails are bolded.</li>
        <li><strong>The Detail Pane (Right)</strong>: Displays the full content of the selected email, allowing you to read the thread and quickly reply.</li>
      </ol>

      <h2 className="mt-12 mb-6">Reading Emails</h2>
      <p>
        Clicking an email in the Thread List instantly loads it in the Detail Pane. If an email is part of a larger conversation, Mailing will automatically group them into a "Thread" so you can read the back-and-forth context without losing your place.
      </p>

      <h2 className="mt-12 mb-6">Composing &amp; Replying</h2>
      <p>
        To start a new email, click the blue <strong>Compose</strong> button in the top left corner of the Sidebar. A panel will open allowing you to specify the recipient, subject, and content. 
      </p>
      <p>
        When you are viewing an email in the Detail Pane, you can click the <strong>Reply</strong> arrow to instantly open the compose window with the context of the previous message quoted.
      </p>

      <DocsPager 
        prev={{ title: "Product Overview", href: "/docs/user-guide/overview" }}
        next={{ title: "Automations & Workflows", href: "/docs/user-guide/automations" }}
      />
    </div>
  );
}
