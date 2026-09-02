"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  Download,
  FileText,
  Forward,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  Reply,
  ReplyAll,
  Star,
  Tag,
  X,
} from "lucide-react";
import axios from "axios";
import { MailItem } from "../hooks/use-mail";
import { useMailContext } from "./mail-context";
import { getActionsForFolder, MailActionConfig } from "@/lib/mail-actions";
import ConfirmDialog from "./confirm-dialog";

// ─── skeleton for message body ────────────────────────────────────────────────
function MessageSkeleton() {
  return (
    <div className="message-skeleton">
      <div className="mskel-head">
        <span className="skel skel-avatar" />
        <div className="mskel-info">
          <span className="skel skel-line" style={{ width: "40%" }} />
          <span className="skel skel-line" style={{ width: "60%" }} />
        </div>
      </div>
      <div className="mskel-body">
        {[100, 85, 90, 60, 75, 50].map((w, i) => (
          <span key={i} className="skel skel-line" style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  );
}

// ─── data hook ────────────────────────────────────────────────────────────────
function useMessageDetail(id: string | null) {
  const [message, setMessage] = useState<MailItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) {
      setMessage(null);
      return;
    }
    let mounted = true;
    setLoading(true);
    setError(false);
    axios
      .get(`/api/v1/messages/${id}`)
      .then((res) => {
        if (!mounted) return;
        const e = res.data;
        if (e?.id) {
          setMessage({
            id: e.id,
            sender: {
              name: e.from?.split("<")[0].trim() || e.from || "Unknown",
              email: e.from || "",
            },
            to: Array.isArray(e.to) ? e.to : (e.to ? [e.to] : []),
            cc: Array.isArray(e.cc) ? e.cc : (e.cc ? [e.cc] : []),
            bcc: Array.isArray(e.bcc) ? e.bcc : (e.bcc ? [e.bcc] : []),
            subject: e.subject || "No Subject",
            preview: "",
            rawText: e.text || "",
            body:
              e.html ||
              (e.text
                ? `<pre style="font-family:inherit;white-space:pre-wrap">${e.text}</pre>`
                : "<p><em>No content</em></p>"),
            timestamp: e.createdAt || e.created_at || new Date().toISOString(),
            folder: e.folder,
            status: e.status,
            unread: e.unread,
            starred: e.starred,
            labels: e.labels || [],
            attachments: (e.attachments || []).map((a: any) => ({
              id: a.id,
              filename: a.filename,
              sizeBytes: a.size || 0,
              url: a.download_url || "#",
              type: a.content_type || "application/octet-stream",
            })),
          });
        }
      })
      .catch(() => {
        if (mounted) setError(true);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [id]);

  return { message, setMessage, loading, error };
}

import { getInitials, avatarColor } from "@/lib/utils";

function htmlToPlainText(html: string): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .trim();
}

// ─── build quoted body for forwarding ────────────────────────────────────────
function buildForwardBody(message: {
  sender: { name: string; email: string };
  timestamp: string;
  subject: string;
  body: string;
}): string {
  const date = new Date(message.timestamp).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const senderDisplay =
    message.sender.name &&
    message.sender.name !== message.sender.email &&
    !message.sender.name.includes("@")
      ? `${message.sender.name} <${message.sender.email}>`
      : message.sender.email || message.sender.name || "Unknown";

  const plain = htmlToPlainText(message.body);

  return `\n\n---------- Forwarded message ---------\nFrom: ${senderDisplay}\nDate: ${date}\nSubject: ${message.subject}\n\n${plain}`;
}

// ─── main component ───────────────────────────────────────────────────────────
export default function MailDetailPane() {
  const {
    folder,
    label,
    openId,
    setOpenId,
    openCompose,
    notify,
    refresh,
    refreshTick,
  } = useMailContext();
  const { message, setMessage, loading, error } = useMessageDetail(openId);
  const [menu, setMenu] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Label management state
  const [allLabels, setAllLabels] = useState<Array<{ id: string; name: string }>>([]);
  const [labelDropOpen, setLabelDropOpen] = useState(false);
  const [labelSearch, setLabelSearch] = useState("");
  const labelDropRef = useRef<HTMLDivElement>(null);

  // Load available labels
  useEffect(() => {
    axios.get("/api/v1/labels").then((res) => setAllLabels(res.data || [])).catch(() => {});
  }, [refreshTick]);

  // Close label dropdown on outside click
  useEffect(() => {
    if (!labelDropOpen) return;
    function handleClick(e: MouseEvent) {
      if (labelDropRef.current && !labelDropRef.current.contains(e.target as Node)) {
        setLabelDropOpen(false);
        setLabelSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [labelDropOpen]);

  async function removeLabel(lbl: string) {
    if (!message) return;
    try {
      await axios.delete(`/api/v1/messages/${message.id}/labels?label=${encodeURIComponent(lbl)}`);
      setMessage({ ...message, labels: (message.labels || []).filter((l) => l !== lbl) });
      notify(`Removed label "${lbl}"`);
      refresh();
    } catch {
      notify("Failed to remove label");
    }
  }

  async function addLabel(lbl: string) {
    if (!message) return;
    if ((message.labels || []).includes(lbl)) {
      setLabelDropOpen(false);
      setLabelSearch("");
      return;
    }
    try {
      await axios.post(`/api/v1/messages/${message.id}/labels`, { label: lbl });
      setMessage({ ...message, labels: [...(message.labels || []), lbl] });
      notify(`Added label "${lbl}"`);
      setLabelDropOpen(false);
      setLabelSearch("");
      refresh();
    } catch {
      notify("Failed to add label");
    }
  }

  async function createAndAddLabel(name: string) {
    if (!message || !name.trim()) return;
    try {
      await axios.post("/api/v1/labels", { name: name.trim() });
      await addLabel(name.trim());
      refresh();
    } catch (err: any) {
      notify(err.response?.data?.error || "Failed to create label");
    }
  }

  // Confirm dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { primaryActions } = useMemo(
    () => getActionsForFolder(folder, !!label),
    [folder, label]
  );

  function toggleMenu(name: string) {
    setMenu((cur) => (cur === name ? null : name));
  }

  function menuAction(msg: string) {
    setMenu(null);
    notify(msg);
  }

  async function starToggle() {
    if (!message) return;
    try {
      const res = await axios.post(`/api/v1/messages/${message.id}/star`, {
        starred: !message.starred,
      });
      setMessage({ ...message, starred: res.data.starred });
      notify(res.data.starred ? "Message starred" : "Message unstarred");
      refresh();
    } catch {
      notify("Failed to update star");
    }
  }

  async function handleToolbarAction(action: MailActionConfig) {
    if (!message) return;

    if (action.id === "delete_permanent") {
      setConfirmOpen(true);
      return;
    }

    if (action.id === "restore") {
      await executeRestore();
    } else if (action.id === "archive") {
      await executeArchive();
    } else if (action.id === "trash") {
      await executeTrash();
    }
  }

  async function executeRestore() {
    if (!message) return;
    setActionInProgress("restore");
    try {
      await axios.post(`/api/v1/messages/${message.id}/restore`);
      notify(folder === "Archive" ? "Moved to Inbox" : "Restored to Inbox");
      setOpenId(null);
      refresh();
    } catch {
      notify("Failed to restore message");
    } finally {
      setActionInProgress(null);
    }
  }

  async function executeArchive() {
    if (!message) return;
    setActionInProgress("archive");
    try {
      await axios.post(`/api/v1/messages/${message.id}/archive`);
      notify("Message archived");
      setOpenId(null);
      refresh();
    } catch {
      notify("Failed to archive message");
    } finally {
      setActionInProgress(null);
    }
  }

  async function executeTrash() {
    if (!message) return;
    setActionInProgress("trash");
    try {
      await axios.post(`/api/v1/messages/${message.id}/trash`);
      notify(folder === "Sent" ? "Removed from Sent" : "Moved to trash");
      setOpenId(null);
      refresh();
    } catch {
      notify("Failed to move to trash");
    } finally {
      setActionInProgress(null);
    }
  }

  async function executeDeletePermanent() {
    if (!message) return;
    setConfirmOpen(false);
    setActionInProgress("delete_permanent");
    try {
      await axios.delete(`/api/v1/messages/${message.id}`);
      notify("Permanently deleted message");
      setOpenId(null);
      refresh();
    } catch {
      notify("Failed to delete message");
    } finally {
      setActionInProgress(null);
    }
  }

  // ── empty state ───────────────────────────────────────────────────────────
  if (!openId) {
    return (
      <section className="detail-pane">
        <div className="detail-empty">
          <div className="detail-empty-icon">
            <Mail />
          </div>
          <h3>Select a message to read it</h3>
          <p>Your conversations will appear here</p>
        </div>
      </section>
    );
  }

  // ── error state ───────────────────────────────────────────────────────────
  if (error) {
    return (
      <section className="detail-pane detail-visible">
        <div className="detail-toolbar">
          <button
            className="icon-button back-button"
            onClick={() => setOpenId(null)}
            aria-label="Back"
          >
            <ArrowLeft />
          </button>
        </div>
        <div className="detail-error">
          <p>Could not load this message.</p>
          <button onClick={() => refresh()}>Retry</button>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="detail-pane detail-visible">
        {/* fixed toolbar */}
        <div className="detail-toolbar">
          <button
            className="icon-button back-button"
            onClick={() => setOpenId(null)}
            aria-label="Back"
          >
            <ArrowLeft />
          </button>

          {message && (
            <>
              {folder === "Drafts" || message.folder === "drafts" || message.status === "draft" ? (
                <button
                  className="button-primary"
                  style={{ padding: "6px 14px", fontSize: "12px", borderRadius: "6px", gap: "6px" }}
                  onClick={() =>
                    openCompose({
                      draftId: message.id,
                      to: message.to,
                      cc: message.cc,
                      bcc: message.bcc,
                      subject: message.subject,
                      body: message.rawText || htmlToPlainText(message.body),
                    })
                  }
                >
                  <Pencil style={{ width: 14, height: 14 }} /> Edit draft
                </button>
              ) : (
                <div className="toolbar-reply-group">
                  <button
                    className="icon-button toolbar-btn"
                    title="Reply"
                    aria-label="Reply"
                    onClick={() =>
                      openCompose({
                        to: [message.sender.email],
                        subject: message.subject.startsWith("Re:")
                          ? message.subject
                          : `Re: ${message.subject}`,
                      })
                    }
                  >
                    <Reply />
                  </button>
                  <button
                    className="icon-button toolbar-btn"
                    title="Reply All"
                    aria-label="Reply All"
                    onClick={() =>
                      openCompose({
                        to: [message.sender.email],
                        subject: message.subject.startsWith("Re:")
                          ? message.subject
                          : `Re: ${message.subject}`,
                      })
                    }
                  >
                    <ReplyAll />
                  </button>
                  <button
                    className="icon-button toolbar-btn"
                    title="Forward"
                    aria-label="Forward"
                    onClick={() =>
                      openCompose({
                        to: [],
                        subject: message.subject.startsWith("Fwd:")
                          ? message.subject
                          : `Fwd: ${message.subject}`,
                        body: buildForwardBody(message),
                      })
                    }
                  >
                    <Forward />
                  </button>
                </div>
              )}
            </>
          )}

          <div className="toolbar-spacer" />

          {message && (
            <>
              {primaryActions.map((action) => {
                const Icon = action.icon;
                const inProgress = actionInProgress === action.id;
                return (
                  <button
                    key={action.id}
                    className={`icon-button toolbar-btn ${
                      inProgress ? "loading-btn" : ""
                    }`}
                    onClick={() => handleToolbarAction(action)}
                    aria-label={action.label}
                    title={action.tooltip}
                    disabled={!!actionInProgress}
                  >
                    <Icon />
                  </button>
                );
              })}
            </>
          )}

          <div className="menu-wrap">
            <button
              className="icon-button"
              onClick={() => toggleMenu("detail-more")}
              aria-label="More conversation actions"
            >
              <MoreHorizontal />
            </button>
            {menu === "detail-more" && (
              <div className="dropdown">
                <button onClick={() => menuAction("Marked as unread")}>
                  Mark as unread
                </button>
                <button onClick={() => menuAction("Conversation copied")}>
                  Copy link
                </button>
                <button onClick={() => menuAction("Conversation printed")}>
                  Print
                </button>
              </div>
            )}
          </div>
        </div>

        {/* scrollable body */}
        <div className="detail-scroll-area">
          <div className="detail-content">
            {/* subject + star */}
            {message && (
              <div className="detail-heading">
                <div className="detail-heading-left">
                  <div className="label-row">
                    {message.labels?.map((lbl) => (
                      <span key={lbl} className="detail-label-chip">
                        <Tag />
                        {lbl}
                        <button
                          className="chip-remove-btn"
                          onClick={() => removeLabel(lbl)}
                          aria-label={`Remove label ${lbl}`}
                          title={`Remove label ${lbl}`}
                        >
                          <X />
                        </button>
                      </span>
                    ))}
                    {/* + Label button */}
                    <div className="label-add-wrap" ref={labelDropRef}>
                      <button
                        className="add-label-btn"
                        onClick={() => setLabelDropOpen((v) => !v)}
                        title="Add label"
                        aria-label="Add label"
                      >
                        <Plus /> Label
                      </button>
                      {labelDropOpen && (
                        <div className="label-dropdown">
                          <input
                            className="label-dropdown-search"
                            placeholder="Search or create..."
                            value={labelSearch}
                            onChange={(e) => setLabelSearch(e.target.value)}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && labelSearch.trim()) {
                                const exact = allLabels.find(
                                  (l) => l.name.toLowerCase() === labelSearch.trim().toLowerCase()
                                );
                                if (exact) addLabel(exact.name);
                                else createAndAddLabel(labelSearch.trim());
                              }
                            }}
                          />
                          <div className="label-dropdown-list">
                            {allLabels
                              .filter((l) =>
                                l.name.toLowerCase().includes(labelSearch.toLowerCase())
                              )
                              .map((l) => (
                                <button
                                  key={l.id}
                                  className={`label-dropdown-item ${
                                    (message.labels || []).includes(l.name) ? "already-applied" : ""
                                  }`}
                                  onClick={() => addLabel(l.name)}
                                >
                                  <Tag />
                                  {l.name}
                                  {(message.labels || []).includes(l.name) && (
                                    <span className="check-mark">✓</span>
                                  )}
                                </button>
                              ))}
                            {labelSearch.trim() &&
                              !allLabels.some(
                                (l) => l.name.toLowerCase() === labelSearch.trim().toLowerCase()
                              ) && (
                                <button
                                  className="label-dropdown-item create-new"
                                  onClick={() => createAndAddLabel(labelSearch.trim())}
                                >
                                  <Plus /> Create &quot;{labelSearch.trim()}&quot;
                                </button>
                              )}
                            {allLabels.length === 0 && !labelSearch.trim() && (
                              <p className="label-dropdown-empty">No labels yet. Type to create one.</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <h2>{message.subject}</h2>
                </div>
                <button
                  className={`icon-button star-btn ${
                    message.starred ? "is-starred" : ""
                  }`}
                  onClick={starToggle}
                  aria-label="Star conversation"
                >
                  <Star className={message.starred ? "fill-star" : ""} />
                </button>
              </div>
            )}

            {/* skeleton heading while loading */}
            {loading && !message && (
              <div className="detail-heading">
                <div style={{ flex: 1 }}>
                  <span
                    className="skel skel-line"
                    style={{ width: "30%", marginBottom: 12 }}
                  />
                  <span
                    className="skel skel-line"
                    style={{ width: "70%", height: 28 }}
                  />
                </div>
              </div>
            )}

            {/* message bubble */}
            <div className="message message-card">
              {loading ? (
                <MessageSkeleton />
              ) : message ? (
                <>
                  {/* sender row */}
                  <div className="message-head">
                    <div
                      className="avatar large"
                      style={{ background: avatarColor(message.sender.name) }}
                    >
                      {message.sender.avatarUrl ? (
                        <img
                          src={message.sender.avatarUrl}
                          alt={message.sender.name}
                        />
                      ) : (
                        getInitials(message.sender.name)
                      )}
                    </div>
                    <div className="sender-info">
                      <strong>{message.sender.name}</strong>
                      <span className="sender-email">
                        {message.sender.email}
                      </span>
                      <span className="sender-to">to me</span>
                    </div>
                    <time className="message-time">
                      {new Date(message.timestamp).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                    <div className="menu-wrap">
                      <button
                        className="icon-button small"
                        aria-label="Message options"
                        onClick={() => toggleMenu("message-options")}
                      >
                        <ChevronDown />
                      </button>
                      {menu === "message-options" && (
                        <div className="dropdown">
                          <button
                            onClick={() => menuAction("Message expanded")}
                          >
                            Expand message
                          </button>
                          <button
                            onClick={() => menuAction("Message downloaded")}
                          >
                            Download message
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* body */}
                  <div
                    className="email-body-content"
                    dangerouslySetInnerHTML={{ __html: message.body }}
                  />

                  {/* attachments */}
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="attachments-section">
                      <strong className="attachments-label">
                        {message.attachments.length} attachment
                        {message.attachments.length > 1 ? "s" : ""}
                      </strong>
                      <div className="attachments-list">
                        {message.attachments.map((att) => (
                          <a
                            key={att.id}
                            className="attachment"
                            href={att.url}
                            download={att.filename}
                          >
                            <div className="attachment-icon">
                              <FileText />
                            </div>
                            <div className="attachment-info">
                              <strong>{att.filename}</strong>
                              <span>
                                {att.type.split("/")[1]?.toUpperCase() ||
                                  "FILE"}{" "}
                                ·{" "}
                                {att.sizeBytes < 1024
                                  ? `${att.sizeBytes} B`
                                  : att.sizeBytes < 1024 * 1024
                                  ? `${Math.round(att.sizeBytes / 1024)} KB`
                                  : `${(
                                      att.sizeBytes /
                                      (1024 * 1024)
                                    ).toFixed(1)} MB`}
                              </span>
                            </div>
                            <Download className="attachment-download" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* reply / draft actions at bottom */}
            {message && !loading && (
              <div className="reply-actions">
                {folder === "Drafts" || message.folder === "drafts" || message.status === "draft" ? (
                  <button
                    className="button-primary"
                    style={{ padding: "9px 18px", borderRadius: "6px", gap: "8px" }}
                    onClick={() =>
                      openCompose({
                        draftId: message.id,
                        to: message.to,
                        cc: message.cc,
                        bcc: message.bcc,
                        subject: message.subject,
                        body: message.rawText || htmlToPlainText(message.body),
                      })
                    }
                  >
                    <Pencil style={{ width: 14, height: 14 }} /> Continue editing draft
                  </button>
                ) : (
                  <>
                    <button
                      className="reply-btn"
                      onClick={() =>
                        openCompose({
                          to: [message.sender.email],
                          subject: message.subject.startsWith("Re:")
                            ? message.subject
                            : `Re: ${message.subject}`,
                        })
                      }
                    >
                      <Reply /> Reply
                    </button>
                    <button
                      className="reply-btn"
                      onClick={() =>
                        openCompose({
                          to: [],
                          subject: message.subject.startsWith("Fwd:")
                            ? message.subject
                            : `Fwd: ${message.subject}`,
                          body: buildForwardBody(message),
                        })
                      }
                    >
                      <Forward /> Forward
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Permanent deletion confirmation modal */}
      <ConfirmDialog
        isOpen={confirmOpen}
        title="Delete Permanently?"
        description="This message will be permanently removed from your account. You cannot undo this action."
        confirmLabel="Delete Permanently"
        onConfirm={executeDeletePermanent}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
