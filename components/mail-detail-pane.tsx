"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArrowLeft,
  Bold,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Forward,
  Italic,
  Link2,
  List,
  Mail,
  MailOpen,
  MoreHorizontal,
  Paperclip,
  Plus,
  Printer,
  Reply,
  ReplyAll,
  RotateCcw,
  Send,
  Star,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import axios from "axios";
import { MailItem, useSendMail } from "../hooks/use-mail";
import { useMailContext } from "./mail-context";
import { getActionsForFolder, MailActionConfig } from "@/lib/mail-actions";
import ConfirmDialog from "./confirm-dialog";
import { formatFileSize } from "@/lib/image-compressor";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials, avatarColor, cn, escapeHtml } from "@/lib/utils";
import { parseSender } from "./mail-thread-hierarchy";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

function renderPlainTextWithLinks(text: string) {
  const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`]+[^\s<>"{}|\\^`.,;:!?])/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (part.match(/^https?:\/\//)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary font-medium underline underline-offset-4 hover:text-primary/80 transition-colors break-all"
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

function MessageSkeleton() {
  return (
    <div className="p-6 space-y-6">
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
            body: e.html || e.text || "",
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

export default function MailDetailPane() {
  const { openId, setOpenId, folder, label, openCompose, refresh } =
    useMailContext();

  const { message, setMessage, loading } = useMessageDetail(openId);
  const { sendMail, sending } = useSendMail();

  const [replyText, setReplyText] = useState("");
  const [isReplyFocused, setIsReplyFocused] = useState(false);
  const [replyAttachments, setReplyAttachments] = useState<
    Array<{
      id: string;
      name: string;
      size: number;
      type: string;
      base64: string;
    }>
  >([]);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [labelDropOpen, setLabelDropOpen] = useState(false);
  const [labelSearch, setLabelSearch] = useState("");
  const [allLabels, setAllLabels] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const insertFormatting = (prefix: string, suffix = prefix) => {
    const textarea = replyTextareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = replyText.substring(start, end);
    const before = replyText.substring(0, start);
    const after = replyText.substring(end);

    const replacement = `${prefix}${selectedText || "text"}${suffix}`;
    setReplyText(`${before}${replacement}${after}`);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + prefix.length,
        start + prefix.length + (selectedText.length || 4),
      );
    }, 0);
  };

  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1] || "";
        setReplyAttachments((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).substring(2, 9),
            name: file.name,
            size: file.size,
            type: file.type || "application/octet-stream",
            base64,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  useEffect(() => {
    axios
      .get("/api/v1/labels")
      .then((res) => setAllLabels(res.data || []))
      .catch(() => {});
  }, []);

  const { primaryActions } = useMemo(
    () => getActionsForFolder(folder, !!label),
    [folder, label],
  );

  async function handleToolbarAction(action: MailActionConfig) {
    if (!message) return;

    if (action.id === "delete_permanent") {
      setConfirmOpen(true);
      return;
    }

    setActionInProgress(action.id);
    try {
      if (action.id === "restore") {
        await axios.post(`/api/v1/messages/${message.id}/restore`);
        toast.success("Restored to Inbox");
      } else if (action.id === "archive") {
        await axios.post(`/api/v1/messages/${message.id}/archive`);
        toast.success("Archived");
      } else if (action.id === "trash") {
        await axios.post(`/api/v1/messages/${message.id}/trash`);
        toast.success("Moved to Trash");
      }
      setOpenId(null);
      refresh();
    } catch {
      toast.error("Failed to perform action");
    } finally {
      setActionInProgress(null);
    }
  }

  async function starToggle() {
    if (!message) return;
    try {
      const res = await axios.post(`/api/v1/messages/${message.id}/star`, {
        starred: !message.starred,
      });
      setMessage({ ...message, starred: res.data.starred });
      toast.success(res.data.starred ? "Starred" : "Unstarred");
      refresh();
    } catch {
      toast.error("Failed to update star");
    }
  }

  async function handleMarkAsUnread() {
    if (!message) return;
    try {
      await axios.patch(`/api/v1/messages/${message.id}/read`, {
        unread: true,
      });
      toast.success("Marked as unread");
      setOpenId(null);
      refresh();
    } catch {
      toast.error("Failed to mark as unread");
    }
  }

  function handlePrint() {
    if (!message) return;
    window.print();
  }

  async function addLabel(lbl: string) {
    if (!message) return;
    try {
      await axios.post(`/api/v1/messages/${message.id}/labels`, { label: lbl });
      setMessage({ ...message, labels: [...(message.labels || []), lbl] });
      toast.success(`Tagged with "${lbl}"`);
      setLabelDropOpen(false);
      setLabelSearch("");
      refresh();
    } catch {
      toast.error("Failed to add label");
    }
  }

  async function removeLabel(lbl: string) {
    if (!message) return;
    try {
      await axios.delete(
        `/api/v1/messages/${message.id}/labels/${encodeURIComponent(lbl)}`,
      );
      setMessage({
        ...message,
        labels: (message.labels || []).filter((l) => l !== lbl),
      });
      toast.success(`Removed tag "${lbl}"`);
      refresh();
    } catch {
      toast.error("Failed to remove label");
    }
  }

  async function handleSendReply() {
    if (!message || (!replyText.trim() && replyAttachments.length === 0))
      return;

    try {
      await sendMail({
        to: [message.sender.email],
        subject: message.subject.startsWith("Re:")
          ? message.subject
          : `Re: ${message.subject}`,
        html: `<p style="white-space:pre-wrap">${escapeHtml(replyText)}</p>`,
        text: replyText,
        attachments: replyAttachments.map((a) => ({
          filename: a.name,
          content: a.base64,
          contentType: a.type,
        })),
      });
      toast.success("Reply dispatched");
      setReplyText("");
      setReplyAttachments([]);
      setIsReplyFocused(false);
      refresh();
    } catch {
      toast.error("Failed to send reply");
    }
  }

  // Keyboard-driven actions when viewing a thread (Superhuman / Front style)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!message) return;
      const isInputFocused =
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        (document.activeElement as HTMLElement)?.isContentEditable;

      if (isInputFocused || e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();
      if (key === "r") {
        e.preventDefault();
        setIsReplyFocused(true);
        setTimeout(() => replyTextareaRef.current?.focus(), 50);
      } else if (key === "e") {
        e.preventDefault();
        handleToolbarAction({
          id: "archive",
          label: "Archive",
          icon: Archive,
          tooltip: "Archive",
        });
      } else if (e.key === "#" || (e.shiftKey && e.key === "3")) {
        e.preventDefault();
        handleToolbarAction({
          id: "trash",
          label: "Trash",
          icon: Trash2,
          tooltip: "Move to trash",
        });
      } else if (key === "s") {
        e.preventDefault();
        starToggle();
      } else if (key === "l") {
        e.preventDefault();
        setLabelDropOpen((prev) => !prev);
      } else if (key === "u") {
        e.preventDefault();
        handleMarkAsUnread();
      } else if (key === "f") {
        e.preventDefault();
        openCompose({
          to: [],
          subject: message.subject.startsWith("Fwd:")
            ? message.subject
            : `Fwd: ${message.subject}`,
          body: `\n\n---------- Forwarded message ---------\nFrom: ${message.sender.name} <${message.sender.email}>\nSubject: ${message.subject}\n\n${message.rawText || ""}`,
        });
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [message]);

  return (
    <>
      <section
        className={cn(
          "flex-1 flex flex-col h-full bg-background overflow-hidden min-w-0 select-text",
          !openId ? "max-md:hidden" : "max-md:flex",
        )}
      >
        {/* Detail Top Header - exactly h-[52px] */}
        <div className="h-13 border-b border-border px-4 flex items-center justify-between shrink-0 bg-background">
          <div className="flex items-center gap-1">
            {/* Mobile Back Button */}
            <Button
              variant="ghost"
              size="icon-xs"
              className="md:hidden size-8 text-muted-foreground mr-1"
              onClick={() => setOpenId(null)}
              aria-label="Back to list"
            >
              <ArrowLeft className="size-4" />
            </Button>

            {message ? (
              <>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-foreground cursor-pointer"
                        aria-label="Archive (E)"
                        onClick={() =>
                          handleToolbarAction({
                            id: "archive",
                            label: "Archive",
                            icon: Archive,
                            tooltip: "Archive",
                          })
                        }
                      >
                        <Archive className="size-4" />
                      </Button>
                    }
                  />
                  <TooltipContent>Archive (E)</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-foreground cursor-pointer"
                        aria-label="Move to trash (#)"
                        onClick={() =>
                          handleToolbarAction({
                            id: "trash",
                            label: "Trash",
                            icon: Trash2,
                            tooltip: "Move to trash",
                          })
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    }
                  />
                  <TooltipContent>Move to trash (#)</TooltipContent>
                </Tooltip>

                <Separator orientation="vertical" className="h-4 mx-1" />

                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-foreground cursor-pointer"
                        aria-label={message.starred ? "Unstar (S)" : "Star (S)"}
                        onClick={starToggle}
                      >
                        <Star
                          className={cn(
                            "size-4",
                            message.starred && "fill-amber-400 text-amber-400",
                          )}
                        />
                      </Button>
                    }
                  />
                  <TooltipContent>
                    {message.starred ? "Unstar (S)" : "Star (S)"}
                  </TooltipContent>
                </Tooltip>

                {/* Add Label Popover */}
                <Popover open={labelDropOpen} onOpenChange={setLabelDropOpen}>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <PopoverTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-muted-foreground hover:text-foreground cursor-pointer"
                              aria-label="Manage labels (L)"
                            >
                              <Tag className="size-4" />
                            </Button>
                          }
                        />
                      }
                    />
                    <TooltipContent>Labels (L)</TooltipContent>
                  </Tooltip>
                  <PopoverContent align="start" className="w-52 p-2">
                    <Input
                      className="h-7 text-xs mb-2"
                      placeholder="Label name..."
                      value={labelSearch}
                      onChange={(e) => setLabelSearch(e.target.value)}
                      autoFocus
                    />
                    <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto">
                      {allLabels
                        .filter((l) =>
                          l.name
                            .toLowerCase()
                            .includes(labelSearch.toLowerCase()),
                        )
                        .map((l) => (
                          <button
                            key={l.id}
                            type="button"
                            className="flex items-center justify-between text-xs px-2 py-1.5 rounded-md hover:bg-accent text-left"
                            onClick={() => addLabel(l.name)}
                          >
                            <span className="truncate">{l.name}</span>
                            {(message.labels || []).includes(l.name) && (
                              <CheckCircle2 className="size-3.5 text-primary" />
                            )}
                          </button>
                        ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </>
            ) : null}
          </div>

          <div className="flex items-center gap-1">
            {message ? (
              <>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-foreground cursor-pointer"
                        aria-label="Reply (R)"
                        onClick={() =>
                          openCompose({
                            to: [message.sender.email],
                            subject: message.subject.startsWith("Re:")
                              ? message.subject
                              : `Re: ${message.subject}`,
                          })
                        }
                      >
                        <Reply className="size-4" />
                      </Button>
                    }
                  />
                  <TooltipContent>Reply (R)</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-foreground cursor-pointer"
                        aria-label="Reply all"
                        onClick={() =>
                          openCompose({
                            to: [message.sender.email, ...(message.cc || [])],
                            subject: message.subject.startsWith("Re:")
                              ? message.subject
                              : `Re: ${message.subject}`,
                          })
                        }
                      >
                        <ReplyAll className="size-4" />
                      </Button>
                    }
                  />
                  <TooltipContent>Reply all</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-foreground cursor-pointer"
                        aria-label="Forward (F)"
                        onClick={() =>
                          openCompose({
                            to: [],
                            subject: message.subject.startsWith("Fwd:")
                              ? message.subject
                              : `Fwd: ${message.subject}`,
                            body: `\n\n---------- Forwarded message ---------\nFrom: ${message.sender.name} <${message.sender.email}>\nSubject: ${message.subject}\n\n${message.rawText || ""}`,
                          })
                        }
                      >
                        <Forward className="size-4" />
                      </Button>
                    }
                  />
                  <TooltipContent>Forward (F)</TooltipContent>
                </Tooltip>

                <Separator orientation="vertical" className="h-4 mx-1" />

                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-foreground cursor-pointer"
                        aria-label="More options"
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    }
                  />
                  <DropdownMenuContent
                    align="end"
                    className="w-52 p-1.5 shadow-md"
                  >
                    <DropdownMenuGroup>
                      <DropdownMenuItem
                        onClick={handleMarkAsUnread}
                        className="text-xs cursor-pointer"
                      >
                        <MailOpen className="size-3.5 mr-2 text-muted-foreground" />
                        <span className="flex-1">Mark as unread</span>
                        <span className="text-[10px] text-muted-foreground/70 font-mono">
                          U
                        </span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={starToggle}
                        className="text-xs cursor-pointer"
                      >
                        <Star
                          className={cn(
                            "size-3.5 mr-2 text-muted-foreground",
                            message.starred && "fill-amber-400 text-amber-400",
                          )}
                        />
                        <span className="flex-1">
                          {message.starred ? "Unstar message" : "Star message"}
                        </span>
                        <span className="text-[10px] text-muted-foreground/70 font-mono">
                          S
                        </span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          const content = `${message.subject}\n\nFrom: ${message.sender.name} <${message.sender.email}>\n\n${message.rawText || message.body || ""}`;
                          navigator.clipboard.writeText(content);
                          toast.success("Email content copied to clipboard");
                        }}
                        className="text-xs cursor-pointer"
                      >
                        <Copy className="size-3.5 mr-2 text-muted-foreground" />
                        <span className="flex-1">Copy raw text</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={handlePrint}
                        className="text-xs cursor-pointer"
                      >
                        <Printer className="size-3.5 mr-2 text-muted-foreground" />
                        <span className="flex-1">Print conversation</span>
                        <span className="text-[10px] text-muted-foreground/70 font-mono">
                          ⌘P
                        </span>
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator className="my-1" />
                    <DropdownMenuGroup>
                      <DropdownMenuItem
                        onClick={() => {
                          openCompose({
                            to: [message.sender.email],
                            subject: message.subject.startsWith("Fwd:")
                              ? message.subject
                              : `Fwd: ${message.subject}`,
                            body: `\n\n---------- Forwarded message ---------\nFrom: ${message.sender.name} <${message.sender.email}>\nSubject: ${message.subject}\n\n${message.rawText || message.body || ""}`,
                          });
                        }}
                        className="text-xs cursor-pointer"
                      >
                        <Forward className="size-3.5 mr-2 text-muted-foreground" />
                        <span className="flex-1">Forward message</span>
                        <span className="text-[10px] text-muted-foreground/70 font-mono">
                          F
                        </span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={async () => {
                          await handleToolbarAction({
                            id: "trash",
                            label: "Move to Trash",
                            tooltip: "Move to Trash",
                            icon: Trash2,
                          });
                        }}
                        className="text-xs cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                      >
                        <Trash2 className="size-3.5 mr-2 text-destructive" />
                        <span className="flex-1">Move to trash</span>
                        <span className="text-[10px] text-muted-foreground/70 font-mono">
                          #
                        </span>
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : null}
          </div>
        </div>

        {/* Detail Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {loading ? (
            <MessageSkeleton />
          ) : !message ? (
            <div className="p-8 text-center text-muted-foreground h-full flex flex-col items-center justify-center space-y-2 animate-in fade-in-0 duration-200">
              <div className="size-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-2">
                <Mail className="size-6" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                No message selected
              </p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Select an email from the left list to read and manage the
                conversation.
              </p>
            </div>
          ) : (
            <div
              key={message.id}
              className="flex-1 flex flex-col overflow-hidden animate-in fade-in-0 slide-in-from-right-3 duration-200 ease-out"
            >
              {/* Header: Sender Info & Subject */}
              <div className="flex items-start p-4 select-text">
                <div className="flex items-start gap-3.5 text-sm min-w-0">
                  <Avatar className="size-10 shrink-0 ring-1 ring-border/50">
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
                  <div className="grid gap-1 min-w-0">
                    <div className="font-semibold text-sm text-foreground truncate">
                      {message.sender.name}
                    </div>
                    <div className="text-xs text-foreground/90 font-medium">
                      {message.subject}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                      <span className="truncate">
                        <span className="font-medium text-foreground">Reply-To:</span> {message.sender.email}
                      </span>
                      {message.to && message.to.length > 0 && (
                        <span className="truncate">to: {message.to.join(", ")}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="ml-auto text-xs text-muted-foreground shrink-0 pl-4 text-right flex flex-col items-end gap-1.5">
                  <span>
                    {new Date(message.timestamp).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                  {message.labels && message.labels.length > 0 && (
                    <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                      {message.labels.map((lbl) => (
                        <Badge
                          key={lbl}
                          variant="secondary"
                          className="text-[10px] h-4.5 gap-1 pr-1 pl-2 font-normal rounded-md"
                        >
                          <span>{lbl}</span>
                          <button
                            type="button"
                            onClick={() => removeLabel(lbl)}
                            className="hover:text-destructive cursor-pointer"
                            aria-label={`Remove label ${lbl}`}
                          >
                            <X className="size-2.5" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Email Body Content */}
              <ContextMenu>
                <ContextMenuTrigger
                  render={
                    <div className="flex-1 overflow-y-auto p-4 select-text" />
                  }
                >
                  <div className="w-full select-text">
                    {message.rawHtml ? (
                      <div
                        className="email-html-body select-text [&_*]:select-text text-foreground text-sm leading-relaxed overflow-x-auto [&_img]:max-w-full [&_img]:h-auto [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_p]:mb-3.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                        dangerouslySetInnerHTML={{ __html: message.rawHtml }}
                      />
                    ) : message.rawText ? (
                      <div className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground select-text [&_*]:select-text break-words">
                        {renderPlainTextWithLinks(message.rawText)}
                      </div>
                    ) : message.body ? (
                      <div
                        className="email-html-body select-text [&_*]:select-text text-foreground text-sm leading-relaxed overflow-x-auto [&_img]:max-w-full [&_img]:h-auto [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_p]:mb-3.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                        dangerouslySetInnerHTML={{ __html: message.body }}
                      />
                    ) : (
                      <p className="text-sm italic text-muted-foreground">
                        No content
                      </p>
                    )}

                    {/* Attachments (if any) */}
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="space-y-2 pt-6 mt-6 border-t border-border/40">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Attachments ({message.attachments.length})
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {message.attachments.map((att) => (
                            <ContextMenu key={att.id}>
                              <ContextMenuTrigger
                                render={
                                  <a
                                    href={att.url}
                                    download={att.filename}
                                    target="_blank"
                                    rel="noreferrer"
                                    onContextMenu={(e) => e.stopPropagation()}
                                    className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card hover:bg-accent/40 text-xs transition-colors group"
                                  />
                                }
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <Paperclip className="size-3.5 text-muted-foreground shrink-0" />
                                  <span className="truncate font-medium text-foreground">
                                    {att.filename}
                                  </span>
                                </div>
                                <Download className="size-3.5 text-muted-foreground group-hover:text-foreground shrink-0 ml-2 transition-colors" />
                              </ContextMenuTrigger>
                              <ContextMenuContent>
                                <ContextMenuItem
                                  onClick={() => window.open(att.url, "_blank")}
                                >
                                  <ExternalLink className="size-4 mr-2" />
                                  Open in new tab
                                </ContextMenuItem>
                                <ContextMenuItem
                                  onClick={() => {
                                    const link = document.createElement("a");
                                    link.href = att.url;
                                    link.download = att.filename;
                                    link.click();
                                  }}
                                >
                                  <Download className="size-4 mr-2" />
                                  Download file
                                </ContextMenuItem>
                                <ContextMenuSeparator />
                                <ContextMenuItem
                                  onClick={() => {
                                    navigator.clipboard.writeText(att.url);
                                    toast.success("Link copied to clipboard");
                                  }}
                                >
                                  <Link2 className="size-4 mr-2" />
                                  Copy download link
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem
                    onClick={() => {
                      setIsReplyFocused(true);
                      setTimeout(() => replyTextareaRef.current?.focus(), 50);
                    }}
                  >
                    <Reply className="size-4 mr-2" />
                    Reply
                    <ContextMenuShortcut>R</ContextMenuShortcut>
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => {
                      openCompose({
                        to: [message.sender.email, ...(message.to || [])].filter(
                          (e, idx, arr) => arr.indexOf(e) === idx,
                        ),
                        cc: message.cc,
                        subject: message.subject.startsWith("Re:")
                          ? message.subject
                          : `Re: ${message.subject}`,
                        body: `\n\nOn ${new Date(message.timestamp).toLocaleString()}, ${message.sender.name} wrote:\n> ${(message.rawText || "").replace(/\n/g, "\n> ")}`,
                      });
                    }}
                  >
                    <ReplyAll className="size-4 mr-2" />
                    Reply all
                    <ContextMenuShortcut>A</ContextMenuShortcut>
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => {
                      openCompose({
                        to: [],
                        subject: message.subject.startsWith("Fwd:")
                          ? message.subject
                          : `Fwd: ${message.subject}`,
                        body: `\n\n---------- Forwarded message ---------\nFrom: ${message.sender.name} <${message.sender.email}>\nSubject: ${message.subject}\n\n${message.rawText || ""}`,
                      });
                    }}
                  >
                    <Forward className="size-4 mr-2" />
                    Forward
                    <ContextMenuShortcut>F</ContextMenuShortcut>
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem onClick={starToggle}>
                    <Star
                      className={cn(
                        "size-4 mr-2",
                        message.starred && "fill-amber-400 text-amber-400",
                      )}
                    />
                    {message.starred ? "Unstar message" : "Star message"}
                    <ContextMenuShortcut>S</ContextMenuShortcut>
                  </ContextMenuItem>
                  <ContextMenuItem onClick={handleMarkAsUnread}>
                    <Mail className="size-4 mr-2" />
                    Mark unread
                    <ContextMenuShortcut>U</ContextMenuShortcut>
                  </ContextMenuItem>
                  {folder === "Trash" ? (
                    <ContextMenuItem
                      onClick={() =>
                        handleToolbarAction({
                          id: "restore",
                          label: "Restore",
                          icon: RotateCcw,
                          tooltip: "Restore to inbox",
                        })
                      }
                    >
                      <RotateCcw className="size-4 mr-2" />
                      Restore to Inbox
                    </ContextMenuItem>
                  ) : (
                    <>
                      <ContextMenuItem
                        onClick={() =>
                          handleToolbarAction({
                            id: "archive",
                            label: "Archive",
                            icon: Archive,
                            tooltip: "Archive",
                          })
                        }
                      >
                        <Archive className="size-4 mr-2" />
                        Archive
                        <ContextMenuShortcut>E</ContextMenuShortcut>
                      </ContextMenuItem>
                      <ContextMenuItem
                        variant="destructive"
                        onClick={() =>
                          handleToolbarAction({
                            id: "trash",
                            label: "Trash",
                            icon: Trash2,
                            tooltip: "Move to trash",
                          })
                        }
                      >
                        <Trash2 className="size-4 mr-2" />
                        Move to trash
                        <ContextMenuShortcut>#</ContextMenuShortcut>
                      </ContextMenuItem>
                    </>
                  )}
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    onClick={() => {
                      const text = window.getSelection()?.toString();
                      if (text) {
                        navigator.clipboard.writeText(text);
                        toast.success("Selected text copied");
                      } else {
                        navigator.clipboard.writeText(
                          message.rawText || message.body || "",
                        );
                        toast.success("Email body copied");
                      }
                    }}
                  >
                    <Copy className="size-4 mr-2" />
                    Copy email content
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => {
                      navigator.clipboard.writeText(message.sender.email);
                      toast.success("Sender address copied");
                    }}
                  >
                    <Copy className="size-4 mr-2" />
                    Copy sender email
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => {
                      navigator.clipboard.writeText(message.subject);
                      toast.success("Subject copied");
                    }}
                  >
                    <Copy className="size-4 mr-2" />
                    Copy subject
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem onClick={handlePrint}>
                    <Printer className="size-4 mr-2" />
                    Print conversation
                    <ContextMenuShortcut>⌘P</ContextMenuShortcut>
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>

              <Separator className="mt-auto" />

              {/* Bottom Reply Area - Canonical shadcn Mail */}
              <div className="p-4 bg-background shrink-0">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendReply();
                  }}
                >
                  <div className="grid gap-3">
                    {replyAttachments.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {replyAttachments.map((att) => (
                          <span
                            key={att.id}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted text-xs font-medium text-foreground border border-border/60"
                          >
                            <Paperclip className="size-3 text-muted-foreground" />
                            <span className="max-w-40 truncate">
                              {att.name}
                            </span>
                            <span className="text-muted-foreground text-[10px]">
                              ({formatFileSize(att.size)})
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setReplyAttachments((prev) =>
                                  prev.filter((a) => a.id !== att.id),
                                )
                              }
                              className="ml-0.5 text-muted-foreground hover:text-destructive cursor-pointer"
                              aria-label="Remove attachment"
                            >
                              <X className="size-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    <Textarea
                      ref={replyTextareaRef}
                      placeholder={`Reply ${message.sender.name}...`}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                          e.preventDefault();
                          handleSendReply();
                        }
                      }}
                      className="p-3 text-sm min-h-[96px] resize-none leading-relaxed bg-background border border-border shadow-none focus-visible:ring-1 focus-visible:ring-ring"
                    />

                    <div className="flex items-center justify-between">
                      {/* Left: formatting & attachment tools */}
                      <div className="flex items-center gap-1">
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileAttach}
                          multiple
                          className="hidden"
                        />
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8 text-muted-foreground hover:text-foreground cursor-pointer"
                                onClick={() => fileInputRef.current?.click()}
                                aria-label="Attach file"
                              >
                                <Paperclip className="size-4" />
                              </Button>
                            }
                          />
                          <TooltipContent>Attach files</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8 text-muted-foreground hover:text-foreground cursor-pointer"
                                onClick={() => insertFormatting("**")}
                                aria-label="Bold (⌘B)"
                              >
                                <Bold className="size-4" />
                              </Button>
                            }
                          />
                          <TooltipContent>Bold (⌘B)</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8 text-muted-foreground hover:text-foreground cursor-pointer"
                                onClick={() => insertFormatting("*")}
                                aria-label="Italic (⌘I)"
                              >
                                <Italic className="size-4" />
                              </Button>
                            }
                          />
                          <TooltipContent>Italic (⌘I)</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8 text-muted-foreground hover:text-foreground cursor-pointer"
                                onClick={() =>
                                  openCompose({
                                    to: [message.sender.email],
                                    subject: message.subject.startsWith("Re:")
                                      ? message.subject
                                      : `Re: ${message.subject}`,
                                    body: replyText,
                                  })
                                }
                                aria-label="Pop out composer"
                              >
                                <ExternalLink className="size-4" />
                              </Button>
                            }
                          />
                          <TooltipContent>Pop out composer</TooltipContent>
                        </Tooltip>
                      </div>

                      {/* Right: Send */}
                      <div className="flex items-center gap-2">
                        {replyText.trim() && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-xs text-muted-foreground cursor-pointer h-8"
                            onClick={() => {
                              setReplyText("");
                              setReplyAttachments([]);
                            }}
                          >
                            Clear
                          </Button>
                        )}
                        <Button
                          type="submit"
                          size="sm"
                          disabled={
                            sending ||
                            (!replyText.trim() && replyAttachments.length === 0)
                          }
                          className="gap-1.5 h-8 px-3 font-medium cursor-pointer shadow-xs"
                        >
                          {sending ? (
                            <Spinner className="size-3.5" />
                          ) : (
                            <Send className="size-3.5" />
                          )}
                          <span>Send</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </section>

      <ConfirmDialog
        isOpen={confirmOpen}
        title="Permanently Delete Message?"
        description="This action cannot be undone. The message will be removed completely."
        confirmLabel="Delete Permanently"
        onConfirm={() =>
          handleToolbarAction({
            id: "delete_permanent",
            label: "Delete",
            icon: Trash2,
            tooltip: "Delete permanently",
          })
        }
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
