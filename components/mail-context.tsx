"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { Folder } from "../hooks/use-mail";

interface MailContextValue {
  folder: Folder | undefined;
  setFolder: (f: Folder | undefined) => void;
  label: string | undefined;
  setLabel: (l: string | undefined) => void;
  query: string;
  setQuery: (q: string) => void;
  openId: string | null;
  setOpenId: (id: string | null) => void;
  composeOpen: boolean;
  setComposeOpen: (open: boolean) => void;
  composeDefaults: ComposeDefaults | null;
  openCompose: (defaults?: ComposeDefaults) => void;
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  refreshTick: number;
  refresh: () => void;
}

export interface ComposeDefaults {
  draftId?: string;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  body?: string;
}

const MailContext = createContext<MailContextValue | null>(null);

export function useMailContext() {
  const ctx = useContext(MailContext);
  if (!ctx) throw new Error("useMailContext must be used inside MailProvider");
  return ctx;
}

function getFolderFromPath(path: string | null): {
  folder?: Folder;
  label?: string;
} {
  if (!path) return { folder: "Inbox" };

  if (path.startsWith("/labels/")) {
    const rawLabel = decodeURIComponent(path.replace("/labels/", ""));
    return { label: rawLabel };
  }

  const clean = path.replace("/", "").toLowerCase();
  switch (clean) {
    case "starred":
      return { folder: "Starred" };
    case "sent":
      return { folder: "Sent" };
    case "drafts":
      return { folder: "Drafts" };
    case "archive":
      return { folder: "Archive" };
    case "trash":
      return { folder: "Trash" };
    case "inbox":
    case "":
      return { folder: "Inbox" };
    default:
      return {};
  }
}

export function MailProvider({
  children,
  initialFolder,
  initialLabel,
}: {
  children: ReactNode;
  initialFolder?: Folder;
  initialLabel?: string;
}) {
  const pathname = usePathname();

  const initialRoute = getFolderFromPath(pathname);
  const [folder, setFolder] = useState<Folder | undefined>(
    initialFolder ?? initialRoute.folder ?? "Inbox"
  );
  const [label, setLabel] = useState<string | undefined>(
    initialLabel ?? initialRoute.label
  );

  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeDefaults, setComposeDefaults] = useState<ComposeDefaults | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  function openCompose(defaults?: ComposeDefaults) {
    setComposeDefaults(defaults ?? null);
    setComposeOpen(true);
  }

  // Sync route changes without forcing component remounts
  useEffect(() => {
    if (!pathname) return;
    const resolved = getFolderFromPath(pathname);
    if (resolved.label !== undefined) {
      setLabel(resolved.label);
      setFolder(undefined);
      setOpenId(null);
    } else if (resolved.folder !== undefined) {
      setFolder(resolved.folder);
      setLabel(undefined);
      setOpenId(null);
    }
  }, [pathname]);

  // Initialize openId from URL search param if present
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const initialId = params.get("id") || params.get("messageId");
      if (initialId) {
        setOpenId(initialId);
      }
    }
  }, []);

  // Keep URL query param in sync with active openId
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (openId) {
      url.searchParams.set("id", openId);
    } else {
      url.searchParams.delete("id");
      url.searchParams.delete("messageId");
    }
    window.history.replaceState(null, "", url.toString());
  }, [openId]);

  function refresh() {
    setRefreshTick((t) => t + 1);
  }

  // Listen to real-time events triggered by Pusher
  useEffect(() => {
    const handleMailRefresh = () => {
      refresh();
    };
    window.addEventListener("mail:refresh", handleMailRefresh);
    return () => {
      window.removeEventListener("mail:refresh", handleMailRefresh);
    };
  }, []);

  return (
    <MailContext.Provider
      value={{
        folder,
        setFolder,
        label,
        setLabel,
        query,
        setQuery,
        openId,
        setOpenId,
        composeOpen,
        setComposeOpen,
        composeDefaults,
        openCompose,
        mobileNavOpen,
        setMobileNavOpen,
        refreshTick,
        refresh,
      }}
    >
      {children}
    </MailContext.Provider>
  );
}
