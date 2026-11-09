"use client";

import { useMemo, useRef } from "react";

function prepareEmailHtml(rawHtml: string): string {
  // Strip harmful/unsupported scripts
  const cleaned = rawHtml.replace(
    /<script\b[^>]*>[\s\S]*?(?:<\/script\s*>|$)/gi,
    "",
  );

  const injected = `
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: http: data: blob:; style-src 'unsafe-inline'; font-src data: https:;">
<base target="_blank">
<style>
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    overflow-y: auto !important;
    overflow-x: auto !important;
    font-family: Arial, Helvetica, sans-serif;
    overflow-wrap: anywhere;
  }
  img, video {
    max-width: 100% !important;
    height: auto;
  }
  table {
    max-width: 100% !important;
  }
  /* Sleek modern scrollbar */
  ::-webkit-scrollbar {
    width: 7px;
    height: 7px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: rgba(150, 150, 150, 0.35);
    border-radius: 4px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: rgba(150, 150, 150, 0.6);
  }
</style>
`;

  if (/<\/head>/i.test(cleaned)) {
    return cleaned.replace(/<\/head>/i, `${injected}</head>`);
  }
  if (/<head\b[^>]*>/i.test(cleaned)) {
    return cleaned.replace(/<head\b[^>]*>/i, `$&${injected}`);
  }
  if (/<body\b[^>]*>/i.test(cleaned)) {
    return cleaned.replace(/<body\b[^>]*>/i, `<head>${injected}</head>$&`);
  }
  if (/<html\b[^>]*>/i.test(cleaned)) {
    return cleaned.replace(/<html\b[^>]*>/i, `$&<head>${injected}</head>`);
  }
  return `<!DOCTYPE html><html><head>${injected}</head><body>${cleaned}</body></html>`;
}

export function EmailHtmlFrame({
  html,
  title = "Email content",
}: {
  html: string;
  title?: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const emailHtml = useMemo(() => prepareEmailHtml(html), [html]);

  return (
    <div className="w-full h-full flex-1 min-h-0 rounded-xl border border-border/80 p-[5px] bg-muted/40 dark:bg-muted/20 shadow-2xs isolate flex flex-col overflow-hidden">
      <iframe
        ref={iframeRef}
        title={title}
        sandbox="allow-same-origin"
        referrerPolicy="no-referrer"
        srcDoc={emailHtml}
        style={{
          width: "100%",
          height: "100%",
        }}
        className="w-full h-full border-0 bg-card scheme-light dark:scheme-dark block rounded-lg overflow-y-auto"
      />
    </div>
  );
}
