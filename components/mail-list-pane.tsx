"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArrowDown,
  Check,
  CheckSquare,
  Copy,
  Forward,
  Mail,
  MailOpen,
  Paperclip,
  Reply,
  ReplyAll,
  RotateCcw,
  Search,
  Square,
  Star,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import axios from "axios";
import { Folder, MailItem } from "../hooks/use-mail";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useMailContext } from "./mail-context";
import { getActionsForFolder, MailActionConfig } from "@/lib/mail-actions";
import ConfirmDialog from "./confirm-dialog";
import { cn, getInitials, avatarColor } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function formatMailDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  if (diffDays < 7) {
    return d.toLocaleDateString([], { weekday: "short" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

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

function useListData(
  folder: string | undefined,
  label: string | undefined,
  refreshTick: number,
) {
  const [mail, setMail] = useState<MailItem[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState(false);
  const hasLoadedOnce = useRef(false);

  useEffect(() => {
    let mounted = true;

    if (!hasLoadedOnce.current) {
      setInitialLoading(true);
    } else {
      setIsFetching(true);
    }
    setError(false);

    axios
      .get(`/api/v1/messages?folder=${folder ?? ""}&label=${label ?? ""}`)
      .then((res) => {
        if (!mounted) return;
        const mapped: MailItem[] = (res.data || []).map((e: any) => ({
          id: e.id,
          sender: {
            name: e.from?.split("<")[0].trim() || e.from || "Unknown",
            email: e.from || "",
          },
          subject: e.subject || "No Subject",
          preview: (
            e.text ||
            (e.html
              ? e.html
                  .replace(/<[^>]+>/g, " ")
                  .replace(/\s+/g, " ")
                  .trim()
              : "")
          ).slice(0, 140),
          rawText: e.text || "",
          rawHtml: e.html || "",
          body: e.html || e.text || "",
          timestamp: e.createdAt || e.created_at || new Date().toISOString(),
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
        setMail(mapped);
        hasLoadedOnce.current = true;
      })
      .catch(() => {
        if (mounted) setError(true);
      })
      .finally(() => {
        if (mounted) {
          setInitialLoading(false);
          setIsFetching(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [folder, label, refreshTick]);

  return { mail, setMail, initialLoading, isFetching, error };
}

interface EmailRowItemProps {
  item: MailItem;
  index?: number;
  isSelected: boolean;
  isCurrentOpen: boolean;
  isSelectionMode: boolean;
  folder?: Folder;
  allLabels?: Array<{ id: string; name: string; count?: number }>;
  selectedCount?: number;
  onOpen: (item: MailItem) => void;
  onToggleSelect: (id: string, e?: React.MouseEvent) => void;
  onStarToggle: (id: string, starred: boolean, e: React.MouseEvent) => void;
  onMarkReadToggle?: (id: string, currentlyUnread: boolean) => void;
  onArchive?: (id: string) => void;
  onTrash?: (id: string) => void;
  onRestore?: (id: string) => void;
  onDeletePermanent?: (id: string) => void;
  onApplyLabel?: (id: string, label: string) => void;
  onBulkAction?: (action: MailActionConfig) => void;
  onBulkLabel?: (label: string) => void;
}

const EmailRowItem = memo(function EmailRowItem({
  item,
  index,
  isSelected,
  isCurrentOpen,
  isSelectionMode,
  folder,
  allLabels,
  selectedCount,
  onOpen,
  onToggleSelect,
  onStarToggle,
  onMarkReadToggle,
  onArchive,
  onTrash,
  onRestore,
  onDeletePermanent,
  onApplyLabel,
  onBulkAction,
  onBulkLabel,
}: EmailRowItemProps) {
  const { openCompose } = useMailContext();
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressTriggeredRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    startPosRef.current = null;
  }, []);

  const startLongPress = useCallback(
    (clientX: number, clientY: number) => {
      isLongPressTriggeredRef.current = false;
      startPosRef.current = { x: clientX, y: clientY };
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

      longPressTimerRef.current = setTimeout(() => {
        isLongPressTriggeredRef.current = true;
        if (typeof window !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate(40);
          } catch {}
        }
        onToggleSelect(item.id);
      }, 400);
    },
    [item.id, onToggleSelect],
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only touch gestures support long-press selection!
    if (e.pointerType !== "touch") return;
    startLongPress(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return;
    if (!startPosRef.current) return;
    const dx = Math.abs(e.clientX - startPosRef.current.x);
    const dy = Math.abs(e.clientY - startPosRef.current.y);
    if (dx > 8 || dy > 8) {
      cancelLongPress();
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (e.pointerType === "touch") {
      cancelLongPress();
    }
  };

  const handlePointerCancel = () => {
    cancelLongPress();
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isLongPressTriggeredRef.current) {
      isLongPressTriggeredRef.current = false;
      return;
    }
    // Shift or Ctrl/Cmd click triggers selection
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      e.preventDefault();
      onToggleSelect(item.id, e);
      return;
    }
    onOpen(item);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <div
            role="button"
            tabIndex={0}
            onClick={handleClick}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleClick(e as any);
              }
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            style={{
              animationDelay:
                index !== undefined
                  ? `${Math.min(index * 20, 200)}ms`
                  : undefined,
            }}
            className={cn(
              "w-full flex items-start gap-2.5 rounded-lg border py-2 px-2.5 text-left transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.995] cursor-pointer relative group select-none min-h-[72px] h-[72px] box-border animate-in fade-in-0 slide-in-from-bottom-1 duration-150 fill-mode-both",
              isSelected
                ? "bg-primary/5 dark:bg-primary/10 border-primary/40 ring-1 ring-primary/30 shadow-xs font-medium"
                : isCurrentOpen
                  ? "bg-muted border-border shadow-xs font-medium"
                  : "border-border/60 bg-card hover:border-border hover:bg-muted/40 shadow-none",
            )}
          >
            {/* Profile Picture / Checkmark */}
            <div
              role="checkbox"
              aria-checked={isSelected}
              tabIndex={0}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect(item.id, e);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleSelect(item.id);
                }
              }}
              className="relative shrink-0 mt-0.5 cursor-pointer select-none transition-transform duration-75 hover:scale-105 active:scale-95"
              title={
                isSelected ? "Deselect conversation" : "Select conversation"
              }
              aria-label={
                isSelected ? "Deselect conversation" : "Select conversation"
              }
            >
              {isSelected ? (
                <div className="size-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center animate-in zoom-in-75 duration-100 shadow-xs ring-1 ring-primary/40">
                  <Check className="size-3.5 stroke-[2.5]" />
                </div>
              ) : isSelectionMode ? (
                <div className="size-7 rounded-full border-2 border-muted-foreground/50 hover:border-primary flex items-center justify-center bg-card transition-colors">
                  <Check className="size-3 text-muted-foreground opacity-0 hover:opacity-70 transition-opacity" />
                </div>
              ) : (
                <div className="relative">
                  <Avatar className="size-7 rounded-full ring-1 ring-border/50 shrink-0">
                    {item.sender.avatarUrl && (
                      <AvatarImage
                        src={item.sender.avatarUrl}
                        alt={item.sender.name}
                      />
                    )}
                    <AvatarFallback
                      style={{
                        background: avatarColor(item.sender.name),
                        color: "#ffffff",
                      }}
                      className="text-[10px] font-semibold tracking-wider"
                    >
                      {getInitials(item.sender.name)}
                    </AvatarFallback>
                  </Avatar>
                  {item.unread && (
                    <span className="absolute -top-0.5 -right-0.5 flex size-2 items-center justify-center">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-500/75 dark:bg-blue-400/80 opacity-75" />
                      <span className="relative inline-flex size-2 rounded-full bg-blue-600 dark:bg-blue-400 ring-2 ring-card" />
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Email content summary - Regulated 3-row layout */}
            <div className="flex-1 min-w-0 flex flex-col justify-between h-full py-0.5">
              {/* Row 1: Mail sender & date */}
              <div className="flex w-full items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={cn(
                      "text-xs truncate leading-none",
                      item.unread
                        ? "font-semibold text-foreground"
                        : "font-normal text-muted-foreground",
                    )}
                  >
                    {item.sender.name}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <span
                    className={cn(
                      "text-[10px] font-normal leading-none tabular-nums",
                      item.unread
                        ? "text-primary font-semibold"
                        : "text-muted-foreground/80",
                    )}
                  >
                    {formatMailDate(item.timestamp)}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => onStarToggle(item.id, !!item.starred, e)}
                    className={cn(
                      "size-5 flex items-center justify-center rounded-xs transition-all duration-150 active:scale-125 cursor-pointer",
                      item.starred
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-60 hover:opacity-100",
                    )}
                    aria-label={item.starred ? "Unstar" : "Star"}
                  >
                    <Star
                      className={cn(
                        "size-3 transition-transform duration-150",
                        item.starred &&
                          "fill-amber-400 text-amber-400 opacity-100",
                      )}
                    />
                  </button>
                </div>
              </div>

              {/* Row 2: Subject */}
              <div
                className={cn(
                  "text-xs line-clamp-1 w-full flex items-center gap-1.5 leading-tight",
                  item.unread
                    ? "font-semibold text-foreground"
                    : "font-medium text-foreground/80",
                )}
              >
                <span className="truncate">{item.subject}</span>
                {item.attachments && item.attachments.length > 0 && (
                  <Paperclip className="size-3 shrink-0 text-muted-foreground" />
                )}
              </div>

              {/* Row 3: Preview of message + Label chips at the end of the item */}
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="line-clamp-1 text-[11px] text-muted-foreground leading-tight truncate flex-1">
                  {item.preview || "No preview available"}
                </span>
                {item.labels && item.labels.length > 0 && (
                  <div className="flex items-center gap-1 shrink-0 ml-1.5">
                    {item.labels.slice(0, 2).map((lbl) => (
                      <Badge
                        key={lbl}
                        variant="secondary"
                        className="text-[9px] h-3.5 px-1.5 py-0 font-normal rounded-xs shrink-0"
                      >
                        {lbl}
                      </Badge>
                    ))}
                    {item.labels.length > 2 && (
                      <span className="text-[9px] text-muted-foreground leading-none">
                        +{item.labels.length - 2}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        }
      />
      <ContextMenuContent className="w-56">
        {isSelected && selectedCount && selectedCount > 1 ? (
          <>
            <ContextMenuLabel>
              {selectedCount} conversations selected
            </ContextMenuLabel>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={() =>
                onBulkAction?.({
                  id: "archive",
                  label: "Archive",
                  icon: Archive,
                  tooltip: "Archive",
                })
              }
            >
              <Archive />
              <span>Archive all ({selectedCount})</span>
              <ContextMenuShortcut>E</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() =>
                onBulkAction?.({
                  id: "trash",
                  label: "Trash",
                  icon: Trash2,
                  tooltip: "Trash",
                })
              }
              variant="destructive"
            >
              <Trash2 />
              <span>Trash all ({selectedCount})</span>
              <ContextMenuShortcut>#</ContextMenuShortcut>
            </ContextMenuItem>
            {allLabels && allLabels.length > 0 && (
              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  <Tag />
                  <span>Apply label...</span>
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="w-48">
                  {allLabels.map((l) => (
                    <ContextMenuItem
                      key={l.id}
                      onClick={() => onBulkLabel?.(l.name)}
                    >
                      <Tag />
                      <span>{l.name}</span>
                    </ContextMenuItem>
                  ))}
                </ContextMenuSubContent>
              </ContextMenuSub>
            )}
            <ContextMenuSeparator />
            <ContextMenuItem onClick={(e) => onToggleSelect(item.id, e as any)}>
              <Square />
              <span>Deselect all</span>
            </ContextMenuItem>
          </>
        ) : (
          <>
            <ContextMenuItem onClick={() => onOpen(item)}>
              <MailOpen />
              <span>Open message</span>
            </ContextMenuItem>

            <ContextMenuItem
              onClick={() => onMarkReadToggle?.(item.id, !!item.unread)}
            >
              {item.unread ? <MailOpen /> : <Mail />}
              <span>{item.unread ? "Mark as read" : "Mark as unread"}</span>
              <ContextMenuShortcut>U</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuItem
              onClick={(e) => onStarToggle(item.id, !!item.starred, e as any)}
            >
              <Star
                className={cn(item.starred && "fill-amber-400 text-amber-400")}
              />
              <span>{item.starred ? "Unstar message" : "Star message"}</span>
              <ContextMenuShortcut>S</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuSeparator />

            <ContextMenuItem
              onClick={() => {
                openCompose({
                  to: [item.sender.email],
                  subject: item.subject.startsWith("Re:")
                    ? item.subject
                    : `Re: ${item.subject}`,
                });
              }}
            >
              <Reply />
              <span>Reply</span>
              <ContextMenuShortcut>R</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuItem
              onClick={() => {
                openCompose({
                  subject: item.subject.startsWith("Fwd:")
                    ? item.subject
                    : `Fwd: ${item.subject}`,
                  body: `\n\n---------- Forwarded message ---------\nFrom: ${item.sender.name} <${item.sender.email}>\nSubject: ${item.subject}\n\n${item.rawText || item.preview || ""}`,
                });
              }}
            >
              <Forward />
              <span>Forward</span>
              <ContextMenuShortcut>F</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuSeparator />

            {folder === "Trash" ? (
              <>
                <ContextMenuItem onClick={() => onRestore?.(item.id)}>
                  <RotateCcw />
                  <span>Restore to inbox</span>
                  <ContextMenuShortcut>R</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem
                  variant="destructive"
                  onClick={() => onDeletePermanent?.(item.id)}
                >
                  <Trash2 />
                  <span>Delete permanently</span>
                </ContextMenuItem>
              </>
            ) : (
              <>
                <ContextMenuItem onClick={() => onArchive?.(item.id)}>
                  <Archive />
                  <span>Archive</span>
                  <ContextMenuShortcut>E</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem
                  variant="destructive"
                  onClick={() => onTrash?.(item.id)}
                >
                  <Trash2 />
                  <span>Move to trash</span>
                  <ContextMenuShortcut>#</ContextMenuShortcut>
                </ContextMenuItem>
              </>
            )}

            {allLabels && allLabels.length > 0 && (
              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  <Tag />
                  <span>Apply label...</span>
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="w-48">
                  {allLabels.map((l) => (
                    <ContextMenuItem
                      key={l.id}
                      onClick={() => onApplyLabel?.(item.id, l.name)}
                    >
                      <Tag />
                      <span>{l.name}</span>
                    </ContextMenuItem>
                  ))}
                </ContextMenuSubContent>
              </ContextMenuSub>
            )}

            <ContextMenuSeparator />

            <ContextMenuItem
              onClick={() => {
                navigator.clipboard.writeText(item.subject);
                toast.success("Subject copied to clipboard");
              }}
            >
              <Copy />
              <span>Copy subject</span>
            </ContextMenuItem>

            <ContextMenuItem
              onClick={() => {
                navigator.clipboard.writeText(item.sender.email);
                toast.success("Sender email copied to clipboard");
              }}
            >
              <Mail />
              <span>Copy sender address</span>
            </ContextMenuItem>

            <ContextMenuItem onClick={(e) => onToggleSelect(item.id, e as any)}>
              {isSelected ? <CheckSquare /> : <Square />}
              <span>{isSelected ? "Deselect" : "Select conversation"}</span>
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
});

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

  const { mail, setMail, initialLoading, isFetching, error } = useListData(
    folder,
    label,
    refreshTick,
  );

  const [filterTab, setFilterTab] = useState<"all" | "unread">("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [actioning, setActioning] = useState<string | null>(null);
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
    return getActionsForFolder(folder, !!label).primaryActions;
  }, [folder, label]);

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

  useEffect(() => {
    setSelected([]);
    if (lastSelectedIdRef.current) lastSelectedIdRef.current = null;
  }, [folder, label, filterTab]);

  const lastSelectedIdRef = useRef<string | null>(null);

  const toggleSelect = useCallback(
    (id: string, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      setSelected((cur) => {
        // Shift + Click Range Selection (Gmail-style)
        if (e?.shiftKey && lastSelectedIdRef.current) {
          const lastIdx = visible.findIndex(
            (m) => m.id === lastSelectedIdRef.current,
          );
          const currentIdx = visible.findIndex((m) => m.id === id);

          if (lastIdx !== -1 && currentIdx !== -1) {
            const start = Math.min(lastIdx, currentIdx);
            const end = Math.max(lastIdx, currentIdx);
            const rangeIds = visible.slice(start, end + 1).map((m) => m.id);
            const combined = Array.from(new Set([...cur, ...rangeIds]));
            lastSelectedIdRef.current = id;
            return combined;
          }
        }

        lastSelectedIdRef.current = id;
        return cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      });
    },
    [visible],
  );

  const selectAll = useCallback(() => {
    setSelected((cur) =>
      cur.length === visible.length && visible.length > 0
        ? []
        : visible.map((m) => m.id),
    );
  }, [visible]);

  const isSelectionMode = selected.length > 0;

  const handleOpen = useCallback(
    async (item: MailItem) => {
      setOpenId(item.id);
      if (item.unread) {
        setMail((prev) =>
          prev.map((m) => (m.id === item.id ? { ...m, unread: false } : m)),
        );
        try {
          await axios.patch(`/api/v1/messages/${item.id}/read`);
          refresh();
        } catch {}
      }
    },
    [setOpenId, setMail, refresh],
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
  }, [selected, openId, setOpenId, setMail, refresh]);

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
    [selected, openId, setOpenId, setMail, refresh],
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
    [selected, refresh],
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
          <div className="h-13 px-4 flex items-center justify-between gap-2 shrink-0">
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
          <div className="px-3 pb-2.5 h-10.5 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground pointer-events-none" />
              <Input
                ref={searchInputRef}
                placeholder="Search..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8 pr-10 h-8 text-xs bg-muted/50 border-transparent focus-visible:border-border focus-visible:bg-background shadow-none rounded-lg"
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
              <TabsList className="h-8 p-0.5 bg-muted/60">
                <TabsTrigger
                  value="all"
                  className="h-7 px-2.5 text-xs font-medium"
                >
                  All
                </TabsTrigger>
                <TabsTrigger
                  value="unread"
                  className="h-7 px-2.5 text-xs font-medium"
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
          className="flex-1 overflow-y-auto p-2 space-y-1.5 overscroll-y-contain relative select-none md:select-auto"
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
            </div>
          ) : (
            visible.map((item, idx) => (
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
            ))
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
