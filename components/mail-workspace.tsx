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
    toast,
  } = useMailContext();

  const [headerMenu, setHeaderMenu] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  function toggleHeaderMenu(name: string) {
    setHeaderMenu((cur) => (cur === name ? null : name));
  }

  
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
        if (headerMenu) {
          setHeaderMenu(null);
          return;
        }
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
  }, [composeOpen, openId, headerMenu, setComposeOpen, setOpenId]);

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
        <button
          className="icon-button mobile-only"
          aria-label="Open navigation"
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
        >
          <Menu />
        </button>

        <Link href="/inbox" className="wordmark" title="Go to Inbox">
          {}
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
          <Search />
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
          <div className="menu-wrap">
            <button
              className="icon-button"
              aria-label="Notifications"
              onClick={() => toggleHeaderMenu("notifications")}
            >
              <Bell />
            </button>
            {headerMenu === "notifications" && (
              <div className="dropdown">
                <strong>Notifications</strong>
                <span>You&apos;re all caught up.</span>
                <button
                  onClick={() => {
                    setHeaderMenu(null);
                    router.push("/settings");
                  }}
                >
                  Notification settings
                </button>
              </div>
            )}
          </div>

          <div className="menu-wrap">
            <button
              className="topbar-avatar-btn profile-button"
              aria-label="Open profile menu"
              onClick={() => toggleHeaderMenu("profile")}
            >
              {session?.user?.image ? (
                <img
                  src={session.user.image}
                  alt={session.user.name ?? "Profile"}
                  className="topbar-avatar-img"
                />
              ) : (
                <span className="topbar-avatar-initials">
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
                    <User className="w-3.5 h-3.5" />
                  )}
                </span>
              )}
            </button>
            {headerMenu === "profile" && (
              <div className="dropdown profile-menu">
                <div className="profile-menu-identity">
                  {session?.user?.image ? (
                    <img
                      src={session.user.image}
                      alt={session.user.name ?? "Avatar"}
                      className="avatar profile-menu-avatar profile-menu-avatar-img"
                    />
                  ) : (
                    <div className="avatar profile-menu-avatar">
                      {session?.user?.name
                        ? session.user.name
                            .trim()
                            .split(" ")
                            .filter(Boolean)
                            .map((p) => p[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()
                        : "?"}
                    </div>
                  )}
                  <div className="profile-menu-info">
                    <strong>{session?.user?.name ?? "Account"}</strong>
                    <span>{session?.user?.email}</span>
                  </div>
                </div>
                <hr className="profile-menu-divider" />
                <button
                  onClick={() => {
                    setHeaderMenu(null);
                    router.push("/profile");
                  }}
                >
                  Profile
                </button>
                <button
                  onClick={() => {
                    setHeaderMenu(null);
                    router.push("/settings");
                  }}
                >
                  Preferences
                </button>
                <hr className="profile-menu-divider" />
                <button
                  className="signout-btn"
                  onClick={() => {
                    handleLogout();
                  }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
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
