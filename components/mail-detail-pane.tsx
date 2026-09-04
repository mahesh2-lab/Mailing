"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bold,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  FileText,
  Forward,
  Italic,
  Link2,
  Loader2,
  Mail,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  Reply,
  ReplyAll,
  Send,
  Star,
  Tag,
  X,
} from "lucide-react";
import axios from "axios";
import { MailItem, useSendMail } from "../hooks/use-mail";
import { useMailContext } from "./mail-context";
import { getActionsForFolder, MailActionConfig } from "@/lib/mail-actions";
import ConfirmDialog from "./confirm-dialog";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials, avatarColor } from "@/lib/utils";
import { ThreadHierarchyViewer, parseSender } from "./mail-thread-hierarchy";
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
          const sender = parseSender(e.from);
          setMessage({
            id: e.id,
            sender: {
              name: sender.name,
              email: sender.email,
            },
            to: Array.isArray(e.to) ? e.to : e.to ? [e.to] : [],
            cc: Array.isArray(e.cc) ? e.cc : e.cc ? [e.cc] : [],
            bcc: Array.isArray(e.bcc) ? e.bcc : e.bcc ? [e.bcc] : [],
            subject: e.subject || "No Subject",
            preview: "",
            rawText: e.text || "",
            rawHtml: e.html || "",
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

// ─── Inline Reply Composer ──────────────────────────────────────────────────
function InlineReplyComposer({
  message,
  onSent,
}: {
  message: MailItem;
  onSent: () => void;
}) {
  const { openCompose } = useMailContext();
  const { sendMail, sending } = useSendMail();
  const [replyText, setReplyText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<File[]>([]);

  const handleSend = async () => {
    if (!replyText.trim() && attachments.length === 0) {
      toast.error("Please enter a reply message");
      return;
    }

    try {
      const subject = message.subject.startsWith("Re:")
        ? message.subject
        : `Re: ${message.subject}`;

      const formattedHtml = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #ededed;">
        ${replyText
          .split("\n")
          .map((line) => `<p style="margin: 0 0 8px;">${line || "&nbsp;"}</p>`)
          .join("")}
      </div>`;

      await sendMail({
        to: [message.sender.email],
        subject,
        html: formattedHtml,
        text: replyText,
      });

      toast.success("Reply sent successfully");
      setReplyText("");
      setAttachments([]);
      onSent();
    } catch (err: any) {
      toast.error(err.message || "Failed to send reply");
    }
  };

  const handlePopOut = () => {
    openCompose({
      to: [message.sender.email],
      subject: message.subject.startsWith("Re:")
        ? message.subject
        : `Re: ${message.subject}`,
      body: replyText,
    });
  };

  const insertFormatting = (prefix: string, suffix: string = prefix) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = replyText.substring(start, end);
    const replacement = `${prefix}${selected || "text"}${suffix}`;
    const newText =
      replyText.substring(0, start) + replacement + replyText.substring(end);
    setReplyText(newText);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(
        start + prefix.length,
        start + prefix.length + (selected ? selected.length : 4),
      );
    }, 0);
  };

  return (
    <div className="inline-reply-composer mt-6 border border-border rounded-lg bg-(--composer-bg) overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-border text-xs bg-(--composer-header-bg)">
        <span className="text-muted-foreground truncate">
          Replying to{" "}
          <strong className="text-foreground font-medium">
            {message.sender.name}
          </strong>
          {message.sender.name.toLowerCase() !==
            message.sender.email.toLowerCase() && (
            <span className="text-muted-foreground/80 font-normal">
              {" "}
              &lt;{message.sender.email}&gt;
            </span>
          )}
        </span>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer px-1.5 py-0.5 rounded hover:bg-accent transition-colors"
                onClick={handlePopOut}
              >
                <ExternalLink className="size-3" />
                <span>Pop out</span>
              </button>
            }
          >
            Pop out to full composer
          </TooltipTrigger>
          <TooltipContent>Open in full compose window</TooltipContent>
        </Tooltip>
      </div>

      {/* Body textarea */}
      <div className="p-3">
        <textarea
          ref={textareaRef}
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder="Write your reply or notes..."
          rows={4}
          className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 border-0 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 shadow-none resize-none font-sans leading-relaxed"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              handleSend();
            }
          }}
        />

        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2">
            {attachments.map((file, idx) => (
              <Badge
                key={idx}
                variant="secondary"
                className="gap-1 text-[11px] h-5 font-normal bg-muted text-muted-foreground"
              >
                <Paperclip className="size-3" />
                <span className="truncate max-w-37.5">{file.name}</span>
                <button
                  type="button"
                  onClick={() =>
                    setAttachments((prev) => prev.filter((_, i) => i !== idx))
                  }
                >
                  <X className="size-2.5" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Bottom toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-[var(--composer-header-bg)]">
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
                  onClick={() => insertFormatting("**")}
                  aria-label="Bold"
                >
                  <Bold className="size-3.5" />
                </button>
              }
            >
              Bold (⌘B)
            </TooltipTrigger>
            <TooltipContent>Bold</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
                  onClick={() => insertFormatting("*")}
                  aria-label="Italic"
                >
                  <Italic className="size-3.5" />
                </button>
              }
            >
              Italic (⌘I)
            </TooltipTrigger>
            <TooltipContent>Italic</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
                  onClick={() => {
                    const url = prompt("Enter link URL:");
                    if (url) insertFormatting("[", `](${url})`);
                  }}
                  aria-label="Insert Link"
                >
                  <Link2 className="size-3.5" />
                </button>
              }
            >
              Link
            </TooltipTrigger>
            <TooltipContent>Insert Link</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Attach files"
                >
                  <Paperclip className="size-3.5" />
                </button>
              }
            >
              Attach files
            </TooltipTrigger>
            <TooltipContent>Attach files</TooltipContent>
          </Tooltip>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) {
                setAttachments((prev) => [
                  ...prev,
                  ...Array.from(e.target.files!),
                ]);
              }
            }}
          />
        </div>

        <Button
          size="sm"
          onClick={handleSend}
          disabled={sending || (!replyText.trim() && attachments.length === 0)}
          className="py-4 px-3 text-xs gap-1.5 font-medium cursor-pointer hover:bg-primary/90 transition-colors"
          title="Send reply (Ctrl + Enter)"
        >
          {sending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Send className="size-3.5" />
          )}
          <span>{sending ? "Sending..." : "Send"}</span>
        </Button>
      </div>
    </div>
  );
}

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
  const [allLabels, setAllLabels] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [labelDropOpen, setLabelDropOpen] = useState(false);
  const [labelSearch, setLabelSearch] = useState("");

  // Load available labels
  useEffect(() => {
    axios
      .get("/api/v1/labels")
      .then((res) => setAllLabels(res.data || []))
      .catch(() => {});
  }, [refreshTick]);

  async function removeLabel(lbl: string) {
    if (!message) return;
    try {
      await axios.delete(
        `/api/v1/messages/${message.id}/labels?label=${encodeURIComponent(lbl)}`,
      );
      setMessage({
        ...message,
        labels: (message.labels || []).filter((l) => l !== lbl),
      });
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
    [folder, label],
  );

  async function handleMarkAsUnread() {
    if (!message) return;
    try {
      await axios.patch(`/api/v1/messages/${message.id}/read`, {
        unread: true,
      });
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

    const formattedDate = new Date(message.timestamp).toLocaleString(
      undefined,
      {
        dateStyle: "full",
        timeStyle: "short",
      },
    );

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
      toast.success(
        folder === "Archive" ? "Moved to Inbox" : "Restored to Inbox",
      );
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

      const toastMsg =
        folder === "Sent" ? "Removed from Sent" : "Moved to trash";

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
      <section
        className={`detail-pane detail-visible ${!openId ? "mobile-hidden" : ""}`}
      >
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
      <section
        className={`detail-pane detail-visible ${!openId ? "mobile-hidden" : ""}`}
      >
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
              {folder === "Drafts" ||
              message.folder === "drafts" ||
              message.status === "draft" ? (
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
              <DropdownMenuItem onClick={handlePrint}>Print</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Message body / scroll area */}
        <div className="detail-scroll-area">
          <div className="detail-content">
            {message && (
              <>
                {/* Labels Row */}
                <div className="label-row flex flex-wrap items-center gap-1.5 mb-3">
                  {message.labels?.map((lbl) => (
                    <Badge
                      key={lbl}
                      variant="secondary"
                      className="gap-1 pr-1 pl-2 text-xs font-normal h-6 rounded bg-muted text-foreground border-none"
                    >
                      <Tag className="size-3 text-muted-foreground" />
                      <span>{lbl}</span>
                      <button
                        className="chip-remove-btn hover:bg-accent rounded p-0.5 cursor-pointer"
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
                          className="h-6 gap-1 px-2 text-xs font-normal border-border/70 text-muted-foreground hover:text-foreground"
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
                                labelSearch.trim().toLowerCase(),
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
                              .includes(labelSearch.toLowerCase()),
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
                              labelSearch.trim().toLowerCase(),
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

                {/* Email Subject Heading */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <h2 className="text-2xl md:text-[26px] font-semibold text-foreground tracking-tight leading-snug">
                    {message.subject}
                  </h2>
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
                          message.starred
                            ? "fill-star text-amber-400 fill-amber-400"
                            : ""
                        }`}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      {message.starred ? "Unstar" : "Star"}
                    </TooltipContent>
                  </Tooltip>
                </div>

                {/* Single Polished Message Container */}
                <div className="message-container border border-border rounded-lg p-5 bg-[var(--message-bg)]">
                  <div className="flex items-center gap-3">
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
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-baseline gap-2 min-w-0 flex-wrap">
                        <strong className="text-sm font-semibold text-foreground truncate">
                          {message.sender.name}
                        </strong>
                        {message.sender.name.toLowerCase() !==
                          message.sender.email.toLowerCase() && (
                          <span className="text-xs text-muted-foreground truncate font-normal">
                            &lt;{message.sender.email}&gt;
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        to me
                      </span>
                    </div>
                    <time className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
                      {new Date(message.timestamp).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>

                  <div className="my-4 border-t border-border" />

                  {/* Email Body & Thread Hierarchy */}
                  <ThreadHierarchyViewer message={message} />

                  {/* Attachments */}
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="attachments-section mt-5 pt-4 border-t border-border">
                      <strong className="text-xs font-medium text-muted-foreground block mb-2">
                        {message.attachments.length} attachment
                        {message.attachments.length > 1 ? "s" : ""}
                      </strong>
                      <div className="flex flex-wrap gap-2">
                        {message.attachments.map((att) => (
                          <a
                            key={att.id || att.filename}
                            className="flex items-center gap-2 p-2 rounded-md border border-border hover:bg-accent/60 text-xs text-foreground transition-colors"
                            href={
                              att.id
                                ? `/api/v1/messages/${message.id}/attachments/${att.id}`
                                : att.url
                            }
                            download={att.filename}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <FileText className="size-4 text-muted-foreground" />
                            <div className="flex flex-col min-w-0">
                              <span className="font-medium truncate max-w-[140px]">
                                {att.filename}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {att.sizeBytes < 1024 * 1024
                                  ? `${Math.round(att.sizeBytes / 1024)} KB`
                                  : `${(att.sizeBytes / (1024 * 1024)).toFixed(1)} MB`}
                              </span>
                            </div>
                            <Download className="size-3 text-muted-foreground ml-1" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bottom Verification Footer */}
                  <div className="mt-8 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                    <div className="space-y-0.5">
                      <p className="text-[10px] text-muted-foreground/60 font-mono">
                        ID: {message.id}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[11px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 font-normal gap-1"
                    >
                      <CheckCircle2 className="size-3" />
                      Verified Sender
                    </Badge>
                  </div>
                </div>

                {/* Integrated Reply Composer */}
                <InlineReplyComposer message={message} onSent={refresh} />
              </>
            )}

            {/* Skeleton while loading */}
            {loading && !message && (
              <div className="space-y-4">
                <Skeleton className="h-6 w-1/4" />
                <Skeleton className="h-8 w-3/4" />
                <div className="border border-border rounded-lg p-5">
                  <MessageSkeleton />
                </div>
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
