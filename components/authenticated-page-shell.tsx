"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Inbox, LogOut, Menu, PanelLeftClose, PanelLeftOpen } from "@/components/animate-ui/icons";
import MailSidebar from "./mail-sidebar";
import { MailProvider, useMailContext } from "./mail-context";
import ComposePanel from "./compose-panel";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme-toggle";
import { authClient } from "@/src/lib/auth-client";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import { AnimatePresence } from "motion/react";
import { ReducedMotionConfig } from "@animate-ui/react/utils/motion";

export interface AuthenticatedPageShellProps {
  title: string;
  badge?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  fullWidth?: boolean;
  hideSidebar?: boolean;
}

function ShellInner({
  title,
  badge,
  actions,
  children,
  fullWidth = false,
  hideSidebar: hideSidebarProp,
}: AuthenticatedPageShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isAutomationEditor =
    Boolean(pathname?.startsWith("/automations/") && pathname !== "/automations");
  const shouldHideSidebarDefault =
    hideSidebarProp !== undefined ? hideSidebarProp : isAutomationEditor;

  const [sidebarVisible, setSidebarVisible] = useState(!shouldHideSidebarDefault);

  useEffect(() => {
    setSidebarVisible(!shouldHideSidebarDefault);
  }, [shouldHideSidebarDefault]);

  const {
    mobileNavOpen,
    setMobileNavOpen,
    composeOpen,
    setComposeOpen,
    openCompose,
  } = useMailContext();

  // Keyboard shortcut listener for Compose (C), Sidebar toggle ([, Cmd/Ctrl+B) and Escape
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
        e.key === "[" ||
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b")
      ) {
        e.preventDefault();
        setSidebarVisible((prev) => !prev);
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

  const handleLogout = async () => {
    try {
      await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            toast.success("Signed out successfully");
            router.push("/login");
          },
        },
      });
    } catch {
      toast.error("Failed to sign out");
    }
  };

  return (
    <div className="h-dvh w-full max-md:pt-[env(safe-area-inset-top)] max-md:pb-[env(safe-area-inset-bottom)] max-md:pl-[env(safe-area-inset-left)] max-md:pr-[env(safe-area-inset-right)] flex overflow-hidden bg-background text-foreground select-none">
      {/* Left Sidebar */}
      <div
        className={cn(
          "h-full shrink-0 flex transition-all duration-200",
          !sidebarVisible && "hidden"
        )}
      >
        <MailSidebar hideThemeToggle />
      </div>

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
              className="md:hidden size-11 text-muted-foreground hover:text-foreground shrink-0"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Toggle navigation menu"
            >
              <Menu className="size-4" />
            </Button>

            {/* Desktop Sidebar Toggle */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="hidden md:inline-flex size-8 text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                    onClick={() => setSidebarVisible((v) => !v)}
                    aria-label={sidebarVisible ? "Hide sidebar ([)" : "Show sidebar ([)"}
                  >
                    {sidebarVisible ? (
                      <PanelLeftClose className="size-4" />
                    ) : (
                      <PanelLeftOpen className="size-4" />
                    )}
                  </Button>
                }
              />
              <TooltipContent side="bottom">
                {sidebarVisible ? "Hide sidebar ([)" : "Show sidebar ([)"}
              </TooltipContent>
            </Tooltip>

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

            <Button
              variant="ghost"
              size="xs"
              onClick={handleLogout}
              className="h-8 px-2.5 text-xs font-normal gap-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
              title="Sign out of account"
              aria-label="Sign out"
            >
              <LogOut className="size-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
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
      <ReducedMotionConfig>
        <AnimatePresence>
          {composeOpen && <ComposePanel key="compose" />}
        </AnimatePresence>
      </ReducedMotionConfig>
    </div>
  );
}

export function AuthenticatedPageShell(props: AuthenticatedPageShellProps) {
  return (
    <MailProvider>
      <ShellInner {...props} />
    </MailProvider>
  );
}

export default AuthenticatedPageShell;
