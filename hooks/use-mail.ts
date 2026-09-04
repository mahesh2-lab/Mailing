import { useState, useEffect, useMemo } from "react";
import axios from "axios";

export type Folder = "Inbox" | "Starred" | "Sent" | "Drafts" | "Trash" | "Archive";

export type MailItem = {
  id: string;
  sender: {
    name: string;
    email: string;
    avatarUrl?: string;
  };
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  preview: string;
  body: string;
  rawText?: string;
  rawHtml?: string;
  timestamp: string;
  folder?: string;
  status?: string;
  unread?: boolean;
  starred?: boolean;
  labels?: string[];
  attachments?: {
    id: string;
    filename: string;
    sizeBytes: number;
    url: string;
    type: string;
  }[];
};

export function useMailList(initialFolder?: Folder, initialLabel?: string) {
  const [mail, setMail] = useState<MailItem[]>([]);
  const [refreshCount, setRefreshCount] = useState(0);
  
  const [folder, setFolder] = useState<Folder | undefined>(initialFolder);
  const [label, setLabel] = useState<string | undefined>(initialLabel);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [allMail, setAllMail] = useState<MailItem[]>([]);

  const counts = useMemo<Record<string, number>>(() => ({
    Inbox: allMail.filter((item) => item.folder?.toLowerCase() === "inbox" || !item.folder).length,
    Starred: allMail.filter((item) => item.starred && item.folder?.toLowerCase() !== "trash").length,
    Sent: allMail.filter((item) => item.folder?.toLowerCase() === "sent").length,
    Drafts: allMail.filter((item) => item.folder?.toLowerCase() === "drafts" || item.status?.toLowerCase() === "draft" || item.labels?.includes("Draft")).length,
    Archive: allMail.filter((item) => item.folder?.toLowerCase() === "archive").length,
    Trash: allMail.filter((item) => item.folder?.toLowerCase() === "trash").length,
    Important: allMail.filter((item) => item.labels?.includes("Important") && item.folder?.toLowerCase() !== "trash").length,
    Work: allMail.filter((item) => item.labels?.includes("Work") && item.folder?.toLowerCase() !== "trash").length,
    Personal: allMail.filter((item) => item.labels?.includes("Personal") && item.folder?.toLowerCase() !== "trash").length,
  }), [allMail]);

  const refresh = () => setRefreshCount((c) => c + 1);

  
  useEffect(() => {
    let isMounted = true;
    const fetchAllMessages = async () => {
      try {
        const response = await axios.get(`/api/v1/messages`);
        const rawEmails = response.data || [];
        if (!isMounted) return;
        const mapped: MailItem[] = rawEmails.map((email: any) => ({
          id: email.id,
          sender: { name: email.from?.split("<")[0].trim() || email.from || "Unknown", email: email.from || "" },
          subject: email.subject || "No Subject",
          preview: (email.text || email.html || "").replace(/<[^>]+>/g, "").slice(0, 130),
          body: email.html || email.text || "",
          timestamp: email.createdAt || email.created_at || new Date().toISOString(),
          folder: email.folder,
          status: email.status,
          unread: email.unread ?? false,
          starred: email.starred ?? false,
          labels: email.labels || [],
          attachments: (email.attachments || []).map((att: any) => ({
            id: att.id,
            filename: att.filename,
            sizeBytes: att.size || 0,
            url: att.download_url || "#",
            type: att.content_type || "application/octet-stream",
          })),
        }));
        if (isMounted) setAllMail(mapped);
      } catch {
        
      }
    };
    fetchAllMessages();
    return () => { isMounted = false; };
  }, [refreshCount]);

  
  useEffect(() => {
    let isMounted = true;

    const fetchMessages = async () => {
      try {
        const response = await axios.get(`/api/v1/messages?folder=${folder ?? ""}&label=${label ?? ""}`);
        const rawEmails = response.data || [];
        
        if (!isMounted) return;

        const mappedEmails: MailItem[] = rawEmails.map((email: any) => ({
          id: email.id,
          sender: {
            name: email.from?.split("<")[0].trim() || email.from || "Unknown",
            email: email.from || "",
          },
          subject: email.subject || "No Subject",
          preview: (email.text || email.html || "").replace(/<[^>]+>/g, "").slice(0, 130),
          body: email.html || email.text || "<p>No content</p>",
          timestamp: email.createdAt || email.created_at || new Date().toISOString(),
          folder: email.folder,
          status: email.status,
          unread: email.unread ?? false,
          starred: email.starred ?? false,
          labels: email.labels || [],
          attachments: (email.attachments || []).map((att: any) => ({
            id: att.id,
            filename: att.filename,
            sizeBytes: att.size || 0,
            url: att.download_url || "#",
            type: att.content_type || "application/octet-stream",
          })),
        }));

        setMail(mappedEmails);
      } catch (error) {
        if (isMounted) {
          console.error("Failed to fetch messages:", error);
        }
      }
    };

    fetchMessages();

    return () => {
      isMounted = false;
    };
  }, [folder, label, refreshCount]);

  const visible = useMemo(
    () =>
      mail.filter((item) => {
        const matchQuery =
          !query ||
          `${item.sender.name} ${item.subject} ${item.preview}`
            .toLowerCase()
            .includes(query.toLowerCase());

        return matchQuery;
      }),
    [mail, query],
  );

  const toggleSelect = (id: string) => {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  const selectAll = () => {
    setSelected(
      selected.length === visible.length && visible.length > 0
        ? []
        : visible.map((item) => item.id),
    );
  };

  return {
    mail,
    counts,
    refresh,
    folder,
    setFolder,
    label,
    setLabel,
    query,
    setQuery,
    selected,
    setSelected,
    visible,
    toggleSelect,
    selectAll,
  };
}

export function useMailMessage(id: string | null) {
  const [message, setMessage] = useState<MailItem | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchMessageDetail = async () => {
      if (!id) {
        setMessage(null);
        return;
      }

      setLoading(true);
      try {
        const response = await axios.get(`/api/v1/messages/${id}`);
        const email = response.data;
          
        if (!isMounted) return;

        if (email && email.id) {
          setMessage({
            id: email.id,
            sender: {
              name: email.from?.split("<")[0].trim() || email.from || "Unknown",
              email: email.from || "",
            },
            subject: email.subject || "No Subject",
            preview: (email.text || email.html || "").replace(/<[^>]+>/g, "").slice(0, 130),
            body: email.html || email.text || "<p>No content</p>",
            timestamp: email.createdAt || email.created_at || new Date().toISOString(),
            folder: email.folder,
            status: email.status,
            unread: email.unread ?? false,
            starred: email.starred ?? false,
            labels: email.labels || [],
            attachments: (email.attachments || []).map((att: any) => ({
              id: att.id,
              filename: att.filename,
              sizeBytes: att.size || 0,
              url: att.download_url || "#",
              type: att.content_type || "application/octet-stream",
            })),
          });
        }
      } catch (error) {
        if (isMounted) {
          console.error("Failed to fetch message details:", error);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchMessageDetail();

    return () => {
      isMounted = false;
    };
  }, [id]);

  return { message, loading };
}

export interface SendMailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{
    id?: string;
    filename: string;
    size?: number;
    type?: string;
    url?: string;
    content?: string;
  }>;
}

export function useSendMail() {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMail = async (
    toOrOptions: string | string[] | SendMailOptions,
    subject?: string,
    html?: string,
    text?: string
  ) => {
    setSending(true);
    setError(null);
    try {
      let payload: any;
      if (typeof toOrOptions === "object" && !Array.isArray(toOrOptions)) {
        payload = toOrOptions;
      } else {
        payload = {
          to: toOrOptions,
          subject: subject || "No Subject",
          html: html || "",
          text: text || "",
        };
      }

      const response = await axios.post("/api/v1/messages", payload);
      return response.data;
    } catch (err: any) {
      console.error("Failed to send message:", err);
      const errorMessage = err.response?.data?.error?.message || "Failed to send email";
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setSending(false);
    }
  };

  return { sendMail, sending, error };
}
