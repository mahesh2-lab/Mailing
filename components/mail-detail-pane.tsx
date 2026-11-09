"use client";

import { useEffect, useRef, useState } from "react";
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
  Mail,
  MailOpen,
  MoreHorizontal,
  Paperclip,
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
import { useSendMail } from "../hooks/use-mail";
import { useMessageDetail } from "../hooks/use-mail-message-detail";
import { useMailContext } from "./mail-context";
import { ThreadHierarchyViewer } from "./mail-thread-hierarchy";
import { AttachmentPreviewPill } from "./attachment-preview-pill";
import type { MailActionConfig } from "@/lib/mail-actions";
import ConfirmDialog from "./confirm-dialog";
import { formatFileSize } from "@/lib/image-compressor";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials, avatarColor, cn, escapeHtml } from "@/lib/utils";
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

export default function MailDetailPane() {
  const { openId, setOpenId, folder, openCompose, refresh } =
    useMailContext();

  const { message, setMessage, loading } = useMessageDetail(openId);
  const { sendMail, sending } = useSendMail();

  const [replyText, setReplyText] = useState("");
  const [isReplying, setIsReplying] = useState(false);
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

  useEffect(() => {
    setIsReplying(false);
    setReplyText("");
    setReplyAttachments([]);
  }, [openId]);

  async function handleToolbarAction(action: MailActionConfig) {
    if (!message) return;

    if (action.id === "delete_permanent") {
      setConfirmOpen(true);
      return;
    }

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
      setIsReplying(false);
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
        setIsReplying(true);
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
        <div className="h-13 border-b border-border px-4 max-md:px-2 flex items-center justify-between shrink-0 bg-background">
          <div className="flex items-center gap-1">
            {/* Mobile Back Button */}
            <Button
              variant="ghost"
              size="icon-xs"
              className="md:hidden size-10 text-muted-foreground mr-1"
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
                        className="size-10 md:size-8 text-muted-foreground hover:text-foreground cursor-pointer"
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
                        className="size-10 md:size-8 text-muted-foreground hover:text-foreground cursor-pointer"
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
                        className="size-10 md:size-8 text-muted-foreground hover:text-foreground cursor-pointer"
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
                              className="size-10 md:size-8 text-muted-foreground hover:text-foreground cursor-pointer"
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
                        className="size-10 md:size-8 text-muted-foreground hover:text-foreground cursor-pointer"
                        aria-label="Reply (R)"
                        onClick={() => {
                          setIsReplying(true);
                          setTimeout(() => replyTextareaRef.current?.focus(), 50);
                        }}
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
                        className="size-10 md:size-8 text-muted-foreground hover:text-foreground cursor-pointer max-md:hidden"
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
                        className="size-10 md:size-8 text-muted-foreground hover:text-foreground cursor-pointer max-md:hidden"
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
                        className="size-10 md:size-8 text-muted-foreground hover:text-foreground cursor-pointer"
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
                        onClick={() =>
                          openCompose({
                            to: [message.sender.email, ...(message.cc || [])],
                            subject: message.subject.startsWith("Re:")
                              ? message.subject
                              : `Re: ${message.subject}`,
                          })
                        }
                        className="text-xs cursor-pointer md:hidden"
                      >
                        <ReplyAll className="size-3.5 mr-2 text-muted-foreground" />
                        <span className="flex-1">Reply all</span>
                      </DropdownMenuItem>
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
              {/* Email Subject & Tags */}
              <div className="px-4 md:px-5 pt-4 pb-2 flex items-start justify-between gap-4 select-text shrink-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground break-words select-text">
                      {message.subject || "No Subject"}
                    </h1>
                    {message.labels && message.labels.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {message.labels.map((lbl) => (
                          <Badge
                            key={lbl}
                            variant="secondary"
                            className="text-[11px] h-5 gap-1 pr-1.5 pl-2 font-normal rounded-md bg-muted/60 text-muted-foreground border-border/60"
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
              </div>

              {/* Sender & Recipient Metadata Row */}
              <div className="px-4 md:px-5 pb-3 flex items-center justify-between gap-3 select-text shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="size-9 shrink-0 ring-1 ring-border/50">
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

                  <div className="min-w-0 flex flex-col justify-center gap-0.5">
                    <div className="flex items-baseline gap-2 flex-wrap text-sm leading-tight">
                      <span className="font-semibold text-foreground truncate">
                        {message.sender.name}
                      </span>
                      <span className="text-xs text-muted-foreground font-normal truncate">
                        &lt;{message.sender.email}&gt;
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                      <span className="text-muted-foreground/70">to</span>
                      <span className="text-foreground/90 font-medium truncate">
                        {message.to && message.to.length > 0
                          ? message.to.join(", ")
                          : "me"}
                      </span>
                      {message.cc && message.cc.length > 0 && (
                        <>
                          <span className="text-muted-foreground/40">•</span>
                          <span className="text-muted-foreground/70">cc</span>
                          <span className="text-foreground/90 font-medium truncate">
                            {message.cc.join(", ")}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2 pl-3 text-right">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(message.timestamp).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={starToggle}
                          className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
                          aria-label={message.starred ? "Unstar message" : "Star message"}
                        >
                          <Star
                            className={cn(
                              "size-4",
                              message.starred
                                ? "fill-amber-400 text-amber-400"
                                : "text-muted-foreground/60 hover:text-foreground",
                            )}
                          />
                        </Button>
                      }
                    />
                    <TooltipContent>
                      {message.starred ? "Starred" : "Star message"}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>

              <Separator className="shrink-0" />

              {/* Email Body Content */}
              <ContextMenu>
                <ContextMenuTrigger
                  render={
                    <div className="flex-1 min-h-0 overflow-hidden p-3 md:p-4 select-text flex flex-col" />
                  }
                >
                  <div className="w-full h-full flex-1 min-h-0 flex flex-col select-text">
                    {message.rawHtml || message.rawText || message.body ? (
                      <ThreadHierarchyViewer message={message} />
                    ) : (
                      <p className="text-sm italic text-muted-foreground">
                        No content
                      </p>
                    )}
</div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem
                    onClick={() => {
                      setIsReplying(true);
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

              {/* Bottom Attachment Bar with On-Hover Previews */}
              {message.attachments && message.attachments.length > 0 && (
                <div className="px-3 md:px-4 py-2 bg-muted/20 border-t border-border/50 shrink-0 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground font-medium text-[11px] shrink-0 mr-0.5">
                      <Paperclip className="size-3.5 text-muted-foreground" />
                      <span>
                        {message.attachments.length}{" "}
                        {message.attachments.length === 1
                          ? "attachment"
                          : "attachments"}
                        :
                      </span>
                    </span>
                    {message.attachments.map((att) => (
                      <AttachmentPreviewPill key={att.id} attachment={att} />
                    ))}
                  </div>
                </div>
              )}

              {/* Bottom Reply Area - Collapsible Button Bar to Maximize Body Space */}
              {!isReplying ? (
                <div className="px-4 py-2.5 bg-background border-t border-border/60 shrink-0 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsReplying(true);
                        setTimeout(() => replyTextareaRef.current?.focus(), 60);
                      }}
                      className="h-8.5 px-3.5 rounded-lg gap-2 text-xs font-medium cursor-pointer shadow-2xs hover:bg-muted transition-colors"
                    >
                      <Reply className="size-3.5 text-muted-foreground" />
                      <span>Reply</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsReplying(true);
                        setTimeout(() => replyTextareaRef.current?.focus(), 60);
                      }}
                      className="h-8.5 px-3.5 rounded-lg gap-2 text-xs font-medium cursor-pointer shadow-2xs hover:bg-muted transition-colors max-sm:hidden"
                    >
                      <ReplyAll className="size-3.5 text-muted-foreground" />
                      <span>Reply all</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        openCompose({
                          to: [],
                          subject: message.subject.startsWith("Fwd:")
                            ? message.subject
                            : `Fwd: ${message.subject}`,
                          body: `\n\n---------- Forwarded message ---------\nFrom: ${message.sender.name} <${message.sender.email}>\nSubject: ${message.subject}\n\n${message.rawText || ""}`,
                        });
                      }}
                      className="h-8.5 px-3.5 rounded-lg gap-2 text-xs font-medium cursor-pointer shadow-2xs hover:bg-muted transition-colors max-sm:hidden"
                    >
                      <Forward className="size-3.5 text-muted-foreground" />
                      <span>Forward</span>
                    </Button>
                  </div>
                  <span className="text-[11px] text-muted-foreground hidden sm:inline-flex items-center gap-1.5">
                    Press <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] font-mono">R</kbd> to reply
                  </span>
                </div>
              ) : (
                <div className="p-3 md:p-4 bg-background border-t border-border/60 shrink-0 animate-in fade-in-0 duration-150">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendReply();
                    }}
                  >
                    <div className="grid gap-2.5">
                      {/* Header bar of reply composer */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5 truncate">
                          <Reply className="size-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">
                            Replying to <span className="font-medium text-foreground">{message.sender.name}</span>
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className="size-6 text-muted-foreground hover:text-foreground cursor-pointer"
                          onClick={() => {
                            if (!replyText.trim() || confirm("Discard unsaved reply?")) {
                              setIsReplying(false);
                              setReplyText("");
                              setReplyAttachments([]);
                            }
                          }}
                          title="Collapse reply (Esc)"
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>

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
                          } else if (e.key === "Escape" && !replyText) {
                            setIsReplying(false);
                          }
                        }}
                        className="p-3 text-sm min-h-[84px] max-h-48 resize-y leading-relaxed bg-background border border-border shadow-none focus-visible:ring-1 focus-visible:ring-ring"
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
                                  onClick={() => {
                                    openCompose({
                                      to: [message.sender.email],
                                      subject: message.subject.startsWith("Re:")
                                        ? message.subject
                                        : `Re: ${message.subject}`,
                                      body: replyText,
                                    });
                                    setIsReplying(false);
                                  }}
                                  aria-label="Pop out composer"
                                >
                                  <ExternalLink className="size-4" />
                                </Button>
                              }
                            />
                            <TooltipContent>Pop out composer</TooltipContent>
                          </Tooltip>
                        </div>

                        {/* Right: Cancel & Send */}
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-xs text-muted-foreground cursor-pointer h-8 px-2.5"
                            onClick={() => {
                              setIsReplying(false);
                              setReplyText("");
                              setReplyAttachments([]);
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            size="sm"
                            disabled={
                              sending ||
                              (!replyText.trim() && replyAttachments.length === 0)
                            }
                            className="gap-1.5 h-8 px-3.5 font-medium cursor-pointer shadow-xs text-xs"
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
              )}
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
