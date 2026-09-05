"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  FileText,
  Inbox,
  Link,
  Pencil,
  Plus,
  Send,
  Settings,
  Star,
  Tag,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import axios from "axios";
import { Folder, MailItem } from "../hooks/use-mail";
import { useMailContext } from "./mail-context";
import ConfirmDialog from "./confirm-dialog";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const folderIcons: Record<Folder, typeof Inbox> = {
  Inbox,
  Starred: Star,
  Sent: Send,
  Drafts: FileText,
  Archive,
  Trash: Trash2,
};

const folderRoutes: Record<Folder, string> = {
  Inbox: "/inbox",
  Starred: "/starred",
  Sent: "/sent",
  Drafts: "/drafts",
  Archive: "/archive",
  Trash: "/trash",
};

export interface LabelData {
  id: string;
  name: string;
  color?: string | null;
  count: number;
}

const DEFAULT_LABEL_NAMES = ["Important", "Work", "Personal"];

function useMailSummary(refreshTick: number) {
  const [allMail, setAllMail] = useState<MailItem[]>([]);
  const [labels, setLabels] = useState<LabelData[]>([]);

  useEffect(() => {
    let mounted = true;
    axios
      .get("/api/v1/messages")
      .then((res) => {
        if (!mounted) return;
        const mapped: MailItem[] = (res.data || []).map((e: any) => ({
          id: e.id,
          sender: {
            name: e.from?.split("<")[0].trim() || e.from || "Unknown",
            email: e.from || "",
          },
          subject: e.subject || "",
          preview: "",
          body: "",
          timestamp: e.createdAt || e.created_at || "",
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
        setAllMail(mapped);
      })
      .catch(() => {});

    axios
      .get("/api/v1/labels")
      .then((res) => {
        if (!mounted) return;
        setLabels(res.data || []);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [refreshTick]);

  const counts = useMemo<Record<string, number>>(() => {
    const res: Record<string, number> = {
      Inbox: allMail.filter(
        (m) => (m.folder?.toLowerCase() === "inbox" || !m.folder) && m.unread,
      ).length,
      Starred: allMail.filter(
        (m) => m.starred && m.folder?.toLowerCase() !== "trash" && m.unread,
      ).length,
      Sent: allMail.filter(
        (m) => m.folder?.toLowerCase() === "sent" && m.unread,
      ).length,
      Drafts: allMail.filter(
        (m) =>
          (m.folder?.toLowerCase() === "drafts" ||
            m.status?.toLowerCase() === "draft" ||
            m.labels?.includes("Draft")) &&
          m.unread,
      ).length,
      Archive: allMail.filter(
        (m) => m.folder?.toLowerCase() === "archive" && m.unread,
      ).length,
      Trash: allMail.filter(
        (m) => m.folder?.toLowerCase() === "trash" && m.unread,
      ).length,
    };

    for (const lbl of labels) {
      res[lbl.name] = allMail.filter(
        (m) =>
          Array.isArray(m.labels) &&
          m.labels.includes(lbl.name) &&
          m.folder?.toLowerCase() !== "trash" &&
          m.unread,
      ).length;
    }

    return res;
  }, [allMail, labels]);

  const storageBytes = useMemo(() => {
    return allMail.reduce((acc, m) => {
      const attSize = (m.attachments || []).reduce(
        (sum, a) => sum + (a.sizeBytes || 0),
        0,
      );
      return acc + attSize;
    }, 0);
  }, [allMail]);

  return { counts, storageBytes, labels };
}

export default function MailSidebar() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const {
    folder,
    setFolder,
    label,
    setLabel,
    setOpenId,
    openCompose,
    mobileNavOpen,
    setMobileNavOpen,
    refreshTick,
    refresh,
  } = useMailContext();

  const { counts, storageBytes, labels } = useMailSummary(refreshTick);

  const [creatingLabel, setCreatingLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [creatingLoading, setCreatingLoading] = useState(false);

  // Deleting label state
  const [deleteLabelTarget, setDeleteLabelTarget] = useState<string | null>(
    null,
  );

  function selectFolder(name: Folder) {
    startTransition(() => {
      setFolder(name);
      setLabel(undefined);
      setOpenId(null);
      setMobileNavOpen(false);
      router.push(folderRoutes[name], { scroll: false });
    });
  }

  function selectLabel(name: string) {
    startTransition(() => {
      setLabel(name);
      setFolder(undefined);
      setOpenId(null);
      setMobileNavOpen(false);
      router.push(`/labels/${encodeURIComponent(name)}`, { scroll: false });
    });
  }

  async function handleCreateLabel(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newLabelName.trim();
    if (!trimmed) return;

    setCreatingLoading(true);
    try {
      await axios.post("/api/v1/labels", { name: trimmed });
      toast.success(`Label "${trimmed}" created`);
      setNewLabelName("");
      setCreatingLabel(false);
      refresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to create label");
    } finally {
      setCreatingLoading(false);
    }
  }

  async function handleDeleteLabel() {
    if (!deleteLabelTarget) return;
    const target = deleteLabelTarget;
    setDeleteLabelTarget(null);
    try {
      await axios.delete(`/api/v1/labels/${encodeURIComponent(target)}`);
      toast.success(`Label "${target}" deleted`);
      if (label === target) {
        setLabel(undefined);
        setFolder("Inbox");
        router.push("/inbox", { scroll: false });
      }
      refresh();
    } catch {
      toast.error("Failed to delete label");
    }
  }



  const storagePercent = Math.min(
    100,
    Math.max(2, (storageBytes / (1024 * 1024 * 1024)) * 100),
  );

  const mergedLabels = useMemo(() => {
    const existingNames = new Set(labels.map((l) => l.name.toLowerCase()));
    const list = [...labels];
    for (const name of DEFAULT_LABEL_NAMES) {
      if (!existingNames.has(name.toLowerCase())) {
        list.push({ id: name.toLowerCase(), name, count: counts[name] || 0 });
      }
    }
    return list;
  }, [labels, counts]);

  return (
    <>
      <aside className={`sidebar ${mobileNavOpen ? "nav-open" : ""}`}>
        <button
          className="sidebar-compose-btn w-full cursor-pointer"
          onClick={() => openCompose()}
        >
          <Pencil className="size-3.5" />
          <span>Compose</span>
          <span className="ml-auto text-[10px] text-muted-foreground font-mono">
            ⌘ N
          </span>
        </button>

        <nav aria-label="Mail folders">
          {(
            [
              "Inbox",
              "Starred",
              "Sent",
              "Drafts",
              "Archive",
              "Trash",
            ] as Folder[]
          ).map((name) => {
            const Icon = folderIcons[name];
            const isInbox = name === "Inbox";
            const isActive = folder === name && !label;
            return (
              <button
                key={name}
                className={`nav-item ${isInbox ? "nav-item-inbox" : ""} ${
                  isActive ? "active" : ""
                }`}
                onClick={() => selectFolder(name)}
              >
                <Icon className="size-3.5" />
                <span>{name}</span>
                {counts[name] > 0 && (
                  <Badge
                    variant="secondary"
                    className={`sidebar-count-badge ${counts[name] < 10 ? "is-single" : ""}`}
                  >
                    {counts[name]}
                  </Badge>
                )}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-spacer" />

        <div className="sidebar-heading-row flex items-center justify-between px-1">
          <strong className="sidebar-heading p-0">LABELS</strong>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="icon-button small create-label-btn h-5 w-5 text-muted-foreground hover:text-foreground"
                  aria-label="Create new label"
                  onClick={() => setCreatingLabel((prev) => !prev)}
                />
              }
            >
              <Plus className="size-3" />
            </TooltipTrigger>
            <TooltipContent>Create new label</TooltipContent>
          </Tooltip>
        </div>

        {creatingLabel && (
          <form
            className="create-label-inline-form"
            onSubmit={handleCreateLabel}
          >
            <Input
              placeholder="Label name..."
              value={newLabelName}
              onChange={(e) => setNewLabelName(e.target.value)}
              className="h-7 text-xs px-2"
              autoFocus
            />
            <Button
              type="submit"
              size="xs"
              disabled={creatingLoading || !newLabelName.trim()}
              data-loading={creatingLoading ? "true" : undefined}
              className="h-7 px-2 text-xs gap-1"
            >
              {creatingLoading ? (
                <span className="spinner sm" aria-hidden="true" />
              ) : null}
              {creatingLoading ? "Adding…" : "Add"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => {
                setCreatingLabel(false);
                setNewLabelName("");
              }}
            >
              <X className="size-3.5" />
            </Button>
          </form>
        )}

        <nav aria-label="Mail labels" className="sidebar-labels-nav">
          {mergedLabels.map((lbl) => {
            const isActive = label === lbl.name;
            const count = counts[lbl.name] || lbl.count || 0;
            const isDefault = DEFAULT_LABEL_NAMES.some(
              (n) => n.toLowerCase() === lbl.name.toLowerCase(),
            );
            return (
              <div
                key={lbl.name}
                className={`nav-label-wrapper flex items-center ${isActive ? "active" : ""}`}
              >
                <button
                  className="nav-label-btn flex items-center "
                  onClick={() => selectLabel(lbl.name)}
                >
                  <Tag className="size-3.5 shrink-0" />
                  <span title={lbl.name}>{lbl.name}</span>
                  {/* {count > 0 && (
                    <Badge
                      variant="secondary"
                      className={`sidebar-count-badge nav-label-badge ${count < 10 ? "is-single" : ""}`}
                    >
                      {count}
                    </Badge>
                  )} */}
                </button>
                {!isDefault && (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <button
                          className="icon-button small label-delete-icon"
                          aria-label={`Delete label "${lbl.name}"`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteLabelTarget(lbl.name);
                          }}
                        />
                      }
                    >
                      <Trash2 className="size-3" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Delete label &quot;{lbl.name}&quot;
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-spacer" />
        <button className="nav-item" onClick={() => router.push("/automations")}>
          <Zap className="size-3.5" />
          <span>Automations</span>
        </button>
        <button className="nav-item" onClick={() => router.push("/settings")}>
          <Settings className="size-3.5" />
          <span>Settings</span>
        </button>

        <div className="h-px bg-border my-2 mx-2" />

        <button className="nav-item" onClick={() => router.push("/docs")}>
          <FileText className="size-3.5" />
          <span>Docs</span>
        </button>
      </aside>

      {}
      <ConfirmDialog
        isOpen={!!deleteLabelTarget}
        title={`Delete label "${deleteLabelTarget}"?`}
        description={`This will remove the label "${deleteLabelTarget}" from all conversations. The conversations themselves will not be deleted.`}
        confirmLabel="Delete Label"
        onConfirm={handleDeleteLabel}
        onCancel={() => setDeleteLabelTarget(null)}
      />
    </>
  );
}
