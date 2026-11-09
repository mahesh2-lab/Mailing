"use client";

import { useState } from "react";
import {
  File,
  FileArchive,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileAudio,
  FileVideo,
  Download,
  ExternalLink,
  Link2,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/image-compressor";
import { toast } from "sonner";
import {
  PreviewCard,
  PreviewCardContent,
  PreviewCardTrigger,
} from "@/components/ui/preview-card";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Button } from "@/components/ui/button";

export interface AttachmentData {
  id: string;
  filename: string;
  sizeBytes: number;
  url: string;
}

interface FileMeta {
  type:
    | "image"
    | "pdf"
    | "archive"
    | "doc"
    | "sheet"
    | "code"
    | "media"
    | "generic";
  label: string;
  badge: string;
  color: string;
  iconBg: string;
  icon: typeof File;
}

function getFileMeta(filename: string): FileMeta {
  const ext = filename.split(".").pop()?.toLowerCase() || "";

  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"].includes(ext)) {
    return {
      type: "image",
      label: `${ext.toUpperCase()} Image`,
      badge: ext.toUpperCase(),
      color: "text-blue-500",
      iconBg: "bg-blue-500/10 border-blue-500/20 text-blue-500",
      icon: FileImage,
    };
  }

  if (ext === "pdf") {
    return {
      type: "pdf",
      label: "PDF Document",
      badge: "PDF",
      color: "text-rose-500",
      iconBg: "bg-rose-500/10 border-rose-500/20 text-rose-500",
      icon: FileText,
    };
  }

  if (["zip", "rar", "7z", "tar", "gz", "bz2", "xz"].includes(ext)) {
    return {
      type: "archive",
      label: "Compressed Archive",
      badge: ext.toUpperCase(),
      color: "text-amber-500",
      iconBg: "bg-amber-500/10 border-amber-500/20 text-amber-500",
      icon: FileArchive,
    };
  }

  if (["xls", "xlsx", "csv", "tsv", "numbers"].includes(ext)) {
    return {
      type: "sheet",
      label: "Spreadsheet",
      badge: ext.toUpperCase(),
      color: "text-emerald-500",
      iconBg: "bg-emerald-500/10 border-emerald-500/20 text-emerald-500",
      icon: FileSpreadsheet,
    };
  }

  if (["doc", "docx", "odt", "rtf", "pages"].includes(ext)) {
    return {
      type: "doc",
      label: "Word Document",
      badge: ext.toUpperCase(),
      color: "text-sky-500",
      iconBg: "bg-sky-500/10 border-sky-500/20 text-sky-500",
      icon: FileText,
    };
  }

  if (
    [
      "json",
      "xml",
      "html",
      "css",
      "js",
      "ts",
      "tsx",
      "jsx",
      "py",
      "sh",
      "sql",
      "yaml",
      "yml",
      "md",
    ].includes(ext)
  ) {
    return {
      type: "code",
      label: "Code / Data",
      badge: ext.toUpperCase(),
      color: "text-purple-500",
      iconBg: "bg-purple-500/10 border-purple-500/20 text-purple-500",
      icon: FileCode,
    };
  }

  if (["mp4", "mov", "avi", "mkv", "webm"].includes(ext)) {
    return {
      type: "media",
      label: "Video file",
      badge: ext.toUpperCase(),
      color: "text-pink-500",
      iconBg: "bg-pink-500/10 border-pink-500/20 text-pink-500",
      icon: FileVideo,
    };
  }

  if (["mp3", "wav", "m4a", "ogg", "flac"].includes(ext)) {
    return {
      type: "media",
      label: "Audio file",
      badge: ext.toUpperCase(),
      color: "text-indigo-500",
      iconBg: "bg-indigo-500/10 border-indigo-500/20 text-indigo-500",
      icon: FileAudio,
    };
  }

  return {
    type: "generic",
    label: ext ? `${ext.toUpperCase()} File` : "File",
    badge: ext ? ext.toUpperCase() : "FILE",
    color: "text-muted-foreground",
    iconBg: "bg-muted border-border text-muted-foreground",
    icon: File,
  };
}

