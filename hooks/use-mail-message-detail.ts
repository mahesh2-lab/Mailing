import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import type { MailItem } from "./use-mail";
import { parseSender } from "@/components/mail-thread-hierarchy";
import { toast } from "sonner";

const MESSAGE_DETAIL_DEBOUNCE_MS = 100;

export function useMessageDetail(id: string | null) {
  const [messageState, setMessageState] = useState<{ id: string | null; message: MailItem | null }>({
    id: null,
    message: null,
  });
  const message = messageState.id === id ? messageState.message : null;
  const setMessage = useCallback((next: React.SetStateAction<MailItem | null>) => {
    setMessageState((current) => {
      const currentMessage = current.id === id ? current.message : null;
      return { id, message: typeof next === "function" ? next(currentMessage) : next };
    });
  }, [id]);
  const [finishedId, setFinishedId] = useState<string | null>(null);
  const loading = id !== null && finishedId !== id;

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void axios
        .get(`/api/v1/messages/${id}`, { signal: controller.signal })
        .then((res) => {
          if (!mounted) return;
          const e = res.data;
          if (e?.id) {
            const sender = parseSender(e.from);
            setMessage({
              id: e.id,
              sender: {
                name: sender.name,
                email: sender.email,
              },
              to: Array.isArray(e.to) ? e.to : e.to ? [e.to] : [],
              cc: Array.isArray(e.cc) ? e.cc : e.cc ? [e.cc] : [],
              bcc: Array.isArray(e.bcc) ? e.bcc : e.bcc ? [e.bcc] : [],
              subject: e.subject || "No Subject",
              preview: "",
              rawText: e.text || "",
              rawHtml: e.html || "",
              body: e.html || e.text || "",
              timestamp:
                e.createdAt || e.created_at || new Date().toISOString(),
              folder: e.folder,
              status: e.status,
              unread: e.unread,
              starred: e.starred,
              labels: e.labels || [],
              attachments: (e.attachments || []).map((a: {
                id?: string;
                filename?: string;
                size?: number;
                download_url?: string;
                content_type?: string;
              }) => ({
                id: a.id || "attachment",
                filename: a.filename || "attachment",
                sizeBytes: a.size || 0,
                url: a.id
                  ? `/api/v1/messages/${e.id}/attachments/${a.id}`
                  : a.download_url || "#",
                type: a.content_type || "application/octet-stream",
              })),
            });
          }
        })
        .catch(() => {
          if (mounted && !controller.signal.aborted) {
            toast.error("Failed to load message");
          }
        })
        .finally(() => {
          if (mounted) setFinishedId(id);
        });
    }, MESSAGE_DETAIL_DEBOUNCE_MS);

    return () => {
      mounted = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [id, setMessage]);

  return { message, setMessage, loading };
}

