"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Book, Globe, Key, Webhook, Box, Database, FolderTree, Mail, Settings, Home } from "lucide-react";
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
    icon: Settings, // Repurposing settings or using another icon
  },
  {
    title: "Contacts & Address Book",
    href: "/docs/user-guide/contacts",
    icon: FolderTree, // Repurposing FolderTree or using another icon
  },
  {
    title: "Settings & Profile",
    href: "/docs/user-guide/settings",
    icon: Database, // Repurposing Database or using another icon
  },
];

export function DocsSidebar() {
  const pathname = usePathname();

  const renderNavGroup = (title: string, items: { title: string; href: string; icon: any }[]) => (
    <div className="mb-8">
      <div className="mb-3 px-4">
        <h4 className="font-semibold text-sm tracking-tight text-zinc-950">{title}</h4>
      </div>
      <ul className="space-y-1">
        {items.map((item) => {
          const isActive = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-4 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-zinc-100/80 text-(--brand)"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                )}
              >
                <item.icon
                  className={cn(
                    "w-4 h-4",
                    isActive ? "text-(--brand)" : "text-zinc-400"
                  )}
                />
                {item.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <nav className="w-full">
      <div className="mb-8 px-2">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-md px-4 py-2 text-sm font-medium transition-colors text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
        >
          <Home className="w-4 h-4 text-zinc-400" />
          Back to App Home
        </Link>
      </div>
      {renderNavGroup("Getting Started", gettingStartedItems)}
      {renderNavGroup("User Guide", userGuideItems)}
    </nav>
  );
}
