"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Paperclip,
  Send,
  X,
  Bold,
  Italic,
  Link2,
  List,
  Quote,
  Code,
  FileText,
  FileImage,
  FileArchive,
  CheckCircle2,
} from "lucide-react";
import { useSendMail } from "../hooks/use-mail";
import { useMailContext } from "./mail-context";
import { toast } from "sonner";
import { generateId, cn, escapeHtml } from "@/lib/utils";
import { compressImage, formatFileSize } from "@/lib/image-compressor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AttachedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  base64?: string;
  url?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return FileImage;
  if (
    type.includes("zip") ||
    type.includes("tar") ||
    type.includes("compressed")
  )
    return FileArchive;
  return FileText;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const res = reader.result as string;
      const base64 = res.includes(",") ? res.split(",")[1] : res;
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
}

export default function ComposePanel() {
  const { setComposeOpen, composeDefaults, refresh } = useMailContext();
  const { sendMail, sending } = useSendMail();

  const [maximized, setMaximized] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(
    composeDefaults?.draftId ?? null,
  );
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [autoSaving, setAutoSaving] = useState(false);
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [showClosePrompt, setShowClosePrompt] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const [panelSize, setPanelSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const startResize = useCallback(
    (direction: "top" | "left" | "corner", e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (maximized) return;

      const el = panelRef.current;
      if (!el) return;

      const startX = e.clientX;
      const startY = e.clientY;
      const startWidth = el.offsetWidth;
      const startHeight = el.offsetHeight;

      document.body.style.userSelect = "none";
      if (direction === "top") document.body.style.cursor = "ns-resize";
      else if (direction === "left") document.body.style.cursor = "ew-resize";
      else document.body.style.cursor = "nwse-resize";

      const onPointerMove = (moveEvent: PointerEvent) => {
        let newWidth = startWidth;
        let newHeight = startHeight;

        if (direction === "left" || direction === "corner") {
          const deltaX = startX - moveEvent.clientX;
          newWidth = Math.min(
            Math.max(startWidth + deltaX, 420),
            window.innerWidth - 40,
          );
        }

        if (direction === "top" || direction === "corner") {
          const deltaY = startY - moveEvent.clientY;
          newHeight = Math.min(
            Math.max(startHeight + deltaY, 320),
            window.innerHeight - 40,
          );
        }

        setPanelSize({ width: newWidth, height: newHeight });
      };

      const onPointerUp = () => {
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
    },
    [maximized],
  );

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (composeDefaults) {
      if (composeDefaults.draftId) setDraftId(composeDefaults.draftId);
      setTo(composeDefaults.to?.join(", ") ?? "");
      setSubject(composeDefaults.subject ?? "");
      setBody(composeDefaults.body ?? "");
      if (composeDefaults.cc?.length) {
        setCc(composeDefaults.cc.join(", "));
        setShowCc(true);
      }
      if (composeDefaults.bcc?.length) {
        setBcc(composeDefaults.bcc.join(", "));
        setShowCc(true);
      }
    }
  }, [composeDefaults]);

  useEffect(() => {
    if (!to.trim() && !subject.trim() && !body.trim()) return;

    const timer = setTimeout(async () => {
      setAutoSaving(true);
      try {
        const recipients = to
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean);
        const ccList = cc
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean);
        const bccList = bcc
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean);

        const payload = {
          to: recipients,
          cc: ccList,
          bcc: bccList,
          subject: subject.trim() || "(Draft) No Subject",
          html: body ? `<p>${body.replace(/\n/g, "<br/>")}</p>` : "",
          text: body,
        };

        if (draftId) {
          await axios.put(`/api/v1/drafts/${draftId}`, payload);
        } else {
          const res = await axios.post("/api/v1/drafts", payload);
          if (res.data?.id) setDraftId(res.data.id);
        }
        setLastSavedTime(
          new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        );
      } catch {
      } finally {
        setAutoSaving(false);
      }
    }, 2500);

    return () => clearTimeout(timer);
  }, [to, subject, body, cc, bcc, draftId]);

  const isEditingDraft = !!draftId;
  const isForwarding =
    !isEditingDraft &&
    !!composeDefaults?.body &&
    composeDefaults?.subject?.startsWith("Fwd:");
  const isReplying =
    !isEditingDraft &&
    !isForwarding &&
    !!composeDefaults?.subject?.startsWith("Re:");

  const panelTitle = isEditingDraft
    ? "Edit Draft"
    : isForwarding
      ? "Forward Message"
      : isReplying
        ? "Reply"
        : "New Message";

  const handleSend = async () => {
    const recipients = to
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);

    if (recipients.length === 0) {
      toast.error("Please add at least one recipient");
      return;
    }

    try {
      const ccList = cc
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);
      const bccList = bcc
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);

      const formattedHtml = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6;">
        ${body
          .split("\n")
          .map((line) => `<p style="margin: 0 0 8px;">${escapeHtml(line) || "&nbsp;"}</p>`)
          .join("")}
      </div>`;

      await sendMail({
        to: recipients,
        cc: ccList,
        bcc: bccList,
        subject: subject.trim() || "(No subject)",
        html: formattedHtml,
        text: body,
        attachments: attachments.map((a) => ({
          filename: a.name,
          content: a.base64 || "",
        })),
      });

      if (draftId) {
        try {
          await axios.delete(`/api/v1/drafts/${draftId}`);
        } catch {}
      }

      toast.success("Email sent successfully");
      setComposeOpen(false);
      refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to send email");
    }
  };

  const handleSaveDraft = async (closeAfter = false) => {
    setSavingDraft(true);
    try {
      const recipients = to
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);
      const ccList = cc
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);
      const bccList = bcc
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);

      const payload = {
        to: recipients,
        cc: ccList,
        bcc: bccList,
        subject: subject.trim() || "(Draft) No Subject",
        html: body ? `<p>${body.replace(/\n/g, "<br/>")}</p>` : "",
        text: body,
      };

      if (draftId) {
        await axios.put(`/api/v1/drafts/${draftId}`, payload);
        toast.success("Draft updated");
      } else {
        const res = await axios.post("/api/v1/drafts", payload);
        if (res.data?.id) setDraftId(res.data.id);
        toast.success("Saved to Drafts");
      }

      setLastSavedTime(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
      refresh();
      if (closeAfter) setComposeOpen(false);
    } catch {
      toast.error("Failed to save draft");
    } finally {
      setSavingDraft(false);
    }
  };

  const handleDiscardDraft = async () => {
    if (draftId) {
      try {
        await axios.delete(`/api/v1/drafts/${draftId}`);
        toast.success("Draft discarded");
        refresh();
      } catch {
        toast.error("Failed to delete draft");
      }
    }
    setComposeOpen(false);
  };

  const handleClose = () => {
    const hasContent = !!(to.trim() || subject.trim() || body.trim());
    if (hasContent && !lastSavedTime) {
      setShowClosePrompt(true);
    } else {
      setComposeOpen(false);
    }
  };

  const handleFileAttach = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (file.type.startsWith("image/")) {
        try {
          const compResult = await compressImage(file, {
            maxWidth: 1600,
            maxHeight: 1600,
            quality: 0.85,
            maxOutputSizeBytes: 1024 * 1024,
          });
          const rawBase64 = compResult.dataUrl.split(",")[1];
          setAttachments((prev) => [
            ...prev,
            {
              id: generateId(),
              name: file.name.replace(/\.[^/.]+$/, "") + ".webp",
              size: compResult.compressedSize,
              type: "image/webp",
              base64: rawBase64,
            },
          ]);
          toast.success(
            `Image compressed (${formatFileSize(compResult.originalSize)} → ${compResult.formattedCompressedSize})`,
          );
          continue;
        } catch {}
      }

      if (file.size > 15 * 1024 * 1024) {
        toast.error(`File "${file.name}" exceeds 15 MB limit`);
        continue;
      }

      try {
        const base64 = await fileToBase64(file);
        setAttachments((prev) => [
          ...prev,
          {
            id: generateId(),
            name: file.name,
            size: file.size,
            type: file.type || "application/octet-stream",
            base64,
          },
        ]);
      } catch {
        toast.error(`Failed to attach ${file.name}`);
      }
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const applyFormatting = (
    type: "bold" | "italic" | "link" | "list" | "quote" | "code",
  ) => {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = body.substring(start, end);

    let prefix = "";
    let suffix = "";
    let defaultText = "text";

    switch (type) {
      case "bold":
        prefix = "**";
        suffix = "**";
        defaultText = "bold text";
        break;
      case "italic":
        prefix = "*";
        suffix = "*";
        defaultText = "italic text";
        break;
      case "link":
        prefix = "[";
        suffix = "](https://example.com)";
        defaultText = selected || "link title";
        break;
      case "list":
        prefix = "\n• ";
        suffix = "";
        defaultText = selected || "list item";
        break;
      case "quote":
        prefix = "\n> ";
        suffix = "";
        defaultText = selected || "quoted text";
        break;
      case "code":
        prefix = "`";
        suffix = "`";
        defaultText = selected || "code";
        break;
    }

    const replacement = `${prefix}${selected || defaultText}${suffix}`;
    const newBody = body.substring(0, start) + replacement + body.substring(end);
    setBody(newBody);

    setTimeout(() => {
      el.focus();
      el.setSelectionRange(
        start + prefix.length,
        start + prefix.length + (selected ? selected.length : defaultText.length),
      );
    }, 0);
  };

  const insertSignature = () => {
    setBody((prev) =>
      prev ? `${prev}\n\n--\nBest regards,\nSent from Mailing` : `--\nBest regards,\nSent from Mailing`,
    );
  };

  return (
    <>
      <div
        ref={panelRef}
        style={
          maximized
            ? undefined
            : panelSize
              ? { width: `${panelSize.width}px`, height: `${panelSize.height}px` }
              : undefined
        }
        className={cn(
          "fixed z-50 flex flex-col bg-card border border-border shadow-2xl overflow-hidden rounded-xl animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-6 duration-200 ease-out motion-reduce:animate-none transition-all",
          maximized
            ? "inset-4 md:inset-8"
            : "bottom-0 right-4 md:right-8 w-full max-w-xl h-140"
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDraggingOver(false);
          handleFileAttach(e.dataTransfer.files);
        }}
      >
        {/* Resize Handles */}
        {!maximized && (
          <>
            <div
              onPointerDown={(e) => startResize("top", e)}
              className="absolute top-0 left-0 right-0 h-1.5 cursor-ns-resize z-20"
            />
            <div
              onPointerDown={(e) => startResize("left", e)}
              className="absolute top-0 bottom-0 left-0 w-1.5 cursor-ew-resize z-20"
            />
            <div
              onPointerDown={(e) => startResize("corner", e)}
              className="absolute top-0 left-0 size-3 cursor-nwse-resize z-30"
            />
          </>
        )}

        {/* Drag over overlay */}
        {isDraggingOver && (
          <div className="absolute inset-0 z-30 bg-primary/10 backdrop-blur-xs border-2 border-dashed border-primary flex items-center justify-center pointer-events-none">
            <div className="bg-card px-4 py-2 rounded-lg shadow-sm border border-border flex items-center gap-2 text-sm font-medium text-foreground">
              <Paperclip className="size-4 text-primary" />
              <span>Drop files here to attach</span>
            </div>
          </div>
        )}

        {/* Window Title Header */}
        <div className="h-11 px-4 border-b border-border flex items-center justify-between bg-muted/40 text-sm font-semibold select-none">
          <span className="text-foreground tracking-tight">{panelTitle}</span>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon-xs"
              className="size-7 text-muted-foreground hover:text-foreground"
              onClick={() => setMaximized((m) => !m)}
              aria-label={maximized ? "Restore window" : "Maximize window"}
            >
              {maximized ? (
                <Minimize2 className="size-3.5" />
              ) : (
                <Maximize2 className="size-3.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              className="size-7 text-muted-foreground hover:text-foreground"
              onClick={handleClose}
              aria-label="Close composer"
            >
              <X className="size-3.5" />
            </Button>
          </div>
        </div>

        {/* Header Input Fields */}
        <div className="flex flex-col border-b border-border/40 text-sm">
          <div className="flex items-center px-3 border-b border-border/40">
            <span className="text-xs font-semibold text-muted-foreground w-12 shrink-0 select-none">
              To
            </span>
            <Input
              className="border-0 shadow-none focus-visible:ring-0 focus-visible:border-transparent focus-visible:outline-none focus:outline-none focus:ring-0 outline-none ring-0 px-1 h-9 text-sm rounded-none bg-transparent flex-1"
              placeholder="Recipients (comma separated)"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              autoFocus
            />
            {!showCc && (
              <Button
                variant="ghost"
                size="xs"
                className="text-xs text-muted-foreground hover:text-foreground h-6 px-2"
                onClick={() => setShowCc(true)}
                type="button"
              >
                Cc / Bcc
              </Button>
            )}
          </div>

          {showCc && (
            <>
              <div className="flex items-center px-3 border-b border-border/40">
                <span className="text-xs font-semibold text-muted-foreground w-12 shrink-0 select-none">
                  Cc
                </span>
                <Input
                  className="border-0 shadow-none focus-visible:ring-0 focus-visible:border-transparent focus-visible:outline-none focus:outline-none focus:ring-0 outline-none ring-0 px-1 h-9 text-sm rounded-none bg-transparent flex-1"
                  placeholder="Cc recipients (comma separated)"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                />
              </div>
              <div className="flex items-center px-3 border-b border-border/40">
                <span className="text-xs font-semibold text-muted-foreground w-12 shrink-0 select-none">
                  Bcc
                </span>
                <Input
                  className="border-0 shadow-none focus-visible:ring-0 focus-visible:border-transparent focus-visible:outline-none focus:outline-none focus:ring-0 outline-none ring-0 px-1 h-9 text-sm rounded-none bg-transparent flex-1"
                  placeholder="Bcc recipients (comma separated)"
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="flex items-center px-3">
            <span className="text-xs font-semibold text-muted-foreground w-12 shrink-0 select-none">
              Subject
            </span>
            <Input
              className="border-0 shadow-none focus-visible:ring-0 focus-visible:border-transparent focus-visible:outline-none focus:outline-none focus:ring-0 outline-none ring-0 px-1 h-9 text-sm rounded-none bg-transparent flex-1 font-medium"
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
        </div>

        {/* Textarea message surface */}
        <Textarea
          ref={textareaRef}
          className="border-0 shadow-none focus-visible:ring-0 focus-visible:border-transparent focus-visible:outline-none focus:outline-none focus:ring-0 outline-none ring-0 p-4 text-sm rounded-none bg-transparent flex-1 resize-none leading-relaxed font-sans"
          placeholder="Write your email message... (Ctrl+Enter to send)"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              handleSend();
            }
          }}
        />

        {/* Attachments chip list */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 p-3 border-t border-border/40 bg-muted/20">
            {attachments.map((att) => {
              const Icon = getFileIcon(att.type);
              return (
                <Badge
                  key={att.id}
                  variant="secondary"
                  className="gap-1.5 py-1 px-2 text-xs font-normal rounded-full"
                >
                  <Icon className="size-3.5 text-muted-foreground" />
                  <span className="truncate max-w-40" title={att.name}>
                    {att.name}
                  </span>
                  <span className="text-muted-foreground text-[10px]">
                    ({formatBytes(att.size)})
                  </span>
                  <button
                    type="button"
                    className="hover:opacity-70 rounded p-0.5 ml-0.5"
                    onClick={() => removeAttachment(att.id)}
                    aria-label={`Remove ${att.name}`}
                  >
                    <X className="size-3 text-muted-foreground" />
                  </button>
                </Badge>
              );
            })}
          </div>
        )}

        {/* Footer actions */}
        <div className="flex items-center justify-between p-3 border-t border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <Button
              className="gap-1.5 h-8 px-3 text-xs"
              disabled={sending || !to.trim()}
              onClick={handleSend}
            >
              {sending ? (
                <Spinner className="size-3.5" />
              ) : (
                <Send className="size-3.5" data-icon="inline-start" />
              )}
              <span>{sending ? "Sending…" : "Send"}</span>
            </Button>

            {autoSaving ? (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Spinner className="size-3" />
                <span>Saving draft...</span>
              </span>
            ) : lastSavedTime ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <CheckCircle2 className="size-3.5 text-emerald-500" />
                <span>Saved {lastSavedTime}</span>
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-1">
            <div className="flex items-center gap-0.5">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="size-7 text-muted-foreground hover:text-foreground"
                      aria-label="Bold (Ctrl+B)"
                      onClick={() => applyFormatting("bold")}
                    />
                  }
                >
                  <Bold className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent>Bold (Ctrl+B)</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="size-7 text-muted-foreground hover:text-foreground"
                      aria-label="Italic (Ctrl+I)"
                      onClick={() => applyFormatting("italic")}
                    />
                  }
                >
                  <Italic className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent>Italic (Ctrl+I)</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="size-7 text-muted-foreground hover:text-foreground"
                      aria-label="Link (Ctrl+K)"
                      onClick={() => applyFormatting("link")}
                    />
                  }
                >
                  <Link2 className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent>Insert link (Ctrl+K)</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="size-7 text-muted-foreground hover:text-foreground"
                      aria-label="Bulleted list"
                      onClick={() => applyFormatting("list")}
                    />
                  }
                >
                  <List className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent>Bulleted list</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="size-7 text-muted-foreground hover:text-foreground"
                      aria-label="Quote block"
                      onClick={() => applyFormatting("quote")}
                    />
                  }
                >
                  <Quote className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent>Quote block</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="size-7 text-muted-foreground hover:text-foreground"
                      aria-label="Code snippet"
                      onClick={() => applyFormatting("code")}
                    />
                  }
                >
                  <Code className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent>Code snippet</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="size-7 text-muted-foreground hover:text-foreground"
                      aria-label="Attach files"
                      onClick={() => fileInputRef.current?.click()}
                    />
                  }
                >
                  <Paperclip className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent>Attach files</TooltipContent>
              </Tooltip>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleFileAttach(e.target.files)}
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="size-7 text-muted-foreground hover:text-foreground"
                    aria-label="More options"
                  />
                }
              >
                <MoreHorizontal className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 p-1">
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    onClick={() => handleSaveDraft(false)}
                    disabled={savingDraft}
                  >
                    {savingDraft
                      ? "Saving..."
                      : draftId
                        ? "Update draft"
                        : "Save as draft"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={insertSignature}>
                    Insert signature
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleDiscardDraft}
                    className="text-destructive focus:text-destructive"
                  >
                    Discard draft
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Discard / Save Alert Dialog */}
      <AlertDialog open={showClosePrompt} onOpenChange={setShowClosePrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save draft or discard?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved content in this email. Would you like to save it as a draft to finish later, or discard it permanently?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowClosePrompt(false)}>
              Keep editing
            </AlertDialogCancel>
            <Button variant="destructive" onClick={handleDiscardDraft}>
              Discard
            </Button>
            <AlertDialogAction
              onClick={() => handleSaveDraft(true)}
              disabled={savingDraft}
            >
              {savingDraft
                ? "Saving..."
                : draftId
                  ? "Update draft"
                  : "Save as draft"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
