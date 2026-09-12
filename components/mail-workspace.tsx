"use client";

import { useEffect, useRef } from "react";
import { Folder } from "../hooks/use-mail";
import { MailProvider, useMailContext } from "./mail-context";
import MailSidebar from "./mail-sidebar";
import MailListPane from "./mail-list-pane";
import MailDetailPane from "./mail-detail-pane";
import ComposePanel from "./compose-panel";

function AppShell() {
  const {
    mobileNavOpen,
    setMobileNavOpen,
    composeOpen,
    setComposeOpen,
    openCompose,
    openId,
    setOpenId,
  } = useMailContext();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isInputFocused =
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        (document.activeElement as HTMLElement)?.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        openCompose();
        return;
      }

      if (
        !isInputFocused &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        e.key.toLowerCase() === "c"
      ) {
        e.preventDefault();
        openCompose();
        return;
      }

      if (e.key === "Escape") {
        if (composeOpen) {
          setComposeOpen(false);
          return;
        }
        if (openId) {
          setOpenId(null);
          return;
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [composeOpen, openId, setComposeOpen, setOpenId, openCompose]);

  return (
    <main className="h-screen w-full flex overflow-hidden bg-background text-foreground">
      {/* 3-Pane Shadcn Mail Structure with synchronized h-[52px] headers */}
      <MailSidebar />

      {/* Mobile Navigation Drawer Backdrop */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-30 bg-background/80 backdrop-blur-xs md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <MailListPane />
      <MailDetailPane />

      {/* Floating Compose Panel */}
      {composeOpen && <ComposePanel />}
    </main>
  );
}

export default function MailWorkspace({
  initialFolder,
  initialLabel,
}: {
  initialFolder?: Folder;
  initialLabel?: string;
}) {
  return (
    <MailProvider initialFolder={initialFolder} initialLabel={initialLabel}>
      <AppShell />
    </MailProvider>
  );
}
