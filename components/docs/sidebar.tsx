"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Book, Globe, Key, Webhook, Box, Database, FolderTree, Mail, Settings, Home, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const gettingStartedItems = [
  {
    title: "Introduction",  
    href: "/docs",
    icon: Book,
  },
  {
    title: "Setup Domain",
    href: "/docs/setup-domain",
    icon: Globe,
  },
  {
    title: "Setup API Keys",
    href: "/docs/setup-api-keys",
    icon: Key,
  },
  {
    title: "Setup Webhooks",
    href: "/docs/setup-webhooks",
    icon: Webhook,
  },
];

const userGuideItems = [
  {
    title: "Product Overview",
    href: "/docs/user-guide/overview",
    icon: Box,
  },
  {
    title: "Inbox & Emails",
    href: "/docs/user-guide/inbox",
    icon: Mail,
  },
  {
    title: "Automations & Workflows",
    href: "/docs/user-guide/automations",
    icon: Settings,
  },
  {
    title: "Contacts & Address Book",
    href: "/docs/user-guide/contacts",
    icon: FolderTree,
  },
  {
    title: "Settings & Profile",
    href: "/docs/user-guide/settings",
    icon: Database,
  },
];

export function DocsSidebar({ onNavigate }: { onNavigate?: () => void } = {}) {
  const pathname = usePathname();

  const renderNavGroup = (
    title: string,
    items: { title: string; href: string; icon: LucideIcon }[]
  ) => (
    <div className="mb-6">
      <div className="mb-2 px-3">
        <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
          {title}
        </h4>
      </div>
      <ul className="space-y-0.5">
        {items.map((item) => {
          const isActive = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => onNavigate?.()}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <item.icon
                  className={cn(
                    "size-4 shrink-0",
                    isActive ? "text-primary-foreground" : "text-muted-foreground"
                  )}
                />
                <span>{item.title}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <nav className="w-full px-2">
      <div className="mb-6">
        <Link
          href="/"
          onClick={() => onNavigate?.()}
          className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Home className="size-4 text-muted-foreground" />
          <span>Back to App Home</span>
        </Link>
      </div>
      {renderNavGroup("Getting Started", gettingStartedItems)}
      {renderNavGroup("User Guide", userGuideItems)}
    </nav>
  );
}
