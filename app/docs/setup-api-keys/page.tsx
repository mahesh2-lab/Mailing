import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { DocsPager } from "@/components/docs/pager";

export default function SetupApiKeysDocs() {
  return (
    <div className="prose prose-zinc prose-headings:text-black prose-p:text-black prose-strong:text-black prose-li:text-black text-black max-w-none">
      
      <h1 className="font-black">Setup API Keys in Resend</h1>
      <p className="lead">
        API keys are required to authenticate your application with Resend so it can send emails and manage webhooks programmatically.
      </p>

      <h2>1. Create a New API Key</h2>
      <p>
        In the Resend dashboard, navigate to the <strong>API keys</strong> section in the sidebar. Click on the <strong>Create API key</strong> button in the top right.
      </p>
      <figure>
        <Image 
          src="/image/resend-add-api-key.png" 
          alt="Create API Key Modal" 
          width={1200} 
          height={675} 
          className="rounded-lg border shadow-sm"
        />
        <figcaption className="text-center text-sm text-muted-foreground mt-2">Configuring the new API Key</figcaption>
      </figure>
      <p>
        In the modal:
      </p>
      <ul>
        <li><strong>Name:</strong> Give your key a descriptive name (e.g., <code>Onboarding</code> or <code>Production</code>).</li>
        <li><strong>Permission:</strong> For sending emails and full functionality, select <code>Full access</code> or restrict it to <code>Sending access</code> depending on your security needs.</li>
        <li><strong>Domain:</strong> Select the domain you want this key to have access to, or choose <code>All domains</code>.</li>
      </ul>

      <h2>2. Copy Your API Key</h2>
      <p>
        Once created, Resend will show you the API key <strong>only once</strong>. Make sure you copy it immediately.
      </p>
      <p>
        Paste this key into your application's <code>.env</code> file:
      </p>
      <pre>
        <code>RESEND_API_KEY="re_123456789..."</code>
      </pre>

      <h2>3. Manage Your API Keys</h2>
      <p>
        You can view your active API keys, their permissions, and when they were last used in the API keys dashboard.
      </p>
      <figure>
        <Image 
          src="/image/resend-api-keys-list.png" 
          alt="API Keys List" 
          width={1200} 
          height={675} 
          className="rounded-lg border shadow-sm"
        />
        <figcaption className="text-center text-sm text-muted-foreground mt-2">The list of active API keys in your account</figcaption>
      </figure>

      <div className="bg-muted p-4 rounded-lg my-4">
        <strong>Security Warning:</strong> Never commit your API keys to version control (e.g., GitHub). Always use environment variables.
      </div>
      
      <DocsPager 
        prev={{ title: "Setup Domain", href: "/docs/setup-domain" }}
        next={{ title: "Setup Webhooks", href: "/docs/setup-webhooks" }}
      />
    </div>
  );
}
