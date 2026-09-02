import { Archive, ArchiveRestore, Trash2, RotateCcw } from "lucide-react";
import { Folder } from "@/hooks/use-mail";

export type MailActionType =
  | "archive"
  | "trash"
  | "restore"
  | "delete_permanent";

export interface MailActionConfig {
  id: MailActionType;
  label: string;
  tooltip: string;
  icon: typeof Archive;
  requiresConfirm?: boolean;
}

export function getActionsForFolder(
  folder: Folder | string | undefined,
  isLabel?: boolean
): {
  primaryActions: MailActionConfig[];
  canEmptyFolder?: boolean;
} {
  const normalized = folder?.toLowerCase();

  if (normalized === "trash") {
    return {
      primaryActions: [
        {
          id: "restore",
          label: "Restore to Inbox",
          tooltip: "Restore to Inbox",
          icon: RotateCcw,
        },
        {
          id: "delete_permanent",
          label: "Delete Permanently",
          tooltip: "Delete Permanently",
          icon: Trash2,
          requiresConfirm: true,
        },
      ],
      canEmptyFolder: true,
    };
  }

  if (normalized === "archive") {
    return {
      primaryActions: [
        {
          id: "restore",
          label: "Move to Inbox",
          tooltip: "Move to Inbox",
          icon: ArchiveRestore,
        },
        {
          id: "trash",
          label: "Delete",
          tooltip: "Move to Trash",
          icon: Trash2,
        },
      ],
      canEmptyFolder: false,
    };
  }

  if (normalized === "sent") {
    return {
      primaryActions: [
        {
          id: "archive",
          label: "Archive",
          tooltip: "Archive copy",
          icon: Archive,
        },
        {
          id: "trash",
          label: "Delete",
          tooltip: "Remove from Sent",
          icon: Trash2,
        },
      ],
      canEmptyFolder: false,
    };
  }

  if (normalized === "drafts") {
    return {
      primaryActions: [
        {
          id: "delete_permanent",
          label: "Discard Draft",
          tooltip: "Discard Draft",
          icon: Trash2,
          requiresConfirm: true,
        },
      ],
      canEmptyFolder: false,
    };
  }

  // Default (Inbox, Starred, Drafts, custom labels)
  return {
    primaryActions: [
      {
        id: "archive",
        label: "Archive",
        tooltip: "Archive",
        icon: Archive,
      },
      {
        id: "trash",
        label: "Delete",
        tooltip: "Move to Trash",
        icon: Trash2,
      },
    ],
    canEmptyFolder: false,
  };
}
