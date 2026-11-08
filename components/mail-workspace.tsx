"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Inbox,
  MoreHorizontal,
  Send,
  SquarePen,
  Star,
} from "lucide-react";
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
    folder,
    setFolder,
    label,
    setLabel,
  } = useMailContext();
  const router = useRouter();

  function navigateToFolder(nextFolder: Folder) {
    setFolder(nextFolder);
    setLabel(undefined);
    setOpenId(null);
    router.push(`/${nextFolder.toLowerCase()}`, { scroll: false });
  }

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
    <main className="h-dvh w-full max-md:pt-[env(safe-area-inset-top)] max-md:pb-[env(safe-area-inset-bottom)] max-md:pl-[env(safe-area-inset-left)] max-md:pr-[env(safe-area-inset-right)] flex overflow-hidden bg-background text-foreground">
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

      {!openId && !composeOpen && (
        <>
          <button
            type="button"
            onClick={() => openCompose()}
            aria-label="Compose email"
            className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 hidden size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 max-md:flex"
          >
            <SquarePen className="size-6" />
          </button>

          <nav
            aria-label="Mail navigation"
            className="fixed inset-x-0 bottom-0 z-20 hidden h-[calc(4rem+env(safe-area-inset-bottom))] border-t border-border bg-background/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur supports-backdrop-filter:bg-background/85 max-md:block"
          >
            <div className="grid h-full grid-cols-5 items-center pl-[max(0.25rem,env(safe-area-inset-left))] pr-[max(0.25rem,env(safe-area-inset-right))]">
              {([
                ["Inbox", Inbox],
                ["Starred", Star],
                ["Sent", Send],
                ["Drafts", FileText],
              ] as const).map(([item, Icon]) => {
                const active = folder === item && !label;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => navigateToFolder(item)}
                    aria-current={active ? "page" : undefined}
                    className={`flex h-full flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}
                  >
                    <Icon className="size-5" />
                    <span>{item}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                aria-expanded={mobileNavOpen}
                aria-label="More folders and settings"
                className={`flex h-full flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium transition-colors ${label || folder === "Archive" || folder === "Trash" ? "text-primary" : "text-muted-foreground"}`}
              >
                <MoreHorizontal className="size-5" />
                <span>More</span>
              </button>
            </div>
          </nav>
        </>
      )}

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
