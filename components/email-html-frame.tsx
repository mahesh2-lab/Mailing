"use client";

const EMAIL_CSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: http: data: blob:; style-src 'unsafe-inline'; font-src data:"><style>body{margin:0;font-family:Arial,Helvetica,sans-serif}</style>`;

export function EmailHtmlFrame({ html, title = "Email content" }: { html: string; title?: string }) {
  return (
    <iframe
      title={title}
      sandbox=""
      referrerPolicy="no-referrer"
      srcDoc={`${EMAIL_CSP}${html}`}
      className="h-[260px] w-full border-0 bg-white"
    />
  );
}
