"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Archive,
  BookOpen,
  ChevronsUpDown,
  CircleHelp,
  Copy,
  ExternalLink,
  FileText,
  Inbox,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Send,
  Settings,
  SquarePen,
  Star,
  Tag,
  Trash2,
  User,
  Users,
  X,
  Zap,
} from "lucide-react";
import axios from "axios";
import { Folder, MailItem } from "../hooks/use-mail";
import { useMailContext } from "./mail-context";
import ConfirmDialog from "./confirm-dialog";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ThemeToggle } from "./theme-toggle";
import { authClient } from "@/src/lib/auth-client";
import { getInitials, cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";

const folderIcons: Record<Folder, typeof Inbox> = {
  Inbox,
  Starred: Star,
  Sent: Send,
  Drafts: FileText,
  Archive,
  Trash: Trash2,
};

const folderRoutes: Record<Folder, string> = {
  Inbox: "/inbox",
  Starred: "/starred",
  Sent: "/sent",
  Drafts: "/drafts",
  Archive: "/archive",
  Trash: "/trash",
};

export interface LabelData {
  id: string;
  name: string;
  color?: string | null;
  count: number;
}

const DEFAULT_LABEL_NAMES = ["Important", "Work", "Personal"];

function useMailSummary(refreshTick: number) {
  const [allMail, setAllMail] = useState<MailItem[]>([]);
  const [labels, setLabels] = useState<LabelData[]>([]);

  useEffect(() => {
    let mounted = true;
    axios
      .get("/api/v1/messages")
      .then((res) => {
        if (!mounted) return;
        const mapped: MailItem[] = (res.data || []).map((e: any) => ({
          id: e.id,
          sender: {
            name: e.from?.split("<")[0].trim() || e.from || "Unknown",
            email: e.from || "",
          },
          subject: e.subject || "",
          preview: "",
          rawText: e.text || "",
          rawHtml: e.html || "",
          body: e.html || e.text || "",
          timestamp: e.createdAt || e.created_at || "",
          folder: e.folder,
          status: e.status,
          unread: e.unread ?? false,
          starred: e.starred ?? false,
          labels: e.labels || [],
          attachments: (e.attachments || []).map((a: any) => ({
            id: a.id,
            filename: a.filename,
            sizeBytes: a.size || 0,
            url: a.download_url || "#",
            type: a.content_type || "application/octet-stream",
          })),
        }));
        setAllMail(mapped);
      })
      .catch(() => {});

    axios
      .get("/api/v1/labels")
      .then((res) => {
        if (!mounted) return;
        setLabels(res.data || []);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [refreshTick]);

  const counts = useMemo<Record<string, number>>(() => {
    const res: Record<string, number> = {
      Inbox: allMail.filter(
        (m) => (m.folder?.toLowerCase() === "inbox" || !m.folder) && m.unread,
      ).length,
      Starred: allMail.filter(
        (m) => m.starred && m.folder?.toLowerCase() !== "trash" && m.unread,
      ).length,
      Sent: allMail.filter(
        (m) => m.folder?.toLowerCase() === "sent" && m.unread,
      ).length,
      Drafts: allMail.filter(
        (m) =>
          (m.folder?.toLowerCase() === "drafts" ||
            m.status?.toLowerCase() === "draft" ||
            m.labels?.includes("Draft")) &&
          m.unread,
      ).length,
      Archive: allMail.filter(
        (m) => m.folder?.toLowerCase() === "archive" && m.unread,
      ).length,
      Trash: allMail.filter(
        (m) => m.folder?.toLowerCase() === "trash" && m.unread,
      ).length,
    };

    for (const lbl of labels) {
      res[lbl.name] = allMail.filter(
        (m) =>
          Array.isArray(m.labels) &&
          m.labels.includes(lbl.name) &&
          m.folder?.toLowerCase() !== "trash" &&
          m.unread,
      ).length;
    }

    return res;
  }, [allMail, labels]);

  return { counts, labels };
}

export interface MailSidebarProps {
  hideThemeToggle?: boolean;
}

export default function MailSidebar({
  hideThemeToggle,
}: MailSidebarProps = {}) {
  const router = useRouter();
  const pathname = usePathname() || "";
  const { data: session } = authClient.useSession();
  const [, startTransition] = useTransition();

  const isMailRoute =
    pathname === "/" ||
    pathname === "/inbox" ||
    pathname.startsWith("/labels/") ||
    pathname === "/starred" ||
    pathname === "/sent" ||
    pathname === "/drafts" ||
    pathname === "/archive" ||
    pathname === "/trash";

  const shouldHideThemeToggle = hideThemeToggle ?? !isMailRoute;
  const {
    folder,
    setFolder,
    label,
    setLabel,
    setOpenId,
    openCompose,
    mobileNavOpen,
    setMobileNavOpen,
    sidebarCollapsed,
    setSidebarCollapsed,
    toggleSidebar,
    refreshTick,
    refresh,
  } = useMailContext();

  const { counts, labels } = useMailSummary(refreshTick);

  const [creatingLabel, setCreatingLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [creatingLoading, setCreatingLoading] = useState(false);
  const [deleteLabelTarget, setDeleteLabelTarget] = useState<string | null>(
    null,
  );
  const [navigatingKey, setNavigatingKey] = useState<string | null>(null);

  // Clear navigating state when the active route, folder, or label updates
  useEffect(() => {
    setNavigatingKey(null);
  }, [pathname, folder, label]);

  // Fallback timeout so navigating animation never gets stuck
  useEffect(() => {
    if (!navigatingKey) return;
    const timer = setTimeout(() => {
      setNavigatingKey(null);
    }, 1500);
    return () => clearTimeout(timer);
  }, [navigatingKey]);

  function selectFolder(name: Folder) {
    setNavigatingKey(`folder:${name}`);
    startTransition(() => {
      setFolder(name);
      setLabel(undefined);
      setOpenId(null);
      setMobileNavOpen(false);
      router.push(folderRoutes[name], { scroll: false });
    });
  }

  function selectLabel(name: string) {
    setNavigatingKey(`label:${name}`);
    startTransition(() => {
      setLabel(name);
      setFolder(undefined);
      setOpenId(null);
      setMobileNavOpen(false);
      router.push(`/labels/${encodeURIComponent(name)}`, { scroll: false });
    });
  }

  function navigateTo(path: string) {
    setNavigatingKey(`path:${path}`);
    startTransition(() => {
      setMobileNavOpen(false);
      router.push(path);
    });
  }

  async function handleCreateLabel(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newLabelName.trim();
    if (!trimmed) return;

    setCreatingLoading(true);
    try {
      await axios.post("/api/v1/labels", { name: trimmed });
      toast.success(`Label "${trimmed}" created`);
      setNewLabelName("");
      setCreatingLabel(false);
      refresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to create label");
    } finally {
      setCreatingLoading(false);
    }
  }

  async function handleDeleteLabel() {
    if (!deleteLabelTarget) return;
    const target = deleteLabelTarget;
    setDeleteLabelTarget(null);
    try {
      await axios.delete(`/api/v1/labels/${encodeURIComponent(target)}`);
      toast.success(`Label "${target}" deleted`);
      if (label === target) {
        setLabel(undefined);
        setFolder("Inbox");
        router.push("/inbox", { scroll: false });
      }
      refresh();
    } catch {
      toast.error("Failed to delete label");
    }
  }

  async function handleLogout() {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/login");
        },
      },
    });
  }

  const mergedLabels = useMemo(() => {
    const list = [...labels];
    DEFAULT_LABEL_NAMES.forEach((name) => {
      if (!list.some((l) => l.name.toLowerCase() === name.toLowerCase())) {
        list.push({ id: name, name, count: 0 });
      }
    });
    return list;
  }, [labels]);

  const folderList: Folder[] = [
    "Inbox",
    "Drafts",
    "Sent",
    "Starred",
    "Archive",
    "Trash",
  ];

  const workspaceItems = [
    {
      label: "Contacts",
      path: "/contacts",
      icon: Users,
    },
    {
      label: "Automations",
      badge: "Flows",
      path: "/automations",
      icon: Zap,
    },
    {
      label: "Settings",
      path: "/settings",
      icon: Settings,
    },
    {
      label: "Profile",
      path: "/profile",
      icon: User,
    },
    {
      label: "Help & Support",
      path: "/help",
      icon: CircleHelp,
    },
    {
      label: "Documentation",
      path: "/docs",
      icon: BookOpen,
    },
  ];

  const accountDropdownContent = (
    <DropdownMenuContent
      align="start"
      side={sidebarCollapsed ? "right" : "bottom"}
      className="w-64 p-1.5 shadow-lg border border-border"
    >
      {/* User Profile Summary Card */}
      <div className="flex items-center gap-2.5 px-2.5 py-2 mb-1 rounded-md bg-muted/50 border border-border/40">
        <Avatar className="size-7.5 shrink-0 ring-1 ring-border/60">
          {session?.user?.image && (
            <AvatarImage
              src={session.user.image}
              alt={session.user.name ?? "User"}
            />
          )}
          <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
            {session?.user?.name ? getInitials(session.user.name) : "M"}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-xs font-semibold text-foreground truncate leading-snug">
            {session?.user?.name ?? "Mailing User"}
          </span>
          <span className="text-[10px] text-muted-foreground truncate leading-none">
            {session?.user?.email ?? "active"}
          </span>
        </div>
        <Badge
          variant="secondary"
          className="text-[9px] px-1.5 py-0 h-4 font-normal uppercase tracking-wider shrink-0"
        >
          Pro
        </Badge>
      </div>

      <DropdownMenuGroup>
        <DropdownMenuLabel className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
          Workspace & Account
        </DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => navigateTo("/profile")}
          className="text-xs gap-2.5 px-2 py-1.5 cursor-pointer"
        >
          <User className="size-3.5 text-muted-foreground" />
          <span className="flex-1">Profile details</span>
          <span className="text-[10px] text-muted-foreground/70 font-mono">
            ⌘P
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => navigateTo("/settings")}
          className="text-xs gap-2.5 px-2 py-1.5 cursor-pointer"
        >
          <Settings className="size-3.5 text-muted-foreground" />
          <span className="flex-1">Settings &amp; Keys</span>
          <span className="text-[10px] text-muted-foreground/70 font-mono">
            ⌘S
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => navigateTo("/automations")}
          className="text-xs gap-2.5 px-2 py-1.5 cursor-pointer"
        >
          <Zap className="size-3.5 text-muted-foreground" />
          <span className="flex-1">Workflow Automations</span>
          <span className="text-[10px] text-muted-foreground/70 font-mono">
            ⌘A
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => navigateTo("/contacts")}
          className="text-xs gap-2.5 px-2 py-1.5 cursor-pointer"
        >
          <Users className="size-3.5 text-muted-foreground" />
          <span className="flex-1">Contacts</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => navigateTo("/docs")}
          className="text-xs gap-2.5 px-2 py-1.5 cursor-pointer"
        >
          <BookOpen className="size-3.5 text-muted-foreground" />
          <span className="flex-1">Documentation</span>
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator className="my-1" />
      <DropdownMenuItem
        variant="destructive"
        onClick={handleLogout}
        className="text-xs gap-2.5 px-2 py-1.5 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
      >
        <LogOut className="size-3.5 text-destructive" />
        <span className="flex-1 font-medium">Sign out</span>
        <span className="text-[10px] text-muted-foreground/70 font-mono">
          ⇧⌘Q
        </span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  );

  return (
    <>
      <SidebarProvider
        open={!sidebarCollapsed}
        onOpenChange={(open) => setSidebarCollapsed(!open)}
        openMobile={mobileNavOpen}
        onOpenMobileChange={setMobileNavOpen}
        className="h-full flex shrink-0 w-auto select-none"
      >
        <Sidebar
          collapsible="icon"
          className="border-r border-sidebar-border bg-sidebar/95 backdrop-blur-md"
        >
          {/* Account Switcher Header - strictly h-13 (52px) */}
          <SidebarHeader className="h-13 border-b border-sidebar-border flex items-center justify-center p-2 shrink-0 bg-sidebar/40">
            {sidebarCollapsed ? (
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <DropdownMenuTrigger
                        render={
                          <button
                            type="button"
                            className="flex items-center justify-center size-8 rounded-lg hover:bg-sidebar-accent transition-colors cursor-pointer outline-none relative group/avatar"
                            aria-label="Account menu"
                          />
                        }
                      >
                        <div className="relative">
                          <Avatar className="size-6 shrink-0 ring-1 ring-border/50">
                            {session?.user?.image && (
                              <AvatarImage
                                src={session.user.image}
                                alt={session.user.name ?? "Avatar"}
                              />
                            )}
                            <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-bold">
                              {session?.user?.name
                                ? getInitials(session.user.name)
                                : "M"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full bg-emerald-500 ring-2 ring-sidebar" />
                        </div>
                      </DropdownMenuTrigger>
                    }
                  />
                  <TooltipContent side="right">
                    {session?.user?.name ?? "Account"} (
                    {session?.user?.email ?? "workspace"})
                  </TooltipContent>
                </Tooltip>
                {accountDropdownContent}
              </DropdownMenu>
            ) : (
              <div className="flex items-center justify-between w-full min-w-0 gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <button
                        type="button"
                        className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-sidebar-accent/80 active:scale-[0.98] transition-all w-full text-left outline-none cursor-pointer min-w-0 border border-transparent hover:border-sidebar-border/60"
                        aria-label="Switch account or view profile"
                      />
                    }
                  >
                    <div className="relative shrink-0">
                      <Avatar className="size-6.5 shrink-0 ring-1 ring-border/60">
                        {session?.user?.image && (
                          <AvatarImage
                            src={session.user.image}
                            alt={session.user.name ?? "Avatar"}
                          />
                        )}
                        <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-bold">
                          {session?.user?.name
                            ? getInitials(session.user.name)
                            : "M"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full bg-emerald-500 ring-2 ring-sidebar" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-xs font-semibold text-foreground truncate leading-tight">
                        {session?.user?.name ?? "Mailing User"}
                      </span>
                      <span className="text-[10px] text-muted-foreground/80 truncate leading-tight">
                        {session?.user?.email ?? "workspace"}
                      </span>
                    </div>
                    <ChevronsUpDown className="size-3.5 text-muted-foreground/70 shrink-0 ml-auto" />
                  </DropdownMenuTrigger>
                  {accountDropdownContent}
                </DropdownMenu>

                <div className="flex items-center gap-0.5 shrink-0">
                  {!shouldHideThemeToggle && <ThemeToggle />}
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="md:hidden size-7 text-muted-foreground"
                    onClick={() => setMobileNavOpen(false)}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </SidebarHeader>

          {/* Sidebar Nav Content */}
          <SidebarContent className="p-2 gap-2.5 overflow-y-auto">
            {/* New Message Compose Button */}
            <div className="px-1 pb-1">
              {sidebarCollapsed ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <div className="relative group/compose size-8 mx-auto">
                        <div
                          className="absolute -inset-0.5 rounded-lg bg-primary/30 blur-[5px] opacity-70 group-hover/compose:opacity-100 group-hover/compose:blur-[7px] transition-all duration-300 animate-pulse pointer-events-none"
                          aria-hidden="true"
                        />
                        <Button
                          variant="default"
                          size="icon"
                          onClick={() => {
                            setMobileNavOpen(false);
                            openCompose();
                          }}
                          className="relative size-8 rounded-lg shadow-xs hover:bg-primary/90 cursor-pointer flex items-center justify-center transition-all duration-200 active:scale-95 overflow-hidden"
                          aria-label="New message (C)"
                        >
                          <SquarePen className="size-4 transition-transform duration-300 ease-out group-hover/compose:-rotate-12 group-hover/compose:scale-115" />
                        </Button>
                      </div>
                    }
                  />
                  <TooltipContent side="right">New message (C)</TooltipContent>
                </Tooltip>
              ) : (
                <div className="relative group/compose w-full">
                  <div
                    className="absolute -inset-0.5 rounded-lg bg-primary/25 blur-[6px] opacity-65 group-hover/compose:opacity-100 group-hover/compose:bg-primary/35 group-hover/compose:blur-[8px] transition-all duration-300 animate-pulse pointer-events-none"
                    aria-hidden="true"
                  />
                  <Button
                    variant="default"
                    onClick={() => {
                      setMobileNavOpen(false);
                      openCompose();
                    }}
                    className="relative w-full h-9 px-3 justify-between font-medium text-xs rounded-lg shadow-xs hover:bg-primary/90 active:scale-[0.985] cursor-pointer transition-all duration-200 select-none overflow-hidden"
                  >
                    <span
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover/compose:translate-x-full duration-700 ease-in-out transition-transform pointer-events-none"
                      aria-hidden="true"
                    />
                    <div className="flex items-center gap-2">
                      <SquarePen className="size-3.5 transition-transform duration-300 ease-out group-hover/compose:-rotate-12 group-hover/compose:scale-115" />
                      <span className="transition-transform duration-200 ease-out group-hover/compose:translate-x-0.5">
                        New message
                      </span>
                    </div>
                    <kbd className="hidden sm:inline-flex items-center justify-center h-4.5 px-1.5 rounded bg-primary-foreground/15 text-[10px] font-mono font-medium text-primary-foreground/90 border border-primary-foreground/20 select-none transition-all duration-200 group-hover/compose:bg-primary-foreground/25 group-hover/compose:scale-105">
                      C
                    </kbd>
                  </Button>
                </div>
              )}
            </div>

            {/* Primary Mail Folders */}
            <SidebarGroup className="p-0">
              <SidebarGroupLabel className="h-7 px-2 text-[10px] font-semibold text-muted-foreground/75 uppercase tracking-widest leading-none select-none">
                Mailbox
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {folderList.map((name) => {
                    const Icon = folderIcons[name];
                    const isMailRouteActive =
                      pathname === "/" ||
                      pathname === "/inbox" ||
                      pathname.startsWith("/labels/") ||
                      pathname === `/${name.toLowerCase()}`;
                    const isActive =
                      isMailRouteActive && !label && folder === name;
                    const count = counts[name] || 0;
                    const folderHref =
                      name === "Inbox" ? "/inbox" : `/${name.toLowerCase()}`;
                    const isNavigating = navigatingKey === `folder:${name}`;

                    return (
                      <SidebarMenuItem key={name}>
                        <ContextMenu>
                          <ContextMenuTrigger
                            render={
                              <SidebarMenuButton
                                isActive={isActive}
                                isNavigating={isNavigating}
                                tooltip={`${name}${count > 0 ? ` (${count})` : ""}`}
                                onClick={() => selectFolder(name)}
                                className="font-medium"
                              >
                                <Icon className="size-4 shrink-0" />
                                <span>{name}</span>
                              </SidebarMenuButton>
                            }
                          />
                          <ContextMenuContent>
                            <ContextMenuItem onClick={() => selectFolder(name)}>
                              <Icon className="size-4 mr-2" />
                              Open {name}
                            </ContextMenuItem>
                            <ContextMenuItem
                              onClick={() => window.open(folderHref, "_blank")}
                            >
                              <ExternalLink className="size-4 mr-2" />
                              Open in new tab
                            </ContextMenuItem>
                            <ContextMenuSeparator />
                            <ContextMenuItem
                              onClick={() => {
                                const url = `${window.location.origin}${folderHref}`;
                                navigator.clipboard.writeText(url);
                                toast.success(`Copied link to ${name}`);
                              }}
                            >
                              <Copy className="size-4 mr-2" />
                              Copy folder link
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                        {count > 0 && (
                          <SidebarMenuBadge>
                            {count > 99 ? "99+" : count}
                          </SidebarMenuBadge>
                        )}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarSeparator className="mx-0 my-1 bg-sidebar-border/60" />

            {/* Custom Labels Section */}
            <SidebarGroup className="p-0">
              <div className="flex items-center justify-between h-7 px-2 select-none group-data-[collapsible=icon]:hidden">
                <SidebarGroupLabel className="h-auto p-0 text-[10px] font-semibold text-muted-foreground/75 uppercase tracking-widest leading-none select-none">
                  Labels
                </SidebarGroupLabel>
                <SidebarGroupAction
                  className="relative top-auto right-auto flex size-5 items-center justify-center rounded-md p-0 text-muted-foreground/75 hover:text-foreground hover:bg-sidebar-accent transition-colors cursor-pointer"
                  onClick={() => setCreatingLabel((prev) => !prev)}
                  title="Create new label"
                  aria-label="Create new label"
                >
                  <Plus className="size-3.5" />
                </SidebarGroupAction>
              </div>
              <SidebarGroupContent>
                {/* Inline Create Label Form */}
                {creatingLabel && (
                  <form
                    onSubmit={handleCreateLabel}
                    className="flex items-center gap-1 px-1 py-1 mb-1"
                  >
                    <Input
                      placeholder="Label name..."
                      value={newLabelName}
                      onChange={(e) => setNewLabelName(e.target.value)}
                      className="h-7 text-xs px-2"
                      autoFocus
                    />
                    <Button
                      type="submit"
                      size="xs"
                      disabled={creatingLoading || !newLabelName.trim()}
                      className="h-7 px-2 text-xs"
                    >
                      {creatingLoading ? <Spinner className="size-3" /> : "Add"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="size-7"
                      onClick={() => {
                        setCreatingLabel(false);
                        setNewLabelName("");
                      }}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </form>
                )}

                <SidebarMenu>
                  {mergedLabels.map((lbl) => {
                    const isActive = label === lbl.name;
                    const count = counts[lbl.name] || lbl.count || 0;
                    const isDefault = DEFAULT_LABEL_NAMES.some(
                      (n) => n.toLowerCase() === lbl.name.toLowerCase(),
                    );
                    const labelHref = `/labels/${encodeURIComponent(lbl.name)}`;
                    const isNavigating = navigatingKey === `label:${lbl.name}`;

                    return (
                      <SidebarMenuItem key={lbl.name}>
                        <ContextMenu>
                          <ContextMenuTrigger
                            render={
                              <SidebarMenuButton
                                isActive={isActive}
                                isNavigating={isNavigating}
                                tooltip={`${lbl.name}${count > 0 ? ` (${count})` : ""}`}
                                onClick={() => selectLabel(lbl.name)}
                              >
                                <Tag className="size-3.5 shrink-0" />
                                <span>{lbl.name}</span>
                              </SidebarMenuButton>
                            }
                          />
                          <ContextMenuContent>
                            <ContextMenuItem
                              onClick={() => selectLabel(lbl.name)}
                            >
                              <Tag className="size-4 mr-2" />
                              Open label
                            </ContextMenuItem>
                            <ContextMenuItem
                              onClick={() => window.open(labelHref, "_blank")}
                            >
                              <ExternalLink className="size-4 mr-2" />
                              Open in new tab
                            </ContextMenuItem>
                            <ContextMenuSeparator />
                            <ContextMenuItem
                              onClick={() => {
                                navigator.clipboard.writeText(lbl.name);
                                toast.success(`Copied "${lbl.name}"`);
                              }}
                            >
                              <Copy className="size-4 mr-2" />
                              Copy label name
                            </ContextMenuItem>
                            {!isDefault && (
                              <>
                                <ContextMenuSeparator />
                                <ContextMenuItem
                                  variant="destructive"
                                  onClick={() => setDeleteLabelTarget(lbl.name)}
                                >
                                  <Trash2 className="size-4 mr-2" />
                                  Delete label
                                </ContextMenuItem>
                              </>
                            )}
                          </ContextMenuContent>
                        </ContextMenu>
                        {count > 0 && (
                          <SidebarMenuBadge>
                            {count > 99 ? "99+" : count}
                          </SidebarMenuBadge>
                        )}
                        {!isDefault && (
                          <SidebarMenuAction
                            showOnHover
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteLabelTarget(lbl.name);
                            }}
                            aria-label={`Delete label "${lbl.name}"`}
                          >
                            <Trash2 className="size-3" />
                          </SidebarMenuAction>
                        )}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarSeparator className="mx-0 my-1 bg-sidebar-border/60" />

            {/* Connected Workspaces & Features */}
            <SidebarGroup className="p-0">
              <SidebarGroupLabel className="h-7 px-2 text-[10px] font-semibold text-muted-foreground/75 uppercase tracking-widest leading-none select-none">
                Workspace
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {workspaceItems.map((item) => {
                    const Icon = item.icon;
                    const isItemActive =
                      pathname === item.path ||
                      pathname.startsWith(`${item.path}/`);
                    const isNavigating = navigatingKey === `path:${item.path}`;

                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isItemActive}
                          isNavigating={isNavigating}
                          tooltip={`${item.label}${item.badge ? ` (${item.badge})` : ""}`}
                          onClick={() => navigateTo(item.path)}
                        >
                          <Icon className="size-4 shrink-0" />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                        {item.badge && (
                          <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>
                        )}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          {/* Sidebar Footer with Collapse / Expand Toggle */}
          <SidebarFooter className="p-2 border-t border-sidebar-border mt-auto bg-sidebar/40">
            <SidebarMenu>
              <SidebarMenuItem>
                {sidebarCollapsed ? (
                  <SidebarMenuButton
                    tooltip="Expand sidebar (Cmd+B or [)"
                    onClick={toggleSidebar}
                    className="size-8 mx-auto flex items-center justify-center rounded-lg hover:bg-sidebar-accent transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
                    aria-label="Expand sidebar"
                  >
                    <PanelLeftOpen className="size-4" />
                  </SidebarMenuButton>
                ) : (
                  <SidebarMenuButton
                    tooltip="Collapse sidebar (Cmd+B or [)"
                    onClick={toggleSidebar}
                    className="w-full flex items-center justify-between font-medium text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/80 rounded-lg cursor-pointer transition-colors"
                    aria-label="Collapse sidebar"
                  >
                    <div className="flex items-center gap-2.5">
                      <PanelLeftClose className="size-4 shrink-0 text-muted-foreground/70 group-hover/menu-button:text-foreground" />
                      <span className="text-xs">Collapse sidebar</span>
                    </div>
                    <kbd className="hidden sm:inline-flex items-center justify-center h-4.5 px-1.5 rounded bg-muted/60 text-[10px] font-mono text-muted-foreground border border-border/50 ml-auto shadow-2xs">
                      [
                    </kbd>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>

          {/* Interactive hover/drag rail */}
          <SidebarRail />
        </Sidebar>

        {/* Delete Label Confirmation Modal */}
        <ConfirmDialog
          isOpen={!!deleteLabelTarget}
          title={`Delete label "${deleteLabelTarget}"?`}
          description={`This will remove the label "${deleteLabelTarget}" from all conversations. The conversations themselves will not be deleted.`}
          confirmLabel="Delete Label"
          onConfirm={handleDeleteLabel}
          onCancel={() => setDeleteLabelTarget(null)}
        />
      </SidebarProvider>
    </>
  );
}
