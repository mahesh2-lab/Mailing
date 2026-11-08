"use client";

import { useEffect, useRef, useState } from "react";

const EMAIL_CSP = `<meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: http: data: blob:; style-src 'unsafe-inline'; font-src data:"><style>html,body{max-width:100%;overflow-x:auto}body{margin:0;font-family:Arial,Helvetica,sans-serif;overflow-wrap:anywhere}img,video,table{max-width:100%!important;height:auto}</style>`;

export function EmailHtmlFrame({ html, title = "Email content" }: { html: string; title?: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState<number>(300);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const syncHeight = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc && doc.body) {
          const contentHeight = Math.max(
            doc.body.scrollHeight,
            doc.documentElement.scrollHeight
          );
          if (contentHeight > 50) {
            setHeight(contentHeight + 20);
          }
          const images = doc.querySelectorAll("img");
          images.forEach((img) => img.addEventListener("load", syncHeight, { once: true }));
        }
      } catch {
        // Fallback for sandboxed restrictions
      }
    };

    iframe.addEventListener("load", syncHeight);
    syncHeight();
    return () => iframe.removeEventListener("load", syncHeight);
  }, [html]);

  return (
    <iframe
      ref={iframeRef}
      title={title}
      sandbox="allow-same-origin"
      referrerPolicy="no-referrer"
      srcDoc={`${EMAIL_CSP}${html}`}
      style={{ height: `${height}px` }}
      className="w-full border-0 bg-white"
    />
  );
}
