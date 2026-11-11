"use client";

import { memo, useCallback, useRef } from "react";
import { motion } from "motion/react";
import {
  scale,
  spring,
  transition,
  useShouldReduceMotion,
  useTempoTransition,
} from "@animate-ui/react/utils/motion";
import {
  Archive, Check, CheckSquare, Copy, Forward, Mail, MailOpen, Paperclip,
  Reply, RotateCcw, Square, Star, Tag, Trash2,
} from "@/components/animate-ui/icons";
import type { Folder, MailItem } from "../../hooks/use-mail";
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuLabel,
  ContextMenuSeparator, ContextMenuShortcut, ContextMenuSub,
  ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useMailContext } from "@/components/mail-context";
import type { MailActionConfig } from "@/lib/mail-actions";
import { cn, getInitials, avatarColor } from "@/lib/utils";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function formatMailDate(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const diffDays = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}
export interface EmailRowItemProps {
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

export const EmailRowItem = memo(function EmailRowItem({
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
  const reduce = useShouldReduceMotion();
  const enter = useTempoTransition({
    ...transition.reveal,
    delay: index !== undefined ? Math.min(index * 0.02, 0.2) : 0,
  });
  const press = useTempoTransition(spring.press);
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
          <motion.div
            initial={{ opacity: 0, transform: "scale(1)" }}
            animate={{ opacity: 1, transform: "scale(1)", transition: enter }}
            whileTap={reduce ? undefined : { transform: `scale(${scale.choice})` }}
            transition={press}
            role="button"
            tabIndex={0}
            onClick={handleClick}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen(item);
              }
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            data-slot="email-row-item"
            className={cn(
              "w-full flex items-start gap-2.5 rounded-lg border py-2 px-2.5 text-left transition-[color,background-color,border-color,box-shadow] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer relative group select-none min-h-[72px] h-[72px] max-md:min-h-[84px] max-md:h-[84px] box-border",
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
              className="relative shrink-0 mt-0.5 cursor-pointer select-none transition-transform duration-75 hover:scale-105 active:scale-95 max-md:size-11 max-md:-ml-2 max-md:flex max-md:items-center max-md:justify-center"
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
                      "size-10 md:size-5 flex items-center justify-center rounded-xs transition-all duration-150 active:scale-110 cursor-pointer [@media(hover:none)]:opacity-70",
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
          </motion.div>
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
            <ContextMenuItem onClick={(e) => onToggleSelect(item.id, e as React.MouseEvent)}>
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
              onClick={(e) => onStarToggle(item.id, !!item.starred, e as React.MouseEvent)}
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

            <ContextMenuItem onClick={(e) => onToggleSelect(item.id, e as React.MouseEvent)}>
              {isSelected ? <CheckSquare /> : <Square />}
              <span>{isSelected ? "Deselect" : "Select conversation"}</span>
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
});

