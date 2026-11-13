import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import type { MailItem } from "./use-mail";
import { toast } from "sonner";
import { extractErrorMessage } from "@/lib/utils";
interface ApiMailListRow {
  id: string;
  from?: string | null;
  avatarUrl?: string;
  createdAt?: string;
  created_at?: string;
  subject?: string | null;
  preview?: string | null;
  folder?: string;
  status?: string;
  unread?: boolean | null;
  starred?: boolean | null;
  labels?: string[] | null;
  attachments?: Array<{
    id: string;
    filename: string;
    size?: number;
    download_url?: string;
    content_type?: string;
  }> | null;
}

function mapMailItem(e: ApiMailListRow): MailItem {
  return {
    id: e.id,
    sender: {
      name: e.from?.split("<")[0].trim() || e.from || "Unknown",
      email: e.from || "",
      avatarUrl: e.avatarUrl,
    },
    subject: e.subject || "No Subject",
    preview: e.preview || "",
    rawText: "",
    rawHtml: "",
    body: "",
    timestamp: e.createdAt || e.created_at || new Date().toISOString(),
    folder: e.folder,
    status: e.status,
    unread: e.unread ?? false,
    starred: e.starred ?? false,
    labels: e.labels || [],
    attachments: (e.attachments || []).map((a) => ({
      id: a.id || "attachment",
      filename: a.filename || "attachment",
      sizeBytes: a.size || 0,
      url: a.id
        ? `/api/v1/messages/${e.id}/attachments/${a.id}`
        : a.download_url || "#",
      type: a.content_type || "application/octet-stream",
    })),
  };
}

export function useMailListData(
  folder: string | undefined,
  label: string | undefined,
  refreshTick: number,
) {
  const [mail, setMail] = useState<MailItem[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const hasLoadedOnce = useRef(false);
  const loadingMore = useRef(false);
  const listKey = `${folder ?? ""}:${label ?? ""}:${refreshTick}`;
  const activeListKey = useRef(listKey);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore.current) return;
    loadingMore.current = true;
    setIsFetching(true);
    const key = listKey;
    try {
      const res = await axios.get(
        `/api/v1/messages?folder=${encodeURIComponent(folder ?? "")}&label=${encodeURIComponent(label ?? "")}&limit=50&offset=${mail.length}`,
      );
      if (activeListKey.current !== key) return;
      const mapped: MailItem[] = (res.data || []).map(mapMailItem);
      setMail((current) => [...current, ...mapped]);
      setHasMore(res.headers["x-has-more"] === "true");
    } catch (err: unknown) {
      console.error("Failed to load more messages:", err);
      if (activeListKey.current === key) toast.error(extractErrorMessage(err, "Failed to load more messages"));
    } finally {
      if (activeListKey.current === key) {
        loadingMore.current = false;
        setIsFetching(false);
      }
    }
  }, [folder, hasMore, label, listKey, mail.length]);

  useEffect(() => {
    let mounted = true;
    activeListKey.current = listKey;
    loadingMore.current = false;

    if (!hasLoadedOnce.current) {
      setInitialLoading(true);
    } else {
      setIsFetching(true);
    }
    axios
      .get(`/api/v1/messages?folder=${encodeURIComponent(folder ?? "")}&label=${encodeURIComponent(label ?? "")}&limit=50&offset=0`)
      .then((res) => {
        if (!mounted) return;
        const mapped: MailItem[] = (res.data || []).map(mapMailItem);
        setMail(mapped);
        setHasMore(res.headers["x-has-more"] === "true");
        hasLoadedOnce.current = true;
      })
      .catch((err: unknown) => {
        console.warn("Failed to load initial messages:", err);
        if (mounted) toast.error(extractErrorMessage(err, "Failed to load messages"));
      })
      .finally(() => {
        if (mounted) {
          setInitialLoading(false);
          setIsFetching(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [folder, label, listKey, refreshTick]);

  return { mail, setMail, initialLoading, isFetching, hasMore, loadMore };
}

