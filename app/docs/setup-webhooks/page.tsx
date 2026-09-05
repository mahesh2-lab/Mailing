import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { DocsPager } from "@/components/docs/pager";

export default function SetupWebhooksDocs() {
  return (
    <div className="prose prose-zinc prose-headings:text-black prose-p:text-black prose-strong:text-black prose-li:text-black text-black max-w-none">
      
      <h1>Setup Webhooks in Resend</h1>
      <p className="lead">
        Webhooks allow your application to receive real-time updates from Resend when events occur, such as when an email is delivered, bounced, or when you receive a new incoming email.
      </p>

      <h2>1. Navigate to Webhooks</h2>
      <p>
        In the Resend dashboard, go to the <strong>Webhooks</strong> section in the sidebar. If you haven't created any webhooks yet, you will see an empty state. Click on the <strong>Add webhook</strong> button.
      </p>
      <figure>
        <Image 
          src="/image/resend-webhooks-empty.png" 
          alt="Empty Webhooks Page" 
          width={1200} 
          height={675} 
          className="rounded-lg border shadow-sm"
        />
        <figcaption className="text-center text-sm text-muted-foreground mt-2">The Webhooks dashboard</figcaption>
      </figure>

      <h2>2. Configure the Webhook Endpoint</h2>
      <p>
        In the modal that appears, you need to provide the Endpoint URL and select which events you want to listen to.
      </p>
      <figure>
        <Image 
          src="/image/resend-add-webhook-modal.png" 
          alt="Add Webhook Modal" 
          width={1200} 
          height={675} 
          className="rounded-lg border shadow-sm"
        />
        <figcaption className="text-center text-sm text-muted-foreground mt-2">Configuring the webhook URL and events</figcaption>
      </figure>
      
      <h3>Endpoint URL</h3>
      <p>
        This is the public URL of your application where Resend will send POST requests. For this application, the endpoint is typically:
      </p>
      <pre>
        <code>https://your-domain.com/api/webhooks/resend</code>
      </pre>

      <h3>Events to Listen For</h3>
      <p>
        To get full functionality (including real-time notifications for incoming emails and delivery tracking), you should select the following events:
      </p>
      <ul>
        <li><code>email.sent</code></li>
        <li><code>email.delivered</code></li>
        <li><code>email.bounced</code></li>
        <li><code>email.complained</code></li>
      </ul>
      <p>
        If you have configured inbound routing, also select:
      </p>
      <ul>
        <li><code>email.received</code></li>
      </ul>

      <h2>3. Configure Webhook Secret</h2>
      <p>
        After creating the webhook, Resend will generate a <strong>Signing Secret</strong>. This secret is used to verify that the webhook requests are actually coming from Resend.
      </p>
      <p>
        Copy the signing secret from the Resend dashboard and add it to your <code>.env</code> file:
      </p>
      <pre>
        <code>RESEND_WEBHOOK_SECRET="whsec_..."</code>
      </pre>

      <div className="bg-muted p-4 rounded-lg my-4">
        <strong>Testing Locally:</strong> To test webhooks on your local machine, you will need to use a tool like <a href="https://ngrok.com/" target="_blank" rel="noopener noreferrer">ngrok</a> to expose your local server to the internet and use that ngrok URL as the Endpoint URL in Resend.
      </div>
      
      <DocsPager 
        prev={{ title: "Setup API Keys", href: "/docs/setup-api-keys" }}
        next={{ title: "Finish & Go to App", href: "/" }}
      />
    </div>
  );
}
