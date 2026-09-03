"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, Menu, Search, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Folder } from "../hooks/use-mail";
import { MailProvider, useMailContext } from "./mail-context";
import MailSidebar from "./mail-sidebar";
import MailListPane from "./mail-list-pane";
import MailDetailPane from "./mail-detail-pane";
import ComposePanel from "./compose-panel";
import { authClient } from "@/src/lib/auth-client";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";

function AppShell() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const {
    query,
    setQuery,
    mobileNavOpen,
    setMobileNavOpen,
    composeOpen,
    setComposeOpen,
    openCompose,
    openId,
    setOpenId,
  } = useMailContext();

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isInputFocused =
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        (document.activeElement as HTMLElement)?.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

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
  }, [composeOpen, openId, setComposeOpen, setOpenId]);

  async function handleLogout() {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/login");
        },
        onError(context) {
          console.error("Error during sign out:", context.error);
        },
      },
    });
  }

  return (
    <main className="mail-app">
      <header className="topbar">
        <Button
          variant="ghost"
          size="icon"
          className="icon-button mobile-only"
          aria-label="Open navigation"
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
        >
          <Menu className="size-4" />
        </Button>

        <Link href="/inbox" className="wordmark" title="Go to Inbox">
          <span className="mark" aria-hidden="true">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="4" width="20" height="16" rx="3" />
              <path d="M2 7l10 7 10-7" />
            </svg>
          </span>
          <span className="wordmark-text">Mailing</span>
        </Link>

        <div
          className="top-search"
          onClick={() => searchInputRef.current?.focus()}
        >
          <Search className="size-4 text-muted-foreground" />
          <input
            ref={searchInputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search mail"
            aria-label="Search mail"
          />
          <kbd>⌘ K</kbd>
        </div>

        <div className="top-actions">
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="icon-button text-muted-foreground hover:text-foreground"
                  aria-label="Notifications"
                />
              }
            >
              <Bell className="size-4.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 p-2">
              <div className="px-2 py-1.5 font-semibold text-sm">Notifications</div>
              <div className="px-2 py-1 text-xs text-muted-foreground">
                You&apos;re all caught up.
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/settings")}>
                Notification settings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  className="topbar-avatar-btn profile-button cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Open profile menu"
                />
              }
            >
              <Avatar className="size-8">
                {session?.user?.image && (
                  <AvatarImage
                    src={session.user.image}
                    alt={session.user.name ?? "Profile"}
                  />
                )}
                <AvatarFallback className="bg-brand text-brand-fg text-xs font-semibold">
                  {session?.user?.name ? (
                    session.user.name
                      .trim()
                      .split(" ")
                      .filter(Boolean)
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()
                  ) : (
                    <User className="size-3.5" />
                  )}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-2">
              <div className="flex items-center gap-2.5 p-2">
                <Avatar className="size-9">
                  {session?.user?.image && (
                    <AvatarImage
                      src={session.user.image}
                      alt={session.user.name ?? "Avatar"}
                    />
                  )}
                  <AvatarFallback className="bg-brand text-brand-fg text-xs font-semibold">
                    {session?.user?.name ? getInitials(session.user.name) : "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-sm truncate">
                    {session?.user?.name ?? "Account"}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {session?.user?.email}
                  </span>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/profile")}>
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/settings")}>
                Preferences
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => {
                  handleLogout();
                }}
              >
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="workspace">
        <MailSidebar />
        {mobileNavOpen && (
          <div 
            className="sidebar-backdrop visible"
            onClick={() => setMobileNavOpen(false)}
          />
        )}
        <MailListPane />
        <MailDetailPane />
      </div>

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
