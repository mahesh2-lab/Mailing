import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { DocsPager } from "@/components/docs/pager";

export default function SetupDomainDocs() {
  return (
    <div className="prose prose-zinc prose-headings:text-black prose-p:text-black prose-strong:text-black prose-li:text-black text-black max-w-none">
      
      <h1>Setup Custom Domain in Resend</h1>
      <p className="lead">
        To send and receive emails from your own domain (e.g., <code>you@yourdomain.com</code>), you need to verify it within Resend.
      </p>

      <h2>1. Add a New Domain</h2>
      <p>
        Log into your Resend dashboard and navigate to the <strong>Domains</strong> section in the sidebar. Click on the <strong>Add domain</strong> button.
      </p>
      <figure>
        <Image 
          src="/image/resend-add-domain.png" 
          alt="Add Domain Button in Resend" 
          width={1200} 
          height={675} 
          className="rounded-lg border shadow-sm"
        />
        <figcaption className="text-center text-sm text-muted-foreground mt-2">Clicking the 'Add domain' button</figcaption>
      </figure>

      <h2>2. Enter Domain Details</h2>
      <p>
        In the modal that appears, enter your domain name (e.g., <code>heymail.com</code>) and select a region closest to your primary user base.
      </p>
      <figure>
        <Image 
          src="/image/resend-domain-form.png" 
          alt="Entering Domain Name" 
          width={1200} 
          height={675} 
          className="rounded-lg border shadow-sm"
        />
        <figcaption className="text-center text-sm text-muted-foreground mt-2">Filling out the domain name form</figcaption>
      </figure>

      <h2>3. Add DNS Records</h2>
      <p>
        After adding your domain, Resend will provide you with several DNS records (DKIM, SPF, DMARC) that you must add to your domain registrar (e.g., Vercel, Cloudflare, GoDaddy).
      </p>
      <figure>
        <Image 
          src="/image/resend-dns-records.png" 
          alt="DNS Records to Configure" 
          width={1200} 
          height={675} 
          className="rounded-lg border shadow-sm"
        />
        <figcaption className="text-center text-sm text-muted-foreground mt-2">The DNS records provided by Resend</figcaption>
      </figure>
      <div className="bg-muted p-4 rounded-lg my-4">
        <strong>Tip:</strong> If you are managing your DNS through Vercel, these records can usually be added automatically or by pasting them into the DNS settings of your project.
      </div>

      <h2>4. Wait for Verification</h2>
      <p>
        Once you've added the records, the domain will show a <strong>Pending</strong> status as it looks for the DNS records. DNS propagation can sometimes take a few minutes up to a few hours.
      </p>
      <figure>
        <Image 
          src="/image/resend-domain-pending.png" 
          alt="Pending Domain Verification" 
          width={1200} 
          height={675} 
          className="rounded-lg border shadow-sm"
        />
        <figcaption className="text-center text-sm text-muted-foreground mt-2">Pending verification status while DNS propagates</figcaption>
      </figure>
      
      <p>
        Once the status changes to <strong>Verified</strong>, your domain is fully set up and ready to send and receive emails!
      </p>
      
      <DocsPager 
        prev={{ title: "Introduction", href: "/docs" }}
        next={{ title: "Setup API Keys", href: "/docs/setup-api-keys" }}
      />
    </div>
  );
}
