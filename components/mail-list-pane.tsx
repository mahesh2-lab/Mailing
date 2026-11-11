"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  Check,
  Search,
  Tag,
  Trash2,
  X,
} from "@/components/animate-ui/icons";
import axios from "axios";
import { useMailListData } from "../hooks/use-mail-list-data";
import type { MailItem } from "../hooks/use-mail";
import { useMailContext } from "./mail-context";
import { getActionsForFolder, type MailActionConfig } from "@/lib/mail-actions";
import ConfirmDialog from "./confirm-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmailRowItem } from "./mail-list/email-row-item";
import { ReducedMotionConfig } from "@animate-ui/react/utils/motion";

function SkeletonRows() {
  return (
    <div className="space-y-1.5">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-border/40 py-2 px-2.5 flex items-start gap-2.5 bg-card/40"
        >
          <Skeleton className="size-7 rounded-full shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-3 w-10" />
            </div>
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-2.5 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MailListPane() {
  const {
    folder,
    label,
    query,
    setQuery,
    openId,
    setOpenId,
    refreshTick,
    refresh,
  } = useMailContext();

  const { mail, setMail, initialLoading, isFetching, hasMore, loadMore } = useMailListData(
    folder,
    label,
    refreshTick,
  );

  const [filterTab, setFilterTab] = useState<"all" | "unread">("all");
  const selectionScope = `${folder ?? ""}:${label ?? ""}:${filterTab}`;
  const [selectionState, setSelectionState] = useState({
    scope: selectionScope,
    ids: [] as string[],
  });
  const selected = useMemo(
    () => selectionState.scope === selectionScope ? selectionState.ids : [],
    [selectionScope, selectionState],
  );
  const setSelected = useCallback((next: React.SetStateAction<string[]>) => {
    setSelectionState((current) => {
      const currentIds = current.scope === selectionScope ? current.ids : [];
      return {
        scope: selectionScope,
        ids: typeof next === "function" ? next(currentIds) : next,
      };
    });
  }, [selectionScope]);
  const [emptyTrashConfirmOpen, setEmptyTrashConfirmOpen] = useState(false);
  const [bulkTrashConfirmOpen, setBulkTrashConfirmOpen] = useState(false);

  const [allLabels, setAllLabels] = useState<
    Array<{ id: string; name: string }>
  >([]);

  useEffect(() => {
    axios
      .get("/api/v1/labels")
      .then((res) => setAllLabels(res.data || []))
      .catch(() => {});
  }, [refreshTick]);

  // Command Palette / Search shortcut ref (⌘K / Ctrl+K)
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Pull-to-refresh state
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const pullStartYRef = useRef<number | null>(null);
  const isPullActiveRef = useRef(false);
  const hasHapticRef = useRef(false);

  // Touch event handlers (Mobile / Touch devices)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isPullRefreshing) return;
    const container = scrollContainerRef.current;
    if (!container || container.scrollTop > 2) return;
    pullStartYRef.current = e.touches[0].clientY;
    isPullActiveRef.current = true;
    hasHapticRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (
      !isPullActiveRef.current ||
      pullStartYRef.current === null ||
      isPullRefreshing
    )
      return;
    const container = scrollContainerRef.current;
    if (!container || container.scrollTop > 2) {
      if (pullDistance > 0) {
        setPullDistance(0);
        setIsPulling(false);
      }
      return;
    }

    const currentY = e.touches[0].clientY;
    const diff = currentY - pullStartYRef.current;

    if (diff > 0) {
      setIsPulling(true);
      const damped = Math.min(Math.pow(diff, 0.82) * 1.6, 85);
      setPullDistance(damped);

      if (damped >= 55 && !hasHapticRef.current) {
        hasHapticRef.current = true;
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(12);
        }
      } else if (damped < 55) {
        hasHapticRef.current = false;
      }
    } else {
      setPullDistance(0);
      setIsPulling(false);
    }
  };

  const handleTouchEnd = () => {
    if (!isPullActiveRef.current) return;
    isPullActiveRef.current = false;
    pullStartYRef.current = null;
    setIsPulling(false);

    if (pullDistance >= 55 && !isPullRefreshing) {
      setIsPullRefreshing(true);
      setPullDistance(46);
      refresh();
    } else {
      setPullDistance(0);
    }
  };

  // Smoothly dismiss pull banner when refreshing completes
  useEffect(() => {
    if (isPullRefreshing && !isFetching) {
      const timer = setTimeout(() => {
        setIsPullRefreshing(false);
        setPullDistance(0);
        toast.success("Inbox updated");
      }, 450);
      return () => clearTimeout(timer);
    }
  }, [isPullRefreshing, isFetching]);

  const primaryActions = useMemo(() => {
    return getActionsForFolder(folder).primaryActions;
  }, [folder]);

  const visible = useMemo(() => {
    let list = mail;

    if (filterTab === "unread") {
      list = list.filter((m) => m.unread);
    }

    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (m) =>
          m.subject?.toLowerCase().includes(q) ||
          m.sender?.name?.toLowerCase().includes(q) ||
          m.sender?.email?.toLowerCase().includes(q) ||
          m.preview?.toLowerCase().includes(q),
      );
    }

    return list;
  }, [mail, filterTab, query]);

  const lastSelectedIdRef = useRef<{ scope: string; id: string | null }>({
    scope: selectionScope,
    id: null,
  });

  const toggleSelect = useCallback(
    (id: string, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      setSelected((cur) => {
        // Shift + Click Range Selection (Gmail-style)
        const lastSelected = lastSelectedIdRef.current.scope === selectionScope
          ? lastSelectedIdRef.current.id
          : null;
        if (e?.shiftKey && lastSelected) {
          const lastIdx = visible.findIndex(
            (m) => m.id === lastSelected,
          );
          const currentIdx = visible.findIndex((m) => m.id === id);

          if (lastIdx !== -1 && currentIdx !== -1) {
            const start = Math.min(lastIdx, currentIdx);
            const end = Math.max(lastIdx, currentIdx);
            const rangeIds = visible.slice(start, end + 1).map((m) => m.id);
            const combined = Array.from(new Set([...cur, ...rangeIds]));
            lastSelectedIdRef.current = { scope: selectionScope, id };
            return combined;
          }
        }

        lastSelectedIdRef.current = { scope: selectionScope, id };
        return cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      });
    },
    [selectionScope, setSelected, visible],
  );

  const selectAll = useCallback(() => {
    setSelected((cur) =>
      cur.length === visible.length && visible.length > 0
        ? []
        : visible.map((m) => m.id),
    );
  }, [setSelected, visible]);

  const isSelectionMode = selected.length > 0;

  const handleOpen = useCallback(
    (item: MailItem) => {
      setOpenId(item.id);
    },
    [setOpenId],
  );

  const handleStarToggle = useCallback(
    async (id: string, currentStarred: boolean, e: React.MouseEvent) => {
      e.stopPropagation();
      setMail((prev) =>
        prev.map((m) => (m.id === id ? { ...m, starred: !currentStarred } : m)),
      );
      try {
        const res = await axios.post(`/api/v1/messages/${id}/star`, {
          starred: !currentStarred,
        });
        toast.success(res.data.starred ? "Starred" : "Unstarred");
        refresh();
      } catch {
        setMail((prev) =>
          prev.map((m) =>
            m.id === id ? { ...m, starred: currentStarred } : m,
          ),
        );
        toast.error("Failed to update star");
      }
    },
    [setMail, refresh],
  );

  const executeBulkDeletePermanent = useCallback(async () => {
    if (selected.length === 0) return;
    const targetIds = [...selected];
    setSelected([]);
    setBulkTrashConfirmOpen(false);

    try {
      for (const id of targetIds) {
        await axios.delete(`/api/v1/messages/${id}`);
      }
      toast.success(
        `Permanently deleted ${targetIds.length} message${targetIds.length > 1 ? "s" : ""}`,
      );
      setMail((prev) => prev.filter((m) => !targetIds.includes(m.id)));
      if (openId && targetIds.includes(openId)) setOpenId(null);
      refresh();
    } catch {
      toast.error("Failed to delete messages");
      refresh();
    }
  }, [selected, openId, setOpenId, setMail, setSelected, refresh]);

  const handleBulkAction = useCallback(
    async (action: MailActionConfig) => {
      if (selected.length === 0) return;

      if (action.id === "delete_permanent") {
        setBulkTrashConfirmOpen(true);
        return;
      }

      const targetIds = [...selected];
      setSelected([]);

      try {
        if (action.id === "restore") {
          await axios.post("/api/v1/messages/bulk", {
            action: "restore",
            ids: targetIds,
          });
          toast.success(
            `Restored ${targetIds.length} message${targetIds.length > 1 ? "s" : ""}`,
          );
        } else if (action.id === "archive") {
          await axios.post("/api/v1/messages/bulk", {
            action: "archive",
            ids: targetIds,
          });
          toast.success(
            `Archived ${targetIds.length} message${targetIds.length > 1 ? "s" : ""}`,
          );
        } else if (action.id === "trash") {
          await axios.post("/api/v1/messages/bulk", {
            action: "trash",
            ids: targetIds,
          });
          toast.success(
            `Moved ${targetIds.length} message${targetIds.length > 1 ? "s" : ""} to trash`,
          );
        }
        setMail((prev) => prev.filter((m) => !targetIds.includes(m.id)));
        if (openId && targetIds.includes(openId)) setOpenId(null);
        refresh();
      } catch {
        toast.error("Failed to process bulk action");
        refresh();
      }
    },
    [selected, openId, setOpenId, setMail, setSelected, refresh],
  );

  const handleSingleMarkRead = useCallback(
    async (id: string, currentlyUnread: boolean) => {
      setMail((prev) =>
        prev.map((m) => (m.id === id ? { ...m, unread: !currentlyUnread } : m)),
      );
      try {
        await axios.patch(`/api/v1/messages/${id}/read`, {
          unread: !currentlyUnread,
        });
        toast.success(currentlyUnread ? "Marked as read" : "Marked as unread");
        refresh();
      } catch {
        toast.error("Failed to update status");
        refresh();
      }
    },
    [setMail, refresh],
  );

  const handleSingleArchive = useCallback(
    async (id: string) => {
      setMail((prev) => prev.filter((m) => m.id !== id));
      if (openId === id) setOpenId(null);
      try {
        await axios.post("/api/v1/messages/bulk", {
          action: "archive",
          ids: [id],
        });
        toast.success("Archived conversation");
        refresh();
      } catch {
        toast.error("Failed to archive");
        refresh();
      }
    },
    [openId, setOpenId, setMail, refresh],
  );

  const handleSingleTrash = useCallback(
    async (id: string) => {
      setMail((prev) => prev.filter((m) => m.id !== id));
      if (openId === id) setOpenId(null);
      try {
        await axios.post("/api/v1/messages/bulk", {
          action: "trash",
          ids: [id],
        });
        toast.success("Moved to trash");
        refresh();
      } catch {
        toast.error("Failed to move to trash");
        refresh();
      }
    },
    [openId, setOpenId, setMail, refresh],
  );

  const handleSingleRestore = useCallback(
    async (id: string) => {
      setMail((prev) => prev.filter((m) => m.id !== id));
      if (openId === id) setOpenId(null);
      try {
        await axios.post("/api/v1/messages/bulk", {
          action: "restore",
          ids: [id],
        });
        toast.success("Restored to Inbox");
        refresh();
      } catch {
        toast.error("Failed to restore");
        refresh();
      }
    },
    [openId, setOpenId, setMail, refresh],
  );

  const handleSingleDeletePermanent = useCallback(
    async (id: string) => {
      setMail((prev) => prev.filter((m) => m.id !== id));
      if (openId === id) setOpenId(null);
      try {
        await axios.delete(`/api/v1/messages/${id}`);
        toast.success("Permanently deleted message");
        refresh();
      } catch {
        toast.error("Failed to delete message");
        refresh();
      }
    },
    [openId, setOpenId, setMail, refresh],
  );

  const handleSingleLabel = useCallback(
    async (id: string, lbl: string) => {
      try {
        await axios.post("/api/v1/messages/bulk/labels", {
          action: "add",
          label: lbl,
          messageIds: [id],
          ids: [id],
        });
        toast.success(`Tagged conversation with "${lbl}"`);
        refresh();
      } catch {
        toast.error("Failed to update labels");
      }
    },
    [refresh],
  );

  // Superhuman-style Keyboard Navigation & Global Shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      // Do not trigger shortcuts when typing inside form inputs
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // When items are selected in list
      if (selected.length > 0) {
        if (e.key === "Escape") {
          e.preventDefault();
          setSelected([]);
          return;
        }
        if (e.key === "e" || e.key === "E") {
          const archiveAction = primaryActions.find((a) => a.id === "archive");
          if (archiveAction) {
            e.preventDefault();
            handleBulkAction(archiveAction);
            return;
          }
        }
        if (e.key === "#" || (e.shiftKey && e.key === "3")) {
          const trashAction = primaryActions.find(
            (a) => a.id === "trash" || a.id === "delete_permanent",
          );
          if (trashAction) {
            e.preventDefault();
            handleBulkAction(trashAction);
            return;
          }
        }
      }

      // J / K navigation through email list
      if (e.key === "j" || e.key === "ArrowDown") {
        if (visible.length === 0) return;
        e.preventDefault();
        const currentIndex = visible.findIndex((m) => m.id === openId);
        const nextIndex =
          currentIndex === -1
            ? 0
            : Math.min(currentIndex + 1, visible.length - 1);
        if (visible[nextIndex]) {
          handleOpen(visible[nextIndex]);
        }
        return;
      }

      if (e.key === "k" || e.key === "ArrowUp") {
        if (visible.length === 0) return;
        e.preventDefault();
        const currentIndex = visible.findIndex((m) => m.id === openId);
        const prevIndex =
          currentIndex === -1 ? 0 : Math.max(currentIndex - 1, 0);
        if (visible[prevIndex]) {
          handleOpen(visible[prevIndex]);
        }
        return;
      }

      // X: toggle selection of current item
      if ((e.key === "x" || e.key === "X") && openId) {
        e.preventDefault();
        toggleSelect(openId);
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selected,
    setSelected,
    openId,
    visible,
    primaryActions,
    handleBulkAction,
    handleOpen,
    toggleSelect,
  ]);

  const handleBulkLabel = useCallback(
    async (lbl: string) => {
      if (selected.length === 0) return;
      const targetIds = [...selected];
      setSelected([]);

      try {
        await axios.post("/api/v1/messages/bulk/labels", {
          action: "add",
          label: lbl,
          messageIds: targetIds,
          ids: targetIds,
        });
        toast.success(`Tagged ${targetIds.length} conversations with "${lbl}"`);
        refresh();
      } catch {
        toast.error("Failed to update labels");
      }
    },
    [selected, setSelected, refresh],
  );

  const handleEmptyTrash = useCallback(async () => {
    try {
      await axios.delete("/api/v1/messages/empty-trash");
      toast.success("Trash emptied");
      setMail([]);
      setOpenId(null);
      setEmptyTrashConfirmOpen(false);
      refresh();
    } catch {
      toast.error("Failed to empty trash");
    }
  }, [setMail, setOpenId, refresh]);

  const canEmptyFolder = folder === "Trash";

  return (
    <>
      <section
        className={cn(
          "w-full md:w-95 lg:w-105 shrink-0 border-r border-border bg-background flex flex-col h-full overflow-hidden",
          openId ? "max-md:hidden" : "max-md:flex",
        )}
      >
        {/* Header - proper 2-row layout */}
        <div className="border-b border-border shrink-0 bg-background">
          {/* Row 1: Folder Title OR Selection Actions Toolbar */}
          <div className="h-13 px-3 md:px-4 flex items-center justify-between gap-2 shrink-0">
            {selected.length > 0 ? (
              <>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="size-7 text-muted-foreground hover:text-foreground active:scale-95 transition-transform cursor-pointer shrink-0"
                    onClick={() => setSelected([])}
                    aria-label="Clear selection"
                  >
                    <X className="size-3.5" />
                  </Button>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Checkbox
                      checked={
                        selected.length === visible.length && visible.length > 0
                      }
                      onCheckedChange={selectAll}
                      aria-label="Select all conversations"
                      className="size-3.5 shrink-0"
                    />
                    <span className="text-xs font-semibold text-foreground whitespace-nowrap select-none leading-none">
                      {selected.length} selected
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-auto">
                  {primaryActions.map((action) => {
                    const Icon = action.icon;
                    const shortcutKey =
                      action.id === "archive"
                        ? "E"
                        : action.id === "trash" ||
                            action.id === "delete_permanent"
                          ? "#"
                          : action.id === "restore"
                            ? "R"
                            : null;
                    return (
                      <Tooltip key={action.id}>
                        <TooltipTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground active:scale-95 transition-all cursor-pointer shrink-0"
                              onClick={() => handleBulkAction(action)}
                              aria-label={action.label}
                            >
                              <Icon className="size-3.5 shrink-0" />
                              <span className="whitespace-nowrap">
                                {action.label}
                              </span>
                            </Button>
                          }
                        />
                        <TooltipContent>
                          {action.tooltip}
                          {shortcutKey ? ` (${shortcutKey})` : ""}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}

                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground active:scale-95 transition-all cursor-pointer shrink-0"
                          aria-label="Apply label (L)"
                        >
                          <Tag className="size-3.5 shrink-0" />
                          <span className="whitespace-nowrap">Label</span>
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end" className="w-48 p-1">
                      {allLabels.length === 0 ? (
                        <div className="px-2 py-2 text-xs text-muted-foreground">
                          No labels yet. Create one in the sidebar.
                        </div>
                      ) : (
                        allLabels.map((lbl) => (
                          <DropdownMenuItem
                            key={lbl.id}
                            onClick={() => handleBulkLabel(lbl.name)}
                            className="text-xs gap-2"
                          >
                            <Tag className="size-3.5 text-muted-foreground" />
                            <span>{lbl.name}</span>
                          </DropdownMenuItem>
                        ))
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 min-w-0 animate-in fade-in-0 duration-150">
                {!initialLoading && visible.length > 0 && (
                  <Checkbox
                    checked={false}
                    onCheckedChange={selectAll}
                    aria-label="Select all conversations"
                    className="size-3.5 shrink-0 cursor-pointer text-muted-foreground/60 hover:text-foreground transition-colors"
                    title="Select all conversations"
                  />
                )}
                <h1 className="text-base font-semibold tracking-tight text-foreground truncate">
                  {label ? `#${label}` : folder || "Inbox"}
                </h1>
                {!initialLoading && visible.length > 0 && (
                  <span className="shrink-0 text-[11px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full leading-none">
                    {visible.length}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Row 2: Search + Filter tabs - ALWAYS VISIBLE */}
          <div className="px-3 pb-2.5 h-14 md:h-10.5 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground pointer-events-none" />
              <Input
                ref={searchInputRef}
                placeholder="Search..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8 pr-10 h-11 md:h-8 text-base md:text-xs bg-muted/50 border-transparent focus-visible:border-border focus-visible:bg-background shadow-none rounded-lg"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="size-3.5" />
                </button>
              ) : (
                <kbd className="pointer-events-none absolute right-2.5 top-2 text-[10px] font-mono text-muted-foreground/60 bg-background/80 px-1.5 py-0.5 rounded border border-border/50 select-none">
                  ⌘K
                </kbd>
              )}
            </div>
            <Tabs
              value={filterTab}
              onValueChange={(val) => setFilterTab(val as "all" | "unread")}
              className="w-auto shrink-0"
            >
              <TabsList className="h-11 md:h-8 p-0.5 bg-muted/60">
                <TabsTrigger
                  value="all"
                  className="h-10 md:h-7 px-2.5 text-xs font-medium"
                >
                  All
                </TabsTrigger>
                <TabsTrigger
                  value="unread"
                  className="h-10 md:h-7 px-2.5 text-xs font-medium"
                >
                  Unread
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Scrollable Mail Cards List with Pull-Down-to-Refresh */}
        <div
          ref={scrollContainerRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="flex-1 overflow-y-auto p-2 pb-24 md:pb-2 space-y-1.5 overscroll-y-contain relative select-none md:select-auto"
        >
          {/* Pull Down Refresh Indicator Pill */}
          {(pullDistance > 0 || isPullRefreshing) && (
            <div
              style={{
                height: isPullRefreshing ? 44 : pullDistance,
                transition: isPulling
                  ? "none"
                  : "height 0.28s cubic-bezier(0.2, 0.9, 0.3, 1)",
              }}
              className="overflow-hidden flex items-center justify-center shrink-0 pointer-events-none mb-1.5"
            >
              <div
                style={{
                  opacity: Math.min(pullDistance / 28, 1),
                  transform: `scale(${Math.min(0.7 + (pullDistance / 55) * 0.3, 1)})`,
                  transition: isPulling ? "none" : "all 0.25s ease-out",
                }}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium shadow-sm border transition-all duration-150",
                  pullDistance >= 55 || isPullRefreshing
                    ? "bg-primary text-primary-foreground border-primary/20 shadow-md shadow-primary/10"
                    : "bg-muted/90 text-muted-foreground border-border/60 backdrop-blur-sm",
                )}
              >
                {isPullRefreshing ? (
                  <>
                    <Spinner className="size-3.5 text-current" />
                    <span>Checking for mail...</span>
                  </>
                ) : (
                  <>
                    <ArrowDown
                      className={cn(
                        "size-3.5 transition-transform duration-200",
                        pullDistance >= 55 ? "rotate-180" : "rotate-0",
                      )}
                    />
                    <span>
                      {pullDistance >= 55
                        ? "Release to refresh"
                        : "Pull down to refresh"}
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          {initialLoading ? (
            <SkeletonRows />
          ) : visible.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground space-y-2 my-auto">
              <div className="size-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground mx-auto mb-2">
                <Check className="size-5" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                {query ? "No messages found" : "Nothing in this folder"}
              </p>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                {query
                  ? `No emails match your query "${query}".`
                  : "You're all caught up! New emails will appear here automatically."}
              </p>
              {hasMore && (
                <Button variant="outline" size="sm" onClick={loadMore} disabled={isFetching}>
                  {isFetching ? <Spinner className="size-4" /> : "Load more messages"}
                </Button>
              )}
            </div>
          ) : (
            <>
              <ReducedMotionConfig>
                {visible.map((item, idx) => (
                  <EmailRowItem
                    key={item.id}
                    item={item}
                    index={idx}
                    isSelected={selected.includes(item.id)}
                    isCurrentOpen={openId === item.id}
                    isSelectionMode={isSelectionMode}
                    folder={folder}
                    allLabels={allLabels}
                    selectedCount={selected.length}
                    onOpen={handleOpen}
                    onToggleSelect={toggleSelect}
                    onStarToggle={handleStarToggle}
                    onMarkReadToggle={handleSingleMarkRead}
                    onArchive={handleSingleArchive}
                    onTrash={handleSingleTrash}
                    onRestore={handleSingleRestore}
                    onDeletePermanent={handleSingleDeletePermanent}
                    onApplyLabel={handleSingleLabel}
                    onBulkAction={handleBulkAction}
                    onBulkLabel={handleBulkLabel}
                  />
                ))}
              </ReducedMotionConfig>
              {hasMore && (
                <div className="flex justify-center py-3">
                  <Button variant="outline" size="sm" onClick={loadMore} disabled={isFetching}>
                    {isFetching ? <Spinner className="size-4" /> : "Load more messages"}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Bottom trash emptier if applicable */}
        {canEmptyFolder && visible.length > 0 && (
          <div className="p-2 border-t border-border bg-muted/20 flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEmptyTrashConfirmOpen(true)}
              className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10 h-7"
            >
              <Trash2 className="size-3 mr-1.5" /> Empty Trash
            </Button>
          </div>
        )}
      </section>

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        isOpen={emptyTrashConfirmOpen}
        title="Empty Trash?"
        description="All messages in the trash will be permanently deleted. This action cannot be undone."
        confirmLabel="Empty Trash"
        onConfirm={handleEmptyTrash}
        onCancel={() => setEmptyTrashConfirmOpen(false)}
      />

      <ConfirmDialog
        isOpen={bulkTrashConfirmOpen}
        title="Permanently Delete Messages?"
        description={`Are you sure you want to permanently remove ${selected.length} message${selected.length > 1 ? "s" : ""}? This cannot be undone.`}
        confirmLabel="Delete Permanently"
        onConfirm={executeBulkDeletePermanent}
        onCancel={() => setBulkTrashConfirmOpen(false)}
      />
    </>
  );
}
