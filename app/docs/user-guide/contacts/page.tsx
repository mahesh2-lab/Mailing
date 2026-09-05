import { DocsPager } from "@/components/docs/pager";

export default function UserGuideContacts() {
  return (
    <div className="prose prose-zinc prose-headings:text-black prose-p:text-black prose-strong:text-black prose-li:text-black text-black max-w-none">
      <h1 className="font-black text-4xl mb-4">Contacts &amp; Address Book</h1>
      <p className="lead text-xl text-zinc-500 mb-8">
        Mailing keeps track of the people you talk to so you don't have to manually manage an address book.
      </p>

      <h2 className="mt-12 mb-6">Automatic Contact Creation</h2>
      <p>
        Unlike traditional email clients where you must manually click "Add Contact", Mailing does this automatically. When you send an email to a new address, or receive an email from an unknown sender, Mailing automatically creates a contact record for them in the background.
      </p>

      <h2 className="mt-12 mb-6">Viewing Contact History</h2>
      <p>
        If you navigate to the <strong>Contacts</strong> tab in the sidebar, you'll see a list of everyone you've communicated with.
      </p>
      <p>
        Clicking on a specific contact allows you to:
      </p>
      <ul>
        <li>See all emails sent to and received from that specific person.</li>
        <li>Quickly compose a new email directed to them.</li>
        <li>Update their display name (if they were originally saved as just an email address).</li>
      </ul>

      <DocsPager 
        prev={{ title: "Automations & Workflows", href: "/docs/user-guide/automations" }}
        next={{ title: "Settings & Profile", href: "/docs/user-guide/settings" }}
      />
    </div>
  );
}
