"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Paperclip, RefreshCw, Star, Tag, Trash2 } from "lucide-react";
import axios from "axios";
import { MailItem } from "../hooks/use-mail";
import { useMailContext } from "./mail-context";
import { getActionsForFolder, MailActionConfig } from "@/lib/mail-actions";
import ConfirmDialog from "./confirm-dialog";
import { getInitials, avatarColor } from "@/lib/utils";

// ─── skeleton rows shown ONLY on initial cold boot ─────────────────────────────
function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="email-row skeleton-row">
          <span className="skel skel-avatar" />
          <div className="skel-body">
            <span className="skel skel-line skel-name" />
            <span className="skel skel-line skel-subject" />
            <span className="skel skel-line skel-preview" />
          </div>
        </div>
      ))}
    </>
  );
}

// ─── memoized email row component to prevent full list re-renders ──────────────
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

      {/* row quick-actions — context-aware */}
      <div className="row-actions" onClick={(e) => e.stopPropagation()}>
        {primaryActions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              className="row-action-btn"
              title={action.tooltip}
              onClick={() => onSingleAction(action, item.id)}
            >
              <Icon />
            </button>
          );
        })}
      </div>

      <label className="check-wrap" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(item.id)}
        />
        <span />
      </label>

      <button
        className={`icon-button star-btn ${item.starred ? "is-starred" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          onStarToggle(item.id, !!item.starred);
        }}
        aria-label="Star conversation"
      >
        <Star className={item.starred ? "fill-star" : ""} />
      </button>

      <div
        className="avatar list-avatar"
        style={{ background: avatarColor(item.sender.name) }}
      >
        {item.sender.avatarUrl ? (
          <img src={item.sender.avatarUrl} alt={item.sender.name} />
        ) : (
          getInitials(item.sender.name)
        )}
      </div>

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
                <em key={lbl}>{lbl}</em>
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

// ─── data hook with data preservation ─────────────────────────────────────────
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

// ─── main component ───────────────────────────────────────────────────────────
export default function MailListPane() {
  const {
    folder,
    label,
    query,
    openId,
    setOpenId,
    notify,
    refresh,
    refreshTick,
  } = useMailContext();

  const { mail, setMail, initialLoading, isFetching, error } = useListData(
    folder,
    label,
    refreshTick,
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [actioning, setActioning] = useState<string | null>(null);

  // Label bulk action state
  const [allLabels, setAllLabels] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [labelBulkOpen, setLabelBulkOpen] = useState(false);
  const labelBulkRef = useRef<HTMLDivElement>(null);

  // Fetch labels
  useEffect(() => {
    axios
      .get("/api/v1/labels")
      .then((res) => setAllLabels(res.data || []))
      .catch(() => {});
  }, [refreshTick]);

  // Close label dropdown on outside click
  useEffect(() => {
    if (!labelBulkOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        labelBulkRef.current &&
        !labelBulkRef.current.contains(e.target as Node)
      ) {
        setLabelBulkOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [labelBulkOpen]);

  async function handleBulkLabel(lbl: string) {
    if (selected.length === 0) return;
    try {
      await axios.post("/api/v1/messages/bulk/labels", {
        messageIds: selected,
        label: lbl,
        action: "add",
      });
      notify(
        `Label "${lbl}" added to ${selected.length} message${selected.length > 1 ? "s" : ""}`,
      );
      setLabelBulkOpen(false);
      setSelected([]);
      refresh();
    } catch {
      notify("Failed to apply label");
    }
  }

  // Dialog states
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
        notify(res.data.starred ? "Message starred" : "Message unstarred");
        refresh();
      } catch {
        setMail((prev) =>
          prev.map((m) =>
            m.id === id ? { ...m, starred: currentStarred } : m,
          ),
        );
        notify("Failed to update star");
      }
    },
    [setMail, notify, refresh],
  );

  const executeRestore = useCallback(
    async (id: string) => {
      setActioning(id);
      try {
        await axios.post(`/api/v1/messages/${id}/restore`);
        setMail((prev) => prev.filter((m) => m.id !== id));
        if (openId === id) setOpenId(null);
        notify(folder === "Archive" ? "Moved to Inbox" : "Restored to Inbox");
        refresh();
      } catch {
        notify("Failed to restore message");
      } finally {
        setActioning(null);
      }
    },
    [folder, openId, setOpenId, setMail, notify, refresh],
  );

  const executeArchive = useCallback(
    async (id: string) => {
      setActioning(id);
      try {
        await axios.post(`/api/v1/messages/${id}/archive`);
        setMail((prev) => prev.filter((m) => m.id !== id));
        if (openId === id) setOpenId(null);
        notify("Message archived");
        refresh();
      } catch {
        notify("Failed to archive message");
      } finally {
        setActioning(null);
      }
    },
    [openId, setOpenId, setMail, notify, refresh],
  );

  const executeTrash = useCallback(
    async (id: string) => {
      setActioning(id);
      try {
        await axios.post(`/api/v1/messages/${id}/trash`);
        setMail((prev) => prev.filter((m) => m.id !== id));
        if (openId === id) setOpenId(null);
        notify(folder === "Sent" ? "Removed from Sent" : "Moved to trash");
        refresh();
      } catch {
        notify("Failed to move to trash");
      } finally {
        setActioning(null);
      }
    },
    [folder, openId, setOpenId, setMail, notify, refresh],
  );

  const executeDeletePermanent = useCallback(
    async (id: string) => {
      setActioning(id);
      try {
        await axios.delete(`/api/v1/messages/${id}`);
        setMail((prev) => prev.filter((m) => m.id !== id));
        if (openId === id) setOpenId(null);
        notify("Permanently deleted message");
        refresh();
      } catch {
        notify("Failed to delete message");
      } finally {
        setActioning(null);
      }
    },
    [openId, setOpenId, setMail, notify, refresh],
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
      for (const id of selected) await executeTrash(id);
      setSelected([]);
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
          notify("Trash emptied");
          refresh();
        } catch {
          notify("Failed to empty trash");
        }
      },
    });
  }

  return (
    <>
      <section className={`list-pane ${openId ? "has-open" : ""}`}>
        {/* heading */}
        <div className="pane-heading">
          <div className="pane-heading-title">
            <h1>{label ? `#${label}` : folder || "Mail"}</h1>
            {!initialLoading && <span>{visible.length} conversations</span>}
          </div>
          <div className="flex items-center gap-2">
            {canEmptyFolder && visible.length > 0 && !initialLoading && (
              <button
                className="empty-trash-btn"
                onClick={handleEmptyTrash}
                title="Permanently remove all trashed messages"
              >
                <Trash2 />
                <span>Empty Trash</span>
              </button>
            )}
            <button
              className={`icon-button refresh-btn ${
                isFetching ? "spinning" : ""
              }`}
              onClick={() => {
                refresh();
                notify("Refreshed");
              }}
              aria-label="Refresh"
            >
              <RefreshCw />
            </button>
          </div>
        </div>

        {/* toolbar */}
        <div className="list-toolbar">
          <label className="check-wrap">
            <input
              type="checkbox"
              checked={selected.length === visible.length && visible.length > 0}
              onChange={selectAll}
            />
            <span />
          </label>
          {selected.length > 0 ? (
            <>
              <span className="selection-count">
                {selected.length} selected
              </span>
              {primaryActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    className="toolbar-action"
                    onClick={() => handleBulkAction(action)}
                    title={action.tooltip}
                  >
                    <Icon />
                    <span>{action.label}</span>
                  </button>
                );
              })}
              {/* Label bulk action */}
              <div className="label-bulk-wrap" ref={labelBulkRef}>
                <button
                  className="toolbar-action"
                  onClick={() => setLabelBulkOpen((v) => !v)}
                  title="Label selected conversations"
                >
                  <Tag />
                  <span>Label as</span>
                </button>
                {labelBulkOpen && (
                  <div className="label-dropdown bulk-label-dropdown">
                    {allLabels.length === 0 ? (
                      <p className="label-dropdown-empty">
                        No labels yet. Create one in the sidebar.
                      </p>
                    ) : (
                      <div className="label-dropdown-list">
                        {allLabels.map((lbl) => (
                          <button
                            key={lbl.id}
                            className="label-dropdown-item"
                            onClick={() => handleBulkLabel(lbl.name)}
                          >
                            <Tag />
                            {lbl.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <span className="list-hint">Select conversations to manage</span>
          )}
        </div>

        {/* list */}
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
              <div className="empty-icon">✉️</div>
              <strong>Nothing here</strong>
              <span>
                {query
                  ? `No results for "${query}"`
                  : `Your ${folder || "folder"} is empty`}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Confirmation modal */}
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
