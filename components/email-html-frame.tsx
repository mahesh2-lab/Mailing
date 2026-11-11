"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
    box-sizing: border-box;
  }
  /* Prevent email layout tables/wrappers from constraining height or breaking layout */
  body > table, body > div, .body, .wrapper, .email-container, #outlook, #root {
    height: auto !important;
    min-height: 0 !important;
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
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const emailHtml = useMemo(() => prepareEmailHtml(html), [html]);

  const syncHeight = useCallback(() => {
    const frame = iframeRef.current;
    if (!frame) return;

    try {
      const doc = frame.contentDocument;
      if (!doc) return;
      const body = doc.body;
      const htmlEl = doc.documentElement;
      if (!body || !htmlEl) return;

      const candidates: number[] = [
        body.scrollHeight,
        body.offsetHeight,
        htmlEl.scrollHeight,
        htmlEl.offsetHeight,
      ];

      try {
        const bodyRect = body.getBoundingClientRect();
        if (bodyRect.height > 0) candidates.push(bodyRect.height);
        const htmlRect = htmlEl.getBoundingClientRect();
        if (htmlRect.height > 0) candidates.push(htmlRect.height);
      } catch {}

      // Measure child elements inside body (e.g. nested tables, wrapper divs)
      try {
        if (body.children && body.children.length > 0) {
          let maxChildBottom = 0;
          for (let i = 0; i < body.children.length; i++) {
            const child = body.children[i] as HTMLElement;
            if (child && typeof child.getBoundingClientRect === "function") {
              const rect = child.getBoundingClientRect();
              const style = doc.defaultView?.getComputedStyle(child);
              if (style?.position !== "fixed") {
                const offsetBottom = (child.offsetTop || 0) + (child.offsetHeight || 0);
                const rectBottom = rect.bottom;
                const scrollHeight = child.scrollHeight || 0;
                maxChildBottom = Math.max(maxChildBottom, offsetBottom, rectBottom, scrollHeight);
              }
            }
          }
          if (maxChildBottom > 0) candidates.push(maxChildBottom);
        }
      } catch {}

      // Measure images inside doc
      try {
        const images = doc.querySelectorAll("img");
        let maxImgBottom = 0;
        images.forEach((img) => {
          const rect = img.getBoundingClientRect();
          if (rect.bottom > maxImgBottom) maxImgBottom = rect.bottom;
        });
        if (maxImgBottom > 0) candidates.push(maxImgBottom);
      } catch {}

      const valid = candidates.filter((n) => typeof n === "number" && !isNaN(n) && n > 0);
      if (valid.length > 0) {
        const measured = Math.ceil(Math.max(...valid));
        if (measured > 30) {
          setContentHeight((prev) => (prev === measured ? prev : measured + 16));
        }
      }
    } catch {}
  }, []);

  const attachObservers = useCallback(() => {
    const frame = iframeRef.current;
    if (!frame) return () => {};

    const doc = frame.contentDocument;
    if (!doc?.body) return () => {};

    syncHeight();

    // ResizeObserver on body and documentElement
    const resizeObserver = new ResizeObserver(() => syncHeight());
    resizeObserver.observe(doc.body);
    if (doc.documentElement) {
      resizeObserver.observe(doc.documentElement);
    }

    // MutationObserver to detect DOM changes (e.g. injected content, loaded resources)
    const mutationObserver = new MutationObserver(() => syncHeight());
    mutationObserver.observe(doc.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    // Image load / error handlers
    const images = Array.from(doc.querySelectorAll("img"));
    const handleImgLoad = () => syncHeight();
    images.forEach((img) => {
      if (!img.complete) {
        img.addEventListener("load", handleImgLoad, { once: true });
        img.addEventListener("error", handleImgLoad, { once: true });
      }
    });

    // Stepped intervals to catch delayed font / image reflows
    const timeouts = [50, 150, 300, 600, 1200, 2400].map((delay) =>
      setTimeout(syncHeight, delay)
    );

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      images.forEach((img) => {
        img.removeEventListener("load", handleImgLoad);
        img.removeEventListener("error", handleImgLoad);
      });
      timeouts.forEach(clearTimeout);
    };
  }, [syncHeight]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setContentHeight(null);
    const cleanup = attachObservers();
    return cleanup;
  }, [emailHtml, attachObservers]);

  return (
    <div className="w-full min-h-full flex-1 rounded-xl border border-border/80 p-1 bg-muted/40 dark:bg-muted/20 shadow-2xs isolate flex flex-col">
      <iframe
        ref={iframeRef}
        title={title}
        sandbox="allow-same-origin"
        referrerPolicy="no-referrer"
        srcDoc={emailHtml}
        onLoad={attachObservers}
        style={{
          width: "100%",
          height: contentHeight ? `${contentHeight}px` : "100%",
          minHeight: "100%",
        }}
        className="block w-full flex-1 border-0 bg-card scheme-light dark:scheme-dark rounded-lg overflow-y-auto"
      />
    </div>
  );
}
