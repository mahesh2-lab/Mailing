"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
    height: auto !important;
    min-height: 0 !important;
    overflow-y: visible !important;
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
  const [height, setHeight] = useState(300);
  const emailHtml = useMemo(() => prepareEmailHtml(html), [html]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const frame = iframe;

    const resizeObserver = new ResizeObserver(() => syncHeight());
    let observedDocument: Document | null = null;

    function syncHeight() {
      const doc = frame.contentDocument;
      if (!doc?.body) return;
      const contentHeight = Math.ceil(Math.max(doc.body.scrollHeight, doc.body.offsetHeight));
      if (contentHeight > 50) {
        setHeight(contentHeight + 8);
      }
    }

    function observeContent() {
      const doc = frame.contentDocument;
      if (!doc?.body || doc === observedDocument) {
        syncHeight();
        return;
      }
      observedDocument?.removeEventListener("load", syncHeight, true);
      resizeObserver.disconnect();
      observedDocument = doc;
      resizeObserver.observe(doc.body);
      doc.addEventListener("load", syncHeight, true);
      syncHeight();
    }

    frame.addEventListener("load", observeContent);
    observeContent();
    return () => {
      frame.removeEventListener("load", observeContent);
      observedDocument?.removeEventListener("load", syncHeight, true);
      resizeObserver.disconnect();
    };
  }, [emailHtml]);

  return (
    <div className="w-full flex-none rounded-xl border border-border/80 p-[5px] bg-muted/40 dark:bg-muted/20 shadow-2xs isolate">
      <iframe
        ref={iframeRef}
        title={title}
        sandbox="allow-same-origin"
        referrerPolicy="no-referrer"
        srcDoc={emailHtml}
        style={{
          width: "100%",
          height: `${height}px`,
        }}
        className="block w-full border-0 bg-card scheme-light dark:scheme-dark rounded-lg"
      />
    </div>
  );
}
