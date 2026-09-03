"use client";

import { useEffect, useRef, useState } from "react";
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
  Loader2,
} from "lucide-react";
import { useSendMail } from "../hooks/use-mail";
import { useMailContext } from "./mail-context";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  if (type.includes("zip") || type.includes("tar") || type.includes("compressed")) return FileArchive;
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
  const [draftId, setDraftId] = useState<string | null>(composeDefaults?.draftId ?? null);
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

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Seed fields from composeDefaults when panel opens
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced auto-save drafts in background
  useEffect(() => {
    if (!to.trim() && !subject.trim() && !body.trim()) return;

    const timer = setTimeout(async () => {
      setAutoSaving(true);
      try {
        const recipients = to.split(",").map((e) => e.trim()).filter(Boolean);
        const ccList = cc.split(",").map((e) => e.trim()).filter(Boolean);
        const bccList = bcc.split(",").map((e) => e.trim()).filter(Boolean);

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
          new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
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
    !!composeDefaults?.to?.length &&
    composeDefaults?.subject?.startsWith("Re:");
  const panelTitle = isEditingDraft
    ? "Edit draft"
    : isForwarding
    ? "Forward message"
    : isReplying
    ? "Reply"
    : "New message";

  function hasUnsavedChanges(): boolean {
    return !!(
      to.trim() ||
      subject.trim() ||
      body.trim() ||
      cc.trim() ||
      bcc.trim() ||
      attachments.length > 0
    );
  }

  function handleRequestClose() {
    if (hasUnsavedChanges()) {
      setShowClosePrompt(true);
    } else {
      close();
    }
  }

  function close() {
    setComposeOpen(false);
    setMaximized(false);
    setDraftId(null);
    setTo("");
    setSubject("");
    setBody("");
    setShowCc(false);
    setCc("");
    setBcc("");
    setAttachments([]);
    setShowClosePrompt(false);
  }

  // Formatting actions
  function applyFormatting(format: "bold" | "italic" | "link" | "list" | "quote" | "code") {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = body.substring(start, end);
    let replacement = "";
    let newCursorPos = start;

    if (format === "bold") {
      replacement = selectedText ? `**${selectedText}**` : "**bold text**";
      newCursorPos = start + (selectedText ? replacement.length : 2);
    } else if (format === "italic") {
      replacement = selectedText ? `*${selectedText}*` : "*italic text*";
      newCursorPos = start + (selectedText ? replacement.length : 1);
    } else if (format === "link") {
      const url = prompt("Enter link URL:", "https://");
      if (url === null) return;
      replacement = selectedText ? `[${selectedText}](${url})` : `[Link text](${url})`;
      newCursorPos = start + replacement.length;
    } else if (format === "list") {
      if (selectedText) {
        replacement = selectedText
          .split("\n")
          .map((line) => (line.startsWith("- ") ? line : `- ${line}`))
          .join("\n");
      } else {
        replacement = "\n- First item\n- Second item\n";
      }
      newCursorPos = start + replacement.length;
    } else if (format === "quote") {
      replacement = selectedText ? `> ${selectedText.replace(/\n/g, "\n> ")}` : "> Quoted text";
      newCursorPos = start + replacement.length;
    } else if (format === "code") {
      replacement = selectedText.includes("\n")
        ? `\`\`\`\n${selectedText || "// code snippet"}\n\`\`\``
        : `\`${selectedText || "code"}\``;
      newCursorPos = start + replacement.length;
    }

    const newBody = body.substring(0, start) + replacement + body.substring(end);
    setBody(newBody);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }

  
  async function handleFiles(files: File[]) {
    const newItems: AttachedFile[] = [];
    for (const file of files) {
      try {
        const base64 = await fileToBase64(file);
        newItems.push({
          id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          size: file.size,
          type: file.type || "application/octet-stream",
          base64,
          url: URL.createObjectURL(file),
        });
      } catch {
        toast.error(`Failed to attach ${file.name}`);
      }
    }
    setAttachments((prev) => [...prev, ...newItems]);
    toast.success(`Attached ${newItems.length} file${newItems.length > 1 ? "s" : ""}`);
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  
  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (!sending && to.trim()) {
        handleSend();
      }
    } else if ((e.metaKey || e.ctrlKey) && (e.key === "b" || e.key === "B")) {
      e.preventDefault();
      applyFormatting("bold");
    } else if ((e.metaKey || e.ctrlKey) && (e.key === "i" || e.key === "I")) {
      e.preventDefault();
      applyFormatting("italic");
    } else if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
      e.preventDefault();
      applyFormatting("link");
    } else if (e.key === "Escape") {
      handleRequestClose();
    }
  }

  async function handleSaveDraft(andClose = false) {
    if (!to.trim() && !subject.trim() && !body.trim()) {
      toast.error("Cannot save an empty draft");
      return;
    }
    setSavingDraft(true);
    try {
      const recipients = to.split(",").map((e) => e.trim()).filter(Boolean);
      const ccList = cc.split(",").map((e) => e.trim()).filter(Boolean);
      const bccList = bcc.split(",").map((e) => e.trim()).filter(Boolean);

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
        if (res.data?.id) {
          setDraftId(res.data.id);
        }
        toast.success("Draft saved");
      }
      setLastSavedTime(
        new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
      refresh();
      if (andClose) {
        close();
      }
    } catch {
      toast.error("Failed to save draft");
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleDiscardDraft() {
    if (draftId) {
      try {
        await axios.delete(`/api/v1/drafts/${draftId}`);
        toast.success("Draft discarded");
        refresh();
      } catch {
        toast.error("Failed to discard draft");
      }
    } else {
      toast.success("Draft discarded");
    }
    close();
  }

  async function handleSend() {
    const recipients = to.split(",").map((e) => e.trim()).filter(Boolean);
    const ccList = cc.split(",").map((e) => e.trim()).filter(Boolean);
    const bccList = bcc.split(",").map((e) => e.trim()).filter(Boolean);

    try {
      const emailPayload = {
        to: recipients,
        cc: ccList,
        bcc: bccList,
        subject: subject || "(No Subject)",
        html: `<p>${body.replace(/\n/g, "<br/>")}</p>`,
        text: body,
        attachments: attachments.map((a) => ({
          id: a.id,
          filename: a.name,
          size: a.size,
          type: a.type,
          content: a.base64,
          url: a.url,
        })),
      };

      await sendMail(emailPayload);

      if (draftId) {
        try {
          await axios.delete(`/api/v1/drafts/${draftId}`);
        } catch {
          
        }
      }
      close();
      toast.success("Message sent successfully!");
      refresh();
    } catch {
      toast.error("Failed to send message.");
    }
  }

  function insertSignature() {
    const signature = "\n\n--\nBest regards,\nMahesh";
    setBody((prev) => prev + signature);
    toast.success("Signature inserted");
  }

  return (
    <>
      <div
        className={`compose-panel ${maximized ? "compose-maximized" : ""} ${
          isDraggingOver ? "drag-over" : ""
        }`}
        onKeyDown={handleKeyDown}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDraggingOver(false);
          if (e.dataTransfer.files?.length) {
            handleFiles(Array.from(e.dataTransfer.files));
          }
        }}
      >
        {}
        <input
          type="file"
          ref={fileInputRef}
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files?.length) {
              handleFiles(Array.from(e.target.files));
              e.target.value = "";
            }
          }}
        />

        {/* Drag overlay */}
        {isDraggingOver && (
          <div className="compose-drag-overlay">
            <Paperclip style={{ width: 32, height: 32, marginBottom: 8 }} />
            <strong>Drop files here to attach</strong>
          </div>
        )}

        <div className="compose-head">
          <strong>{panelTitle}</strong>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="icon-button small"
                    onClick={() => setMaximized(!maximized)}
                    aria-label={maximized ? "Minimize compose" : "Maximize compose"}
                  />
                }
              >
                {maximized ? (
                  <Minimize2 className="size-3.5" />
                ) : (
                  <Maximize2 className="size-3.5" />
                )}
              </TooltipTrigger>
              <TooltipContent>
                {maximized ? "Restore window" : "Maximize window"}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="icon-button small"
                    onClick={handleRequestClose}
                    aria-label="Close compose"
                  />
                }
              >
                <X className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent>Close compose (Esc)</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="compose-fields">
          <div className="to-row">
            <Input
              className="border-none shadow-none focus-visible:ring-0 px-3 h-9 text-sm rounded-none bg-transparent"
              placeholder="Recipients (comma separated)"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              autoFocus
            />
            {!showCc && (
              <Button
                variant="ghost"
                size="xs"
                className="cc-bcc-toggle text-xs text-muted-foreground hover:text-foreground h-6 px-2 mr-2"
                onClick={() => setShowCc(true)}
                type="button"
              >
                Cc/Bcc
              </Button>
            )}
          </div>
          {showCc && (
            <>
              <Input
                className="border-none shadow-none focus-visible:ring-0 px-3 h-9 text-sm rounded-none bg-transparent border-t border-border/40"
                placeholder="Cc (comma separated)"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
              />
              <Input
                className="border-none shadow-none focus-visible:ring-0 px-3 h-9 text-sm rounded-none bg-transparent border-t border-border/40"
                placeholder="Bcc (comma separated)"
                value={bcc}
                onChange={(e) => setBcc(e.target.value)}
              />
            </>
          )}
          <Input
            className="border-none shadow-none focus-visible:ring-0 px-3 h-9 text-sm rounded-none bg-transparent border-t border-border/40"
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>

        <Textarea
          ref={textareaRef}
          className="border-none shadow-none focus-visible:ring-0 p-3 text-sm rounded-none bg-transparent flex-1 resize-none"
          placeholder="Write your message... (Ctrl+Enter to send, Ctrl+B for bold)"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />

        {attachments.length > 0 && (
          <div className="compose-attachments-list flex flex-wrap gap-1.5 p-2.5 border-t border-border/40 bg-muted/20">
            {attachments.map((att) => {
              const Icon = getFileIcon(att.type);
              return (
                <Badge
                  key={att.id}
                  variant="secondary"
                  className="compose-attachment-chip gap-1.5 py-1 px-2 text-xs font-normal"
                >
                  <Icon className="compose-att-icon size-3.5 text-muted-foreground" />
                  <span className="compose-att-name truncate max-w-40" title={att.name}>
                    {att.name}
                  </span>
                  <span className="compose-att-size text-muted-foreground text-[11px]">
                    ({formatBytes(att.size)})
                  </span>
                  <button
                    type="button"
                    className="compose-att-remove hover:bg-muted/80 rounded p-0.5 cursor-pointer ml-0.5"
                    onClick={() => removeAttachment(att.id)}
                    aria-label={`Remove ${att.name}`}
                  >
                    <X className="size-3 text-muted-foreground hover:text-foreground" />
                  </button>
                </Badge>
              );
            })}
          </div>
        )}

        <div className="compose-foot">
          <div className="compose-foot-left">
            <Button
              className="send-button gap-1.5"
              disabled={sending || !to.trim()}
              data-loading={sending ? "true" : undefined}
              onClick={handleSend}
              title="Send email (Ctrl + Enter)"
            >
              {sending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              <span>{sending ? "Sending…" : "Send"}</span>
            </Button>

            <div className="compose-save-status">
              {autoSaving ? (
                <span className="saving-indicator flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                  Saving...
                </span>
              ) : lastSavedTime ? (
                <span className="saved-indicator flex items-center gap-1 text-xs text-muted-foreground">
                  <CheckCircle2 className="size-3 text-emerald-500" />
                  Saved {lastSavedTime}
                </span>
              ) : null}
            </div>
          </div>

          <div className="compose-foot-actions flex items-center gap-1">
            <div className="formatting-toolbar flex items-center gap-0.5">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="icon-button small"
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
                      className="icon-button small"
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
                      className="icon-button small"
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
                      className="icon-button small"
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
                      className="icon-button small"
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
                      className="icon-button small"
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
                      className="icon-button small"
                      aria-label="Attach files"
                      onClick={() => fileInputRef.current?.click()}
                    />
                  }
                >
                  <Paperclip className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent>Attach files</TooltipContent>
              </Tooltip>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="icon-button small"
                    aria-label="Compose options"
                  />
                }
              >
                <MoreHorizontal className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 p-1">
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
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <AlertDialog open={showClosePrompt} onOpenChange={setShowClosePrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save draft or discard?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes in this message. Do you want to save it as a draft or discard it?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowClosePrompt(false)}>
              Keep editing
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDiscardDraft}
            >
              Discard
            </Button>
            <AlertDialogAction
              onClick={() => handleSaveDraft(true)}
              disabled={savingDraft}
            >
              {savingDraft ? "Saving..." : draftId ? "Update draft" : "Save as draft"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

