"use client";

import { useEffect, useMemo, useState } from "react";
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
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

function MessageSkeleton() {
  return (
    <div className="message-skeleton p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full shrink-0" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <div className="space-y-3 pt-4">
        {[100, 85, 90, 60, 75, 50].map((w, i) => (
          <Skeleton key={i} className="h-3.5" style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  );
}


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
    refresh,
    refreshTick,
  } = useMailContext();
  const { message, setMessage, loading, error } = useMessageDetail(openId);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Label management state
  const [allLabels, setAllLabels] = useState<Array<{ id: string; name: string }>>([]);
  const [labelDropOpen, setLabelDropOpen] = useState(false);
  const [labelSearch, setLabelSearch] = useState("");

  // Load available labels
  useEffect(() => {
    axios.get("/api/v1/labels").then((res) => setAllLabels(res.data || [])).catch(() => {});
  }, [refreshTick]);

  async function removeLabel(lbl: string) {
    if (!message) return;
    try {
      await axios.delete(`/api/v1/messages/${message.id}/labels?label=${encodeURIComponent(lbl)}`);
      setMessage({ ...message, labels: (message.labels || []).filter((l) => l !== lbl) });
      toast.success(`Removed label "${lbl}"`);
      refresh();
    } catch {
      toast.error("Failed to remove label");
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
      toast.success(`Added label "${lbl}"`);
      setLabelDropOpen(false);
      setLabelSearch("");
      refresh();
    } catch {
      toast.error("Failed to add label");
    }
  }

  async function createAndAddLabel(name: string) {
    if (!message || !name.trim()) return;
    try {
      await axios.post("/api/v1/labels", { name: name.trim() });
      await addLabel(name.trim());
      refresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to create label");
    }
  }

  
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { primaryActions } = useMemo(
    () => getActionsForFolder(folder, !!label),
    [folder, label]
  );

  async function handleMarkAsUnread() {
    if (!message) return;
    try {
      await axios.patch(`/api/v1/messages/${message.id}/read`, { unread: true });
      setMessage((prev) => (prev ? { ...prev, unread: true } : prev));
      toast.success("Marked as unread");
      setOpenId(null);
      refresh();
    } catch {
      toast.error("Failed to mark as unread");
    }
  }

  async function handleCopyLink() {
    if (!message) return;
    try {
      const url = `${window.location.origin}${window.location.pathname}?id=${message.id}`;
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = url;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Failed to copy link");
    }
  }

  function handlePrint() {
    if (!message) return;

    const printFrame = document.createElement("iframe");
    printFrame.style.position = "fixed";
    printFrame.style.right = "0";
    printFrame.style.bottom = "0";
    printFrame.style.width = "0";
    printFrame.style.height = "0";
    printFrame.style.border = "0";
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow?.document;
    if (!frameDoc) {
      window.print();
      return;
    }

    const formattedDate = new Date(message.timestamp).toLocaleString(undefined, {
      dateStyle: "full",
      timeStyle: "short",
    });

    const toList = (message.to || []).join(", ");
    const ccList = message.cc?.length
      ? `<div class="meta-row"><strong>Cc:</strong> ${message.cc.join(", ")}</div>`
      : "";

    frameDoc.open();
    frameDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${message.subject || "Print Email"}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #111;
              background: #fff;
              padding: 32px;
              margin: 0;
              line-height: 1.6;
              font-size: 14px;
            }
            h1 {
              font-size: 20px;
              font-weight: 700;
              margin: 0 0 16px 0;
              padding-bottom: 12px;
              border-bottom: 2px solid #eaeaea;
              color: #111;
            }
            .meta {
              font-size: 13px;
              color: #444;
              margin-bottom: 24px;
              padding-bottom: 16px;
              border-bottom: 1px solid #eee;
            }
            .meta-row {
              margin-bottom: 6px;
            }
            .meta strong {
              color: #111;
              display: inline-block;
              width: 55px;
            }
            .content {
              font-size: 14px;
              color: #222;
              word-break: break-word;
            }
            .content img {
              max-width: 100%;
              height: auto;
            }
          </style>
        </head>
        <body>
          <h1>${message.subject || "(No Subject)"}</h1>
          <div class="meta">
            <div class="meta-row"><strong>From:</strong> ${message.sender.name} &lt;${message.sender.email}&gt;</div>
            <div class="meta-row"><strong>To:</strong> ${toList || "Undisclosed recipients"}</div>
            ${ccList}
            <div class="meta-row"><strong>Date:</strong> ${formattedDate}</div>
          </div>
          <div class="content">
            ${message.body || message.rawText || ""}
          </div>
        </body>
      </html>
    `);
    frameDoc.close();

    setTimeout(() => {
      printFrame.contentWindow?.focus();
      printFrame.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(printFrame)) {
          document.body.removeChild(printFrame);
        }
      }, 1000);
    }, 250);
  }

  function handleDownload() {
    if (!message) return;
    const content = `From: ${message.sender.name} <${message.sender.email}>
To: ${(message.to || []).join(", ")}
Subject: ${message.subject}
Date: ${new Date(message.timestamp).toUTCString()}

${message.rawText || htmlToPlainText(message.body)}`;

    const blob = new Blob([content], { type: "message/rfc822;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(message.subject || "email").replace(/[^a-z0-9]/gi, "_")}.eml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Message downloaded");
  }

  async function starToggle() {
    if (!message) return;
    try {
      const res = await axios.post(`/api/v1/messages/${message.id}/star`, {
        starred: !message.starred,
      });
      setMessage({ ...message, starred: res.data.starred });
      toast.success(res.data.starred ? "Message starred" : "Message unstarred");
      refresh();
    } catch {
      toast.error("Failed to update star");
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
      toast.success(folder === "Archive" ? "Moved to Inbox" : "Restored to Inbox");
      setOpenId(null);
      refresh();
    } catch {
      toast.error("Failed to restore message");
    } finally {
      setActionInProgress(null);
    }
  }

  async function executeArchive() {
    if (!message) return;
    setActionInProgress("archive");
    try {
      await axios.post(`/api/v1/messages/${message.id}/archive`);
      toast.success("Message archived");
      setOpenId(null);
      refresh();
    } catch {
      toast.error("Failed to archive message");
    } finally {
      setActionInProgress(null);
    }
  }

  async function executeTrash() {
    if (!message) return;
    const id = message.id;
    const originalFolder = folder ?? "inbox";

    setActionInProgress("trash");
    try {
      await axios.post(`/api/v1/messages/${id}/trash`);
      setOpenId(null);
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
              setOpenId(id);
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
      setActionInProgress(null);
    }
  }

  async function executeDeletePermanent() {
    if (!message) return;
    setConfirmOpen(false);
    setActionInProgress("delete_permanent");
    try {
      await axios.delete(`/api/v1/messages/${message.id}`);
      toast.success("Permanently deleted message");
      setOpenId(null);
      refresh();
    } catch {
      toast.error("Failed to delete message");
    } finally {
      setActionInProgress(null);
    }
  }

  
  if (!openId) {
    return (
      <section className="detail-pane mobile-hidden">
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

  
  if (error) {
    return (
      <section className={`detail-pane detail-visible ${!openId ? "mobile-hidden" : ""}`}>
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
      <section className={`detail-pane detail-visible ${!openId ? "mobile-hidden" : ""}`}>
        {/* Toolbar */}
        <div className="detail-toolbar">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="icon-button back-button"
                  onClick={() => setOpenId(null)}
                  aria-label="Back"
                />
              }
            >
              <ArrowLeft className="size-4" />
            </TooltipTrigger>
            <TooltipContent>Back to list</TooltipContent>
          </Tooltip>

          {message && (
            <>
              {folder === "Drafts" || message.folder === "drafts" || message.status === "draft" ? (
                <Button
                  size="sm"
                  className="button-primary h-7 px-3 text-xs gap-1.5"
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
                  <Pencil className="size-3.5" /> Edit draft
                </Button>
              ) : (
                <div className="toolbar-reply-group flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="icon-button toolbar-btn"
                          aria-label="Reply"
                          onClick={() =>
                            openCompose({
                              to: [message.sender.email],
                              subject: message.subject.startsWith("Re:")
                                ? message.subject
                                : `Re: ${message.subject}`,
                            })
                          }
                        />
                      }
                    >
                      <Reply className="size-4" />
                    </TooltipTrigger>
                    <TooltipContent>Reply</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="icon-button toolbar-btn"
                          aria-label="Reply All"
                          onClick={() =>
                            openCompose({
                              to: [message.sender.email],
                              subject: message.subject.startsWith("Re:")
                                ? message.subject
                                : `Re: ${message.subject}`,
                            })
                          }
                        />
                      }
                    >
                      <ReplyAll className="size-4" />
                    </TooltipTrigger>
                    <TooltipContent>Reply All</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="icon-button toolbar-btn"
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
                        />
                      }
                    >
                      <Forward className="size-4" />
                    </TooltipTrigger>
                    <TooltipContent>Forward</TooltipContent>
                  </Tooltip>
                </div>
              )}
            </>
          )}

          <div className="toolbar-spacer" />

          {message && (
            <div className="flex items-center gap-1">
              {primaryActions.map((action) => {
                const Icon = action.icon;
                const inProgress = actionInProgress === action.id;
                return (
                  <Tooltip key={action.id}>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className={`icon-button toolbar-btn ${
                            inProgress ? "loading-btn" : ""
                          }`}
                          onClick={() => handleToolbarAction(action)}
                          aria-label={action.label}
                          disabled={!!actionInProgress}
                        />
                      }
                    >
                      <Icon className="size-4" />
                    </TooltipTrigger>
                    <TooltipContent>{action.tooltip}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="icon-button"
                  aria-label="More conversation actions"
                />
              }
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 p-1">
              <DropdownMenuItem onClick={handleMarkAsUnread}>
                Mark as unread
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopyLink}>
                Copy link
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handlePrint}>
                Print
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Message body / scroll area */}
        <div className="detail-scroll-area">
          <div className="detail-content">
            {message && (
              <div className="detail-heading">
                <div className="detail-heading-left">
                  <div className="label-row flex flex-wrap items-center gap-1.5 mb-2">
                    {message.labels?.map((lbl) => (
                      <Badge
                        key={lbl}
                        variant="secondary"
                        className="gap-1 pr-1 pl-2 text-xs font-normal h-6 rounded-md"
                      >
                        <Tag className="size-3 text-muted-foreground" />
                        <span>{lbl}</span>
                        <button
                          className="chip-remove-btn hover:bg-muted/80 rounded p-0.5 cursor-pointer"
                          onClick={() => removeLabel(lbl)}
                          aria-label={`Remove label ${lbl}`}
                          title={`Remove label ${lbl}`}
                        >
                          <X className="size-3 text-muted-foreground hover:text-foreground" />
                        </button>
                      </Badge>
                    ))}

                    {/* Add label popover */}
                    <Popover open={labelDropOpen} onOpenChange={setLabelDropOpen}>
                      <PopoverTrigger
                        render={
                          <Button
                            variant="outline"
                            size="xs"
                            className="h-6 gap-1 px-2 text-xs font-normal"
                            aria-label="Add label"
                          />
                        }
                      >
                        <Plus className="size-3" /> Label
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-52 p-2">
                        <Input
                          className="h-7 text-xs mb-2"
                          placeholder="Search or create..."
                          value={labelSearch}
                          onChange={(e) => setLabelSearch(e.target.value)}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && labelSearch.trim()) {
                              const exact = allLabels.find(
                                (l) =>
                                  l.name.toLowerCase() ===
                                  labelSearch.trim().toLowerCase()
                              );
                              if (exact) addLabel(exact.name);
                              else createAndAddLabel(labelSearch.trim());
                            }
                          }}
                        />
                        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                          {allLabels
                            .filter((l) =>
                              l.name
                                .toLowerCase()
                                .includes(labelSearch.toLowerCase())
                            )
                            .map((l) => (
                              <button
                                key={l.id}
                                className="flex items-center justify-between text-xs px-2 py-1.5 rounded hover:bg-accent text-left"
                                onClick={() => addLabel(l.name)}
                              >
                                <span className="flex items-center gap-1.5 truncate">
                                  <Tag className="size-3 text-muted-foreground" />
                                  {l.name}
                                </span>
                                {(message.labels || []).includes(l.name) && (
                                  <span className="text-primary text-xs font-bold">
                                    ✓
                                  </span>
                                )}
                              </button>
                            ))}
                          {labelSearch.trim() &&
                            !allLabels.some(
                              (l) =>
                                l.name.toLowerCase() ===
                                labelSearch.trim().toLowerCase()
                            ) && (
                              <button
                                className="flex items-center gap-1 text-xs px-2 py-1.5 rounded hover:bg-accent text-primary font-medium text-left"
                                onClick={() =>
                                  createAndAddLabel(labelSearch.trim())
                                }
                              >
                                <Plus className="size-3" /> Create &quot;
                                {labelSearch.trim()}&quot;
                              </button>
                            )}
                          {allLabels.length === 0 && !labelSearch.trim() && (
                            <p className="text-xs text-muted-foreground p-2 text-center">
                              No labels yet. Type to create one.
                            </p>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <h2>{message.subject}</h2>
                </div>

                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className={`icon-button star-btn ${
                          message.starred ? "is-starred" : ""
                        }`}
                        onClick={starToggle}
                        aria-label={
                          message.starred
                            ? "Unstar conversation"
                            : "Star conversation"
                        }
                      />
                    }
                  >
                    <Star
                      className={`size-4 ${
                        message.starred ? "fill-star" : ""
                      }`}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    {message.starred ? "Unstar" : "Star"}
                  </TooltipContent>
                </Tooltip>
              </div>
            )}

            {/* skeleton heading while loading */}
            {loading && !message && (
              <div className="detail-heading">
                <div style={{ flex: 1 }} className="space-y-2">
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-7 w-2/3" />
                </div>
              </div>
            )}

            <div className="message message-card">
              {loading ? (
                <MessageSkeleton />
              ) : message ? (
                <>
                  <div className="message-head">
                    <Avatar className="size-9 shrink-0">
                      {message.sender.avatarUrl && (
                        <AvatarImage
                          src={message.sender.avatarUrl}
                          alt={message.sender.name}
                        />
                      )}
                      <AvatarFallback
                        style={{
                          background: avatarColor(message.sender.name),
                          color: "#ffffff",
                        }}
                        className="text-xs font-semibold"
                      >
                        {getInitials(message.sender.name)}
                      </AvatarFallback>
                    </Avatar>
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
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="icon-button small"
                            aria-label="Message options"
                          />
                        }
                      >
                        <ChevronDown className="size-3.5" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44 p-1">
                        <DropdownMenuItem onClick={handlePrint}>
                          Expand message
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleDownload}>
                          Download message
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {}
                  <div
                    className="email-body-content"
                    dangerouslySetInnerHTML={{ __html: message.body }}
                  />

                  {}
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="attachments-section">
                      <strong className="attachments-label">
                        {message.attachments.length} attachment
                        {message.attachments.length > 1 ? "s" : ""}
                      </strong>
                      <div className="attachments-list">
                        {message.attachments.map((att) => (
                          <a
                            key={att.id || att.filename}
                            className="attachment"
                            href={att.id ? `/api/v1/messages/${message.id}/attachments/${att.id}` : att.url}
                            download={att.filename}
                            target="_blank"
                            rel="noopener noreferrer"
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

            {}
            {message && !loading && (
              <div className="reply-actions flex items-center gap-2 pt-2">
                {folder === "Drafts" || message.folder === "drafts" || message.status === "draft" ? (
                  <Button
                    size="sm"
                    className="button-primary h-8 px-4 text-xs gap-2"
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
                    <Pencil className="size-3.5" /> Continue editing draft
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="reply-btn h-8 gap-1.5 px-3.5 text-xs font-medium"
                      onClick={() =>
                        openCompose({
                          to: [message.sender.email],
                          subject: message.subject.startsWith("Re:")
                            ? message.subject
                            : `Re: ${message.subject}`,
                        })
                      }
                    >
                      <Reply className="size-3.5" /> Reply
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="reply-btn h-8 gap-1.5 px-3.5 text-xs font-medium"
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
                      <Forward className="size-3.5" /> Forward
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {}
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