export function AttachmentPreviewPill({
  attachment,
}: {
  attachment: AttachmentData;
}) {
  const [copied, setCopied] = useState(false);
  const [imageError, setImageError] = useState(false);
  const meta = getFileMeta(attachment.filename);
  const IconComponent = meta.icon;

  const downloadUrl = attachment.url.includes("?")
    ? `${attachment.url}&download=1`
    : `${attachment.url}?download=1`;

  const handleCopyLink = () => {
    const fullUrl = attachment.url.startsWith("http")
      ? attachment.url
      : `${typeof window !== "undefined" ? window.location.origin : ""}${attachment.url}`;
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    toast.success("Download link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = attachment.filename;
    link.click();
  };

  return (
    <PreviewCard>
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <PreviewCardTrigger
              render={
                <a
                  href={downloadUrl}
                  download={attachment.filename}
                  target="_blank"
                  rel="noreferrer"
                  title={`Download ${attachment.filename}`}
                  onContextMenu={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border/80 bg-background hover:bg-muted text-xs transition-colors max-w-xs group cursor-pointer shadow-2xs font-medium"
                />
              }
            />
          }
        >
          <IconComponent className={cn("size-3.5 shrink-0", meta.color)} />
          <span className="truncate max-w-44 text-foreground">
            {attachment.filename}
          </span>
          {attachment.sizeBytes > 0 && (
            <span className="text-[10px] text-muted-foreground font-normal shrink-0">
              ({formatFileSize(attachment.sizeBytes)})
            </span>
          )}
          <Download className="size-3 text-muted-foreground group-hover:text-foreground shrink-0 ml-0.5 transition-colors" />
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => window.open(attachment.url, "_blank")}>
            <ExternalLink className="size-4 mr-2" />
            Open in new tab
          </ContextMenuItem>
          <ContextMenuItem onClick={handleDownload}>
            <Download className="size-4 mr-2" />
            Download file
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleCopyLink}>
            <Link2 className="size-4 mr-2" />
            Copy download link
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <PreviewCardContent
        side="top"
        align="start"
        sideOffset={8}
        className={cn(
          "p-3 space-y-3",
          meta.type === "image" && !imageError ? "w-80" : "w-76"
        )}
      >
        {/* If Image: Visual Thumbnail Preview */}
        {meta.type === "image" && !imageError ? (
          <div className="space-y-2">
            <div className="relative w-full h-44 rounded-lg overflow-hidden bg-muted/50 border border-border/60 flex items-center justify-center group/img">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={attachment.url}
                alt={attachment.filename}
                className="w-full h-full object-contain"
                loading="lazy"
                onError={() => setImageError(true)}
              />
            </div>
            <div className="space-y-0.5 px-0.5">
              <div
                className="font-semibold text-xs text-foreground truncate"
                title={attachment.filename}
              >
                {attachment.filename}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="px-1.5 py-0.5 rounded border text-[10px] font-mono font-medium bg-muted/60 border-border/70">
                  {meta.badge}
                </span>
                {attachment.sizeBytes > 0 && (
                  <span>{formatFileSize(attachment.sizeBytes)}</span>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Non-Image / Icon Card Header */
          <div className="flex items-start gap-2.5 p-2 rounded-lg bg-muted/40 border border-border/50">
            <div
              className={cn(
                "size-10 rounded-lg flex items-center justify-center shrink-0 border",
                meta.iconBg,
              )}
            >
              <IconComponent className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div
                className="font-semibold text-xs text-foreground truncate"
                title={attachment.filename}
              >
                {attachment.filename}
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground flex-wrap">
                <span className="px-1.5 py-0.5 rounded border text-[10px] font-mono font-medium bg-background border-border/70">
                  {meta.badge}
                </span>
                {attachment.sizeBytes > 0 && (
                  <span>{formatFileSize(attachment.sizeBytes)}</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-1.5 pt-0.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.open(attachment.url, "_blank")}
            className="flex-1 h-7.5 text-xs gap-1.5 cursor-pointer font-medium"
          >
            <ExternalLink className="size-3 text-muted-foreground" />
            <span>Open</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleDownload}
            className="flex-1 h-7.5 text-xs gap-1.5 cursor-pointer font-medium"
          >
            <Download className="size-3" />
            <span>Download</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleCopyLink}
            className="size-7.5 text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
            title="Copy download link"
          >
            {copied ? (
              <Check className="size-3.5 text-emerald-500" />
            ) : (
              <Link2 className="size-3.5" />
            )}
          </Button>
        </div>
      </PreviewCardContent>
    </PreviewCard>
  );
}
