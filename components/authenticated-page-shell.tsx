"use client";

import { ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Inbox, Menu, Sparkles } from "lucide-react";
import MailSidebar from "./mail-sidebar";
import { MailProvider, useMailContext } from "./mail-context";
import ComposePanel from "./compose-panel";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme-toggle";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

function ShellInner({
  title,
  description,
  badge,
  actions,
  children,
  fullWidth = false,
}: {
  title: string;
  description?: string;
  badge?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  fullWidth?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    mobileNavOpen,
    setMobileNavOpen,
    composeOpen,
    setComposeOpen,
    openCompose,
  } = useMailContext();

  // Keyboard shortcut listener for Compose (C) and Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        e.key.toLowerCase() === "c"
      ) {
        e.preventDefault();
        openCompose();
        return;
      }

      if (e.key === "Escape" && composeOpen) {
        setComposeOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [composeOpen, openCompose, setComposeOpen]);

  return (
    <div className="h-screen w-full flex overflow-hidden bg-background text-foreground select-none">
      {/* Persistent Left Sidebar */}
      <MailSidebar hideThemeToggle />

      {/* Mobile Sidebar Backdrop */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-30 bg-background/80 backdrop-blur-xs md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-background">
        {/* Synchronized Header (h-[52px]) matching mail workspace */}
        <header className="h-13 border-b border-border px-4 sm:px-6 flex items-center justify-between gap-4 bg-background/95 backdrop-blur shrink-0 z-10">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Mobile Hamburger to trigger MailSidebar */}
            <Button
              variant="ghost"
              size="icon-xs"
              className="md:hidden size-8 text-muted-foreground hover:text-foreground shrink-0"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Toggle navigation menu"
            >
              <Menu className="size-4" />
            </Button>

            {/* Breadcrumb Navigation */}
            <Breadcrumb>
              <BreadcrumbList className="text-xs">
                <BreadcrumbItem>
                  <BreadcrumbLink
                    render={
                      <button
                        type="button"
                        onClick={() => router.push("/inbox")}
                        className="cursor-pointer font-medium text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Mail
                      </button>
                    }
                  />
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className="font-semibold text-foreground truncate max-w-40 sm:max-w-xs md:max-w-none">
                    {title}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            {badge && <div className="hidden sm:block shrink-0">{badge}</div>}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {actions}

            <Button
              variant="outline"
              size="xs"
              onClick={() => router.push("/inbox")}
              className="hidden sm:inline-flex items-center gap-1.5 h-8 text-xs font-normal text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              <Inbox className="size-3.5" />
              <span>Inbox</span>
            </Button>

            <ThemeToggle />
          </div>
        </header>

        {/* Scrollable Page Body */}
        <main
          key={pathname}
          className={cn(
            "flex-1 overflow-y-auto animate-in fade-in-0 slide-in-from-bottom-1 duration-200 ease-out",
            fullWidth ? "p-0" : "p-4 sm:p-6 lg:p-8"
          )}
        >
          {fullWidth ? (
            <div className="w-full h-full">
              {children}
            </div>
          ) : (
            <div className="max-w-6xl mx-auto space-y-6">
              {children}
            </div>
          )}
        </main>
      </div>

      {/* Floating Compose Window */}
      {composeOpen && <ComposePanel />}
    </div>
  );
}

export function AuthenticatedPageShell(props: {
  title: string;
  description?: string;
  badge?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <MailProvider>
      <ShellInner {...props} />
    </MailProvider>
  );
}

export default AuthenticatedPageShell;
