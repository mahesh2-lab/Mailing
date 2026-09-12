"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CircleHelp,
  Inbox,
  Menu,
  Settings,
  User,
  Users,
  Zap,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Inbox", href: "/inbox", icon: Inbox },
  { label: "Contacts", href: "/contacts", icon: Users },
  { label: "Automations", href: "/automations", icon: Zap },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Profile", href: "/profile", icon: User },
  { label: "Help", href: "/help", icon: CircleHelp },
  { label: "Docs", href: "/docs", icon: BookOpen },
];

export function SiteNav({
  current,
  className,
}: {
  current?: string;
  className?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => {
    if (current) {
      return href.toLowerCase().includes(current.toLowerCase());
    }
    return pathname === href || (href !== "/inbox" && pathname.startsWith(href));
  };

  return (
    <nav
      className={cn(
        "h-14 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 px-4 md:px-6 flex items-center justify-between gap-4 z-20 shrink-0 select-none",
        className
      )}
    >
      <Link
        href="/inbox"
        className="flex items-center gap-2.5 font-semibold text-sm tracking-tight text-foreground transition-opacity hover:opacity-85"
        title="Go to Inbox"
      >
        <span
          className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs shrink-0"
          aria-hidden="true"
        >
          <svg
            width="15"
            height="15"
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
        <span className="font-semibold text-base tracking-tight">Mailing</span>
      </Link>

      {/* Desktop Navigation Links */}
      <div className="hidden md:flex items-center gap-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                buttonVariants({
                  variant: active ? "secondary" : "ghost",
                  size: "sm",
                }),
                "h-8 px-2.5 text-xs gap-1.5 font-medium",
                active && "font-semibold bg-secondary text-secondary-foreground"
              )}
            >
              <Icon className="size-3.5 text-muted-foreground" />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <div className="ml-2 pl-2 border-l border-border">
          <ThemeToggle />
        </div>
      </div>

      {/* Mobile Menu & Theme Toggle */}
      <div className="flex md:hidden items-center gap-1">
        <ThemeToggle />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="size-9 text-muted-foreground hover:text-foreground"
                aria-label="Open navigation menu"
              />
            }
          >
            <Menu className="size-5" />
          </SheetTrigger>
          <SheetContent side="right" className="w-72 p-0 flex flex-col">
            <SheetHeader className="p-4 border-b border-border text-left">
              <SheetTitle className="flex items-center gap-2 text-sm font-semibold">
                <span
                  className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-xs shrink-0"
                  aria-hidden="true"
                >
                  <svg
                    width="13"
                    height="13"
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
                <span>Mailing Navigation</span>
              </SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      buttonVariants({
                        variant: active ? "secondary" : "ghost",
                        size: "sm",
                      }),
                      "w-full justify-start h-9 px-3 gap-3 text-sm",
                      active && "font-semibold bg-secondary text-secondary-foreground"
                    )}
                  >
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
