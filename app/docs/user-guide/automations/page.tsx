import { DocsPager } from "@/components/docs/pager";

export default function UserGuideAutomations() {
  return (
    <div className="prose prose-zinc prose-headings:text-black prose-p:text-black prose-strong:text-black prose-li:text-black text-black max-w-none">
      <h1 className="font-black text-4xl mb-4">Automations &amp; Workflows</h1>
      <p className="lead text-xl text-zinc-500 mb-8">
        Mailing's superpower is its visual automation builder. You can construct powerful logic flows to automatically process your incoming email.
      </p>

      <h2 className="mt-12 mb-6">How it Works</h2>
      <p>
        An automation consists of a series of connected "nodes". Every automation starts with a <strong>Trigger</strong>, followed by one or more <strong>Actions</strong>.
      </p>
      
      <ul>
        <li><strong>Triggers</strong>: The event that starts the workflow. Currently, the primary trigger is "When an email is received."</li>
        <li><strong>Actions</strong>: The tasks performed after the trigger. Actions can include Artificial Intelligence tasks (like summarizing an email), or standard tasks like moving an email to a folder.</li>
      </ul>

      <h2 className="mt-12 mb-6">Building an AI Auto-Responder</h2>
      <p>
        Imagine you run a support desk and want AI to draft replies to incoming questions. You can build this in three clicks:
      </p>
      
      <ol>
        <li>Navigate to the Automations tab and click <strong>Create Automation</strong>.</li>
        <li>Drag the <strong>Email Received</strong> trigger onto the canvas.</li>
        <li>Drag the <strong>AI Draft Reply</strong> action onto the canvas.</li>
        <li>Connect the output port of the Trigger to the input port of the Action.</li>
        <li>Click <strong>Save &amp; Enable</strong>.</li>
      </ol>

      <p>
        Now, every time a new email arrives, Mailing will read the email, use AI to construct an appropriate response, and place it in your <strong>Drafts</strong> folder for your final approval.
      </p>

      <DocsPager 
        prev={{ title: "Inbox & Emails", href: "/docs/user-guide/inbox" }}
        next={{ title: "Contacts & Address Book", href: "/docs/user-guide/contacts" }}
      />
    </div>
  );
}
