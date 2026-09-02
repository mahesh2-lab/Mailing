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
  const { setComposeOpen, composeDefaults, notify, refresh } = useMailContext();
  const { sendMail, sending } = useSendMail();

  const [maximized, setMaximized] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(composeDefaults?.draftId ?? null);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [menu, setMenu] = useState<string | null>(null);
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
        // silent fail on auto-save
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

  function toggleMenu(name: string) {
    setMenu((cur) => (cur === name ? null : name));
  }

  function close() {
    setComposeOpen(false);
    setMaximized(false);
    setDraftId(null);
    setTo("");
    setSubject("");
    setBody("");
    setMenu(null);
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

  // Handle file uploads
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
        notify(`Failed to attach ${file.name}`);
      }
    }
    setAttachments((prev) => [...prev, ...newItems]);
    notify(`Attached ${newItems.length} file${newItems.length > 1 ? "s" : ""}`);
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  // Keyboard shortcut listener
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
      notify("Cannot save an empty draft");
      setMenu(null);
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
        notify("Draft updated");
      } else {
        const res = await axios.post("/api/v1/drafts", payload);
        if (res.data?.id) {
          setDraftId(res.data.id);
        }
        notify("Draft saved");
      }
      setLastSavedTime(
        new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
      refresh();
      if (andClose) {
        close();
      }
    } catch {
      notify("Failed to save draft");
    } finally {
      setSavingDraft(false);
      setMenu(null);
    }
  }

  async function handleDiscardDraft() {
    setMenu(null);
    if (draftId) {
      try {
        await axios.delete(`/api/v1/drafts/${draftId}`);
        notify("Draft discarded");
        refresh();
      } catch {
        notify("Failed to discard draft");
      }
    } else {
      notify("Draft discarded");
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
          // silent cleanup
        }
      }
      close();
      notify("Message sent successfully!");
      refresh();
    } catch {
      notify("Failed to send message.");
    }
  }

  function insertSignature() {
    const signature = "\n\n--\nBest regards,\nMahesh";
    setBody((prev) => prev + signature);
    setMenu(null);
    notify("Signature inserted");
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
        {/* Hidden file picker */}
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
          <div>
            <button
              className="icon-button small"
              onClick={() => setMaximized(!maximized)}
              aria-label={maximized ? "Minimize compose" : "Maximize compose"}
              title={maximized ? "Restore window" : "Maximize window"}
            >
              {maximized ? <Minimize2 /> : <Maximize2 />}
            </button>
            <button
              className="icon-button small"
              onClick={handleRequestClose}
              aria-label="Close compose"
              title="Close compose (Esc)"
            >
              <X />
            </button>
          </div>
        </div>

        <div className="compose-fields">
          <div className="to-row">
            <input
              placeholder="Recipients (comma separated)"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              autoFocus
            />
            {!showCc && (
              <button
                className="cc-bcc-toggle"
                onClick={() => setShowCc(true)}
                type="button"
              >
                Cc/Bcc
              </button>
            )}
          </div>
          {showCc && (
            <>
              <input
                placeholder="Cc (comma separated)"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
              />
              <input
                placeholder="Bcc (comma separated)"
                value={bcc}
                onChange={(e) => setBcc(e.target.value)}
              />
            </>
          )}
          <input
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>

        <textarea
          ref={textareaRef}
          placeholder="Write your message... (Ctrl+Enter to send, Ctrl+B for bold)"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />

        {/* Attachment chips preview */}
        {attachments.length > 0 && (
          <div className="compose-attachments-list">
            {attachments.map((att) => {
              const Icon = getFileIcon(att.type);
              return (
                <div key={att.id} className="compose-attachment-chip">
                  <Icon className="compose-att-icon" />
                  <span className="compose-att-name" title={att.name}>
                    {att.name}
                  </span>
                  <span className="compose-att-size">
                    ({formatBytes(att.size)})
                  </span>
                  <button
                    type="button"
                    className="compose-att-remove"
                    onClick={() => removeAttachment(att.id)}
                    aria-label={`Remove ${att.name}`}
                  >
                    <X />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="compose-foot">
          <div className="compose-foot-left">
            <button
              className="send-button"
              disabled={sending || !to.trim()}
              data-loading={sending ? "true" : undefined}
              onClick={handleSend}
              title="Send email (Ctrl + Enter)"
            >
              {sending ? (
                <span className="spinner sm" aria-hidden="true" />
              ) : (
                <Send />
              )}
              {sending ? "Sending…" : "Send"}
            </button>

            {/* Auto-save status */}
            <div className="compose-save-status">
              {autoSaving ? (
                <span className="saving-indicator">
                  <Loader2 className="spinning" style={{ width: 12, height: 12 }} />
                  Saving...
                </span>
              ) : lastSavedTime ? (
                <span className="saved-indicator">
                  <CheckCircle2 style={{ width: 12, height: 12, color: "#10b981" }} />
                  Saved {lastSavedTime}
                </span>
              ) : null}
            </div>
          </div>

          <div className="compose-foot-actions">
            {/* Formatting tools */}
            <div className="formatting-toolbar">
              <button
                type="button"
                className="icon-button small"
                aria-label="Bold (Ctrl+B)"
                title="Bold (Ctrl+B)"
                onClick={() => applyFormatting("bold")}
              >
                <Bold />
              </button>
              <button
                type="button"
                className="icon-button small"
                aria-label="Italic (Ctrl+I)"
                title="Italic (Ctrl+I)"
                onClick={() => applyFormatting("italic")}
              >
                <Italic />
              </button>
              <button
                type="button"
                className="icon-button small"
                aria-label="Link (Ctrl+K)"
                title="Insert link (Ctrl+K)"
                onClick={() => applyFormatting("link")}
              >
                <Link2 />
              </button>
              <button
                type="button"
                className="icon-button small"
                aria-label="Bulleted list"
                title="Bulleted list"
                onClick={() => applyFormatting("list")}
              >
                <List />
              </button>
              <button
                type="button"
                className="icon-button small"
                aria-label="Quote block"
                title="Quote block"
                onClick={() => applyFormatting("quote")}
              >
                <Quote />
              </button>
              <button
                type="button"
                className="icon-button small"
                aria-label="Code snippet"
                title="Code snippet"
                onClick={() => applyFormatting("code")}
              >
                <Code />
              </button>
              <button
                type="button"
                className="icon-button small"
                aria-label="Attach files"
                title="Attach files"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip />
              </button>
            </div>

            <div className="menu-wrap">
              <button
                className="icon-button small"
                aria-label="Compose options"
                title="More options"
                onClick={() => toggleMenu("compose-more")}
              >
                <MoreHorizontal />
              </button>
              {menu === "compose-more" && (
                <div className="dropdown">
                  <button
                    onClick={() => handleSaveDraft(false)}
                    disabled={savingDraft}
                  >
                    {savingDraft
                      ? "Saving..."
                      : draftId
                      ? "Update draft"
                      : "Save as draft"}
                  </button>
                  <button onClick={insertSignature}>
                    Insert signature
                  </button>
                  <button
                    onClick={handleDiscardDraft}
                    style={{ color: "var(--destructive)" }}
                  >
                    Discard draft
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Close prompt modal when closing with unsaved changes */}
      {showClosePrompt && (
        <div className="modal-backdrop" onClick={() => setShowClosePrompt(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-header">
              <div className="modal-header-title">
                <h3>Save draft or discard?</h3>
              </div>
              <button
                className="icon-button small"
                onClick={() => setShowClosePrompt(false)}
                aria-label="Cancel close"
              >
                <X />
              </button>
            </div>
            <p className="modal-body">
              You have unsaved changes in this message. Do you want to save it as a draft or discard it?
            </p>
            <div className="modal-actions" style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button
                className="button-secondary"
                onClick={() => setShowClosePrompt(false)}
              >
                Keep editing
              </button>
              <button
                className="button-destructive"
                onClick={handleDiscardDraft}
              >
                Discard
              </button>
              <button
                className="button-primary"
                onClick={() => handleSaveDraft(true)}
                disabled={savingDraft}
              >
                {savingDraft ? "Saving..." : draftId ? "Update draft" : "Save as draft"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

