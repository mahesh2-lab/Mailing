"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  FileText,
  Inbox,
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
        (m) => m.folder?.toLowerCase() === "inbox" || !m.folder
      ).length,
      Starred: allMail.filter(
        (m) => m.starred && m.folder?.toLowerCase() !== "trash"
      ).length,
      Sent: allMail.filter((m) => m.folder?.toLowerCase() === "sent").length,
      Drafts: allMail.filter(
        (m) =>
          m.folder?.toLowerCase() === "drafts" ||
          m.status?.toLowerCase() === "draft" ||
          m.labels?.includes("Draft")
      ).length,
      Archive: allMail.filter((m) => m.folder?.toLowerCase() === "archive")
        .length,
      Trash: allMail.filter((m) => m.folder?.toLowerCase() === "trash").length,
    };

    for (const lbl of labels) {
      res[lbl.name] = allMail.filter(
        (m) =>
          Array.isArray(m.labels) &&
          m.labels.includes(lbl.name) &&
          m.folder?.toLowerCase() !== "trash"
      ).length;
    }

    return res;
  }, [allMail, labels]);

  const storageBytes = useMemo(() => {
    return allMail.reduce((acc, m) => {
      const attSize = (m.attachments || []).reduce(
        (sum, a) => sum + (a.sizeBytes || 0),
        0
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
    notify,
  } = useMailContext();

  const { counts, storageBytes, labels } = useMailSummary(refreshTick);

  // Creating label state
  const [creatingLabel, setCreatingLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [creatingLoading, setCreatingLoading] = useState(false);

  // Deleting label state
  const [deleteLabelTarget, setDeleteLabelTarget] = useState<string | null>(null);

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
      notify(`Label "${trimmed}" created`);
      setNewLabelName("");
      setCreatingLabel(false);
      refresh();
    } catch (err: any) {
      notify(err.response?.data?.error || "Failed to create label");
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
      notify(`Label "${target}" deleted`);
      if (label === target) {
        setLabel(undefined);
        setFolder("Inbox");
        router.push("/inbox", { scroll: false });
      }
      refresh();
    } catch {
      notify("Failed to delete label");
    }
  }

  const formattedStorage = useMemo(() => {
    if (storageBytes === 0) return "0 MB of 1 GB";
    if (storageBytes < 1024 * 1024) {
      return `${Math.round(storageBytes / 1024)} KB of 1 GB`;
    }
    return `${(storageBytes / (1024 * 1024)).toFixed(1)} MB of 1 GB`;
  }, [storageBytes]);

  const storagePercent = Math.min(
    100,
    Math.max(2, (storageBytes / (1024 * 1024 * 1024)) * 100)
  );

  return (
    <>
      <aside className={`sidebar ${mobileNavOpen ? "nav-open" : ""}`}>
        <button className="compose-button" onClick={() => openCompose()}>
          <Pencil /> Compose <span>⌘ N</span>
        </button>
        <nav aria-label="Mail folders">
          {(
            ["Inbox", "Starred", "Sent", "Drafts", "Archive", "Trash"] as Folder[]
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
                <Icon />
                <span>{name}</span>
                {counts[name] > 0 && <b>{counts[name]}</b>}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-spacer" />
        
        <div className="sidebar-heading-row">
          <strong className="sidebar-heading">Labels</strong>
          <button
            className="icon-button small create-label-btn"
            title="Create new label"
            aria-label="Create new label"
            onClick={() => setCreatingLabel((prev) => !prev)}
          >
            <Plus />
          </button>
        </div>

        {creatingLabel && (
          <form className="create-label-inline-form" onSubmit={handleCreateLabel}>
            <input
              placeholder="Label name..."
              value={newLabelName}
              onChange={(e) => setNewLabelName(e.target.value)}
              autoFocus
            />
            <button
              type="submit"
              className="button-primary small"
              disabled={creatingLoading || !newLabelName.trim()}
              data-loading={creatingLoading ? "true" : undefined}
              style={{ display: "flex", alignItems: "center", gap: 4 }}
            >
              {creatingLoading ? <span className="spinner sm" aria-hidden="true" /> : null}
              {creatingLoading ? "Adding…" : "Add"}
            </button>
            <button
              type="button"
              className="icon-button small"
              onClick={() => {
                setCreatingLabel(false);
                setNewLabelName("");
              }}
            >
              <X />
            </button>
          </form>
        )}

        <nav aria-label="Mail labels" className="sidebar-labels-nav">
          {labels.map((lbl) => {
            const isActive = label === lbl.name;
            const count = counts[lbl.name] || lbl.count || 0;
            return (
              <div
                key={lbl.name}
                className={`nav-label-wrapper ${isActive ? "active" : ""}`}
              >
                <button
                  className="nav-label-btn"
                  onClick={() => selectLabel(lbl.name)}
                >
                  <Tag />
                  <span>{lbl.name}</span>
                  {count > 0 && <b>{count}</b>}
                </button>
                <button
                  className="icon-button small label-delete-icon"
                  title={`Delete label "${lbl.name}"`}
                  aria-label={`Delete label "${lbl.name}"`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteLabelTarget(lbl.name);
                  }}
                >
                  <Trash2 />
                </button>
              </div>
            );
          })}
        </nav>

        <div className="sidebar-spacer" />
        <button className="nav-item" onClick={() => router.push("/automation")}>
          <Zap />
          <span>Automation</span>
        </button>
        <button className="nav-item" onClick={() => router.push("/settings")}>
          <Settings />
          <span>Settings</span>
        </button>
        <div className="storage">
          <div className="storage-row">
            <span>Storage</span>
            <span>{formattedStorage}</span>
          </div>
          <div className="storage-bar">
            <i
              className="storage-fill"
              style={{ width: `${storagePercent}%` }}
            />
          </div>
        </div>
      </aside>

      {/* Confirmation modal for deleting label */}
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
