"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Paperclip, Pencil, RefreshCw, Star, Tag, Trash2 } from "lucide-react";
import axios from "axios";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { MailItem } from "../hooks/use-mail";
import { useMailContext } from "./mail-context";
import { getActionsForFolder, MailActionConfig } from "@/lib/mail-actions";
import ConfirmDialog from "./confirm-dialog";
import { getInitials, avatarColor } from "@/lib/utils";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
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

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="email-row skeleton-row items-center gap-3 p-3.5">
          <Skeleton className="size-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/4" />
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </>
  );
}

interface EmailRowProps {
  item: MailItem;
  isOpen: boolean;
  isSelected: boolean;
  isActioning: boolean;
  primaryActions: MailActionConfig[];
  onOpen: (item: MailItem) => void;
  onToggleSelect: (id: string) => void;
  onStarToggle: (id: string, starred: boolean) => void;
  onSingleAction: (action: MailActionConfig, id: string) => void;
}

const EmailRow = memo(function EmailRow({
  item,
  isOpen,
  isSelected,
  isActioning,
  primaryActions,
  onOpen,
  onToggleSelect,
  onStarToggle,
  onSingleAction,
}: EmailRowProps) {
  return (
    <article
      className={`email-row ${isOpen ? "selected" : ""} ${
        item.unread ? "unread" : ""
      } ${isActioning ? "actioning" : ""}`}
      onClick={() => onOpen(item)}
    >
      {item.unread && (
        <div className="unread-indicator">
          <div className="unread-dot" />
        </div>
      )}

      {/* Quick hover actions */}
      <div className="row-actions" onClick={(e) => e.stopPropagation()}>
        {primaryActions.map((action) => {
          const Icon = action.icon;
          return (
            <Tooltip key={action.id}>
              <TooltipTrigger
                render={
                  <button
                    className="row-action-btn"
                    aria-label={action.label}
                    onClick={() => onSingleAction(action, item.id)}
                  />
                }
              >
                <Icon className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent>{action.tooltip}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      <div onClick={(e) => e.stopPropagation()} className="pt-0.5 flex items-center">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect(item.id)}
          aria-label={`Select ${item.sender.name}`}
        />
      </div>

      <Tooltip>
        <TooltipTrigger
          render={
            <button
              className={`icon-button star-btn ${item.starred ? "is-starred" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onStarToggle(item.id, !!item.starred);
              }}
              aria-label={item.starred ? "Unstar conversation" : "Star conversation"}
            />
          }
        >
          <Star className={`size-4 ${item.starred ? "fill-star" : ""}`} />
        </TooltipTrigger>
        <TooltipContent>{item.starred ? "Unstar" : "Star"}</TooltipContent>
      </Tooltip>

      <Avatar className="size-8 shrink-0">
        {item.sender.avatarUrl && (
          <AvatarImage src={item.sender.avatarUrl} alt={item.sender.name} />
        )}
        <AvatarFallback
          style={{ background: avatarColor(item.sender.name), color: "#ffffff" }}
          className="text-xs font-semibold"
        >
          {getInitials(item.sender.name)}
        </AvatarFallback>
      </Avatar>

      <div className="email-copy">
        <div className="email-meta">
          <strong>{item.sender.name}</strong>
          <time dateTime={item.timestamp}>
            {new Date(item.timestamp).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </time>
        </div>
        <div className="subject-line">
          <span>{item.subject}</span>
          {item.labels && item.labels.length > 0 && (
            <div className="inline-labels">
              {item.labels.map((lbl) => (
                <Badge
                  key={lbl}
                  variant="secondary"
                  className="text-[10px] h-4.5 px-1.5 font-medium rounded"
                >
                  {lbl}
                </Badge>
              ))}
            </div>
          )}
          {item.attachments && item.attachments.length > 0 && <Paperclip />}
        </div>
        <p>{item.preview}</p>
      </div>
    </article>
  );
});

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
          preview: (e.text || e.html || "")
            .replace(/<[^>]+>/g, "")
            .slice(0, 130),
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

export default function MailListPane() {
  const {
    folder,
    label,
    query,
    openId,
    setOpenId,
    refresh,
    refreshTick,
    openCompose,
  } = useMailContext();

  const { theme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const currentTheme = theme === "system" ? systemTheme : theme;
  const isDark = mounted && currentTheme === "dark";

  const { mail, setMail, initialLoading, isFetching, error } = useListData(
    folder,
    label,
    refreshTick,
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [actioning, setActioning] = useState<string | null>(null);

  const [allLabels, setAllLabels] = useState<
    Array<{ id: string; name: string }>
  >([]);

  useEffect(() => {
    axios
      .get("/api/v1/labels")
      .then((res) => setAllLabels(res.data || []))
      .catch(() => {});
  }, [refreshTick]);

  async function handleBulkLabel(lbl: string) {
    if (selected.length === 0) return;
    try {
      await axios.post("/api/v1/messages/bulk/labels", {
        messageIds: selected,
        label: lbl,
        action: "add",
      });
      toast.success(
        `Label "${lbl}" added to ${selected.length} message${selected.length > 1 ? "s" : ""}`,
      );
      setSelected([]);
      refresh();
    } catch {
      toast.error("Failed to apply label");
    }
  }

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    description: "",
    onConfirm: () => {},
  });

  const { primaryActions, canEmptyFolder } = useMemo(
    () => getActionsForFolder(folder, !!label),
    [folder, label],
  );

  const visible = useMemo(() => {
    if (!query) return mail;
    const q = query.toLowerCase();
    return mail.filter((m) =>
      `${m.sender.name} ${m.subject} ${m.preview}`.toLowerCase().includes(q),
    );
  }, [mail, query]);

  const toggleSelect = useCallback((id: string) => {
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  }, []);

  const selectAll = useCallback(() => {
    setSelected((cur) =>
      cur.length === visible.length && visible.length > 0
        ? []
        : visible.map((m) => m.id),
    );
  }, [visible]);

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
    async (id: string, currentStarred: boolean) => {
      setMail((prev) =>
        prev.map((m) => (m.id === id ? { ...m, starred: !currentStarred } : m)),
      );
      try {
        const res = await axios.post(`/api/v1/messages/${id}/star`, {
          starred: !currentStarred,
        });
        toast.success(res.data.starred ? "Message starred" : "Message unstarred");
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

  const executeRestore = useCallback(
    async (id: string) => {
      setActioning(id);
      try {
        await axios.post(`/api/v1/messages/${id}/restore`);
        setMail((prev) => prev.filter((m) => m.id !== id));
        if (openId === id) setOpenId(null);
        toast.success(folder === "Archive" ? "Moved to Inbox" : "Restored to Inbox");
        refresh();
      } catch {
        toast.error("Failed to restore message");
      } finally {
        setActioning(null);
      }
    },
    [folder, openId, setOpenId, setMail, refresh],
  );

  const executeArchive = useCallback(
    async (id: string) => {
      setActioning(id);
      try {
        await axios.post(`/api/v1/messages/${id}/archive`);
        setMail((prev) => prev.filter((m) => m.id !== id));
        if (openId === id) setOpenId(null);
        toast.success("Message archived");
        refresh();
      } catch {
        toast.error("Failed to archive message");
      } finally {
        setActioning(null);
      }
    },
    [openId, setOpenId, setMail, refresh],
  );

  const executeTrash = useCallback(
    async (id: string) => {
      const itemToTrash = mail.find((m) => m.id === id);
      const originalFolder = folder ?? (label ? "inbox" : "inbox");

      setActioning(id);
      try {
        await axios.post(`/api/v1/messages/${id}/trash`);
        setMail((prev) => prev.filter((m) => m.id !== id));
        if (openId === id) setOpenId(null);
        refresh();

        const toastMsg = folder === "Sent" ? "Removed from Sent" : "Moved to trash";

        toast(toastMsg, {
          action: {
            label: "Undo",
            onClick: async () => {
              try {
                await axios.post(`/api/v1/messages/${id}/restore`, {
                  folder: originalFolder.toLowerCase(),
                });
                if (itemToTrash) {
                  setMail((prev) => {
                    if (prev.some((m) => m.id === id)) return prev;
                    return [itemToTrash, ...prev];
                  });
                }
                refresh();
                toast.success("Action undone");
              } catch (err) {
                console.error("Failed to undo deletion:", err);
                toast.error("Failed to undo deletion");
              }
            },
          },
          duration: 6000,
        });
      } catch {
        toast.error("Failed to move to trash");
      } finally {
        setActioning(null);
      }
    },
    [folder, label, mail, openId, setOpenId, setMail, refresh],
  );

  const executeBulkTrash = useCallback(
    async (ids: string[]) => {
      const itemsToTrash = mail.filter((m) => ids.includes(m.id));
      const originalFolder = folder ?? "inbox";
      const count = ids.length;

      try {
        await Promise.all(
          ids.map((id) => axios.post(`/api/v1/messages/${id}/trash`))
        );
        setMail((prev) => prev.filter((m) => !ids.includes(m.id)));
        if (openId && ids.includes(openId)) setOpenId(null);
        setSelected([]);
        refresh();

        const toastMsg =
          count === 1
            ? folder === "Sent"
              ? "Removed from Sent"
              : "Moved to trash"
            : `${count} conversations moved to trash`;

        toast(toastMsg, {
          action: {
            label: "Undo",
            onClick: async () => {
              try {
                await Promise.all(
                  ids.map((id) =>
                    axios.post(`/api/v1/messages/${id}/restore`, {
                      folder: originalFolder.toLowerCase(),
                    })
                  )
                );
                setMail((prev) => {
                  const existingIds = new Set(prev.map((m) => m.id));
                  const toRestore = itemsToTrash.filter(
                    (m) => !existingIds.has(m.id)
                  );
                  return [...toRestore, ...prev];
                });
                refresh();
                toast.success("Action undone");
              } catch (err) {
                console.error("Failed to undo deletion:", err);
                toast.error("Failed to undo deletion");
              }
            },
          },
          duration: 6000,
        });
      } catch {
        toast.error("Failed to move to trash");
      }
    },
    [folder, mail, openId, setOpenId, setMail, refresh],
  );

  const executeDeletePermanent = useCallback(
    async (id: string) => {
      setActioning(id);
      try {
        await axios.delete(`/api/v1/messages/${id}`);
        setMail((prev) => prev.filter((m) => m.id !== id));
        if (openId === id) setOpenId(null);
        toast.success("Permanently deleted message");
        refresh();
      } catch {
        toast.error("Failed to delete message");
      } finally {
        setActioning(null);
      }
    },
    [openId, setOpenId, setMail, refresh],
  );

  const handleSingleAction = useCallback(
    (action: MailActionConfig, id: string) => {
      if (action.id === "delete_permanent") {
        setConfirmDialog({
          isOpen: true,
          title: "Delete Permanently?",
          description:
            "This message will be permanently removed from your account. This action cannot be undone.",
          confirmLabel: "Delete Permanently",
          onConfirm: async () => {
            setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
            await executeDeletePermanent(id);
          },
        });
        return;
      }

      if (action.id === "restore") {
        executeRestore(id);
      } else if (action.id === "archive") {
        executeArchive(id);
      } else if (action.id === "trash") {
        executeTrash(id);
      }
    },
    [executeDeletePermanent, executeRestore, executeArchive, executeTrash],
  );

  async function handleBulkAction(action: MailActionConfig) {
    if (selected.length === 0) return;

    if (action.id === "delete_permanent") {
      setConfirmDialog({
        isOpen: true,
        title: `Delete ${selected.length} message${
          selected.length > 1 ? "s" : ""
        } permanently?`,
        description:
          "These conversations will be deleted forever. You cannot undo this action.",
        confirmLabel: "Delete Permanently",
        onConfirm: async () => {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          for (const id of selected) {
            await executeDeletePermanent(id);
          }
          setSelected([]);
        },
      });
      return;
    }

    if (action.id === "restore") {
      for (const id of selected) await executeRestore(id);
      setSelected([]);
    } else if (action.id === "archive") {
      for (const id of selected) await executeArchive(id);
      setSelected([]);
    } else if (action.id === "trash") {
      await executeBulkTrash(selected);
    }
  }

  function handleEmptyTrash() {
    setConfirmDialog({
      isOpen: true,
      title: "Empty Trash?",
      description:
        "All messages in Trash will be permanently deleted. This action cannot be undone.",
      confirmLabel: "Empty Trash",
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        try {
          await axios.post("/api/v1/messages/empty-trash");
          setMail([]);
          setOpenId(null);
          setSelected([]);
          toast.success("Trash emptied");
          refresh();
        } catch {
          toast.error("Failed to empty trash");
        }
      },
    });
  }

  return (
    <>
      <section
        className={`list-pane ${openId ? "has-open mobile-hidden" : ""}`}
      >
        {/* Header */}
        <div className="pane-heading">
          <div className="pane-heading-title">
            <h1>{label ? `#${label}` : folder || "Mail"}</h1>
            {!initialLoading && <span>{visible.length} conversations</span>}
          </div>
          <div className="flex items-center gap-1.5">
            {canEmptyFolder && visible.length > 0 && !initialLoading && (
              <Button
                variant="ghost"
                size="sm"
                className="empty-trash-btn h-7 px-2 text-xs gap-1 text-destructive hover:bg-destructive/10"
                onClick={handleEmptyTrash}
                title="Permanently remove all trashed messages"
              >
                <Trash2 className="size-3.5" />
                <span>Empty Trash</span>
              </Button>
            )}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className={`icon-button refresh-btn ${
                      isFetching ? "spinning" : ""
                    }`}
                    onClick={() => {
                      refresh();
                      toast.success("Refreshed");
                    }}
                    aria-label="Refresh"
                  />
                }
              >
                <RefreshCw className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent>Refresh conversations</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Bulk Actions / Search Toolbar */}
        <div className="list-toolbar">
          <div className="toolbar-left flex items-center gap-2.5">
            <Checkbox
              checked={selected.length === visible.length && visible.length > 0}
              onCheckedChange={selectAll}
              aria-label="Select all conversations"
            />
            {selected.length > 0 ? (
              <span className="selection-count">
                {selected.length} selected
              </span>
            ) : (
              <span className="list-hint">Select conversations to manage</span>
            )}
          </div>

          {selected.length > 0 && (
            <div className="toolbar-actions flex items-center gap-1">
              {primaryActions.map((action) => {
                const Icon = action.icon;
                const shortLabel =
                  action.id === "restore"
                    ? "Restore"
                    : action.id === "delete_permanent" || action.id === "trash"
                    ? "Delete"
                    : action.id === "archive"
                    ? "Archive"
                    : action.label;

                return (
                  <Tooltip key={action.id}>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="sm"
                          className="toolbar-action h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                          onClick={() => handleBulkAction(action)}
                          aria-label={action.label}
                        />
                      }
                    >
                      <Icon className="size-3.5" />
                      <span>{shortLabel}</span>
                    </TooltipTrigger>
                    <TooltipContent>{action.tooltip}</TooltipContent>
                  </Tooltip>
                );
              })}

              {/* Labels dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="toolbar-action h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                      aria-label="Label as"
                    />
                  }
                >
                  <Tag className="size-3.5" />
                  <span>Label</span>
                </DropdownMenuTrigger>
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
          )}
        </div>

        {/* Email list */}
        <div className={`email-list ${isFetching ? "fetching" : ""}`}>
          {initialLoading && <SkeletonRows />}

          {!initialLoading && error && (
            <div className="list-error">
              <span>Failed to load messages.</span>
              <button onClick={() => refresh()}>Try again</button>
            </div>
          )}

          {!initialLoading &&
            !error &&
            visible.map((item) => (
              <EmailRow
                key={item.id}
                item={item}
                isOpen={openId === item.id}
                isSelected={selected.includes(item.id)}
                isActioning={actioning === item.id}
                primaryActions={primaryActions}
                onOpen={handleOpen}
                onToggleSelect={toggleSelect}
                onStarToggle={handleStarToggle}
                onSingleAction={handleSingleAction}
              />
            ))}

          {!initialLoading && !isFetching && !error && visible.length === 0 && (
            <div className="empty">
              <div
                style={{
                  width: "300px",
                  margin: "0 auto",
                  marginBottom: "16px",
                }}
              >
                <DotLottieReact
                  src={isDark ? "/empty.json" : "/No-Item-In-Box.lottie"}
                  loop
                  autoplay
                />
              </div>
              <strong>Nothing here</strong>
              <span>
                {query
                  ? `No results for "${query}"`
                  : `Your ${folder || "folder"} is empty`}
              </span>
            </div>
          )}
        </div>

        <Button
          size="icon-lg"
          className="fab-compose mobile-only rounded-full shadow-lg"
          aria-label="Compose"
          onClick={() => openCompose()}
        >
          <Pencil className="size-5" />
        </Button>
      </section>

      {}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel={confirmDialog.confirmLabel}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() =>
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }))
        }
      />
    </>
  );
}
