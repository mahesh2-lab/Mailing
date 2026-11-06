import { useState } from "react";
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
      const payload: SendMailOptions =
        typeof toOrOptions === "object" && !Array.isArray(toOrOptions)
          ? toOrOptions
          : {
          to: toOrOptions,
          subject: subject || "No Subject",
          html: html || "",
          text: text || "",
        };

      const response = await axios.post("/api/v1/messages", payload);
      return response.data;
    } catch (err: unknown) {
      console.error("Failed to send message:", err);
      const apiError = axios.isAxiosError(err) ? err.response?.data?.error : undefined;
      const errorMessage = typeof apiError === "string"
        ? apiError
        : err instanceof Error ? err.message : "Failed to send email";
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setSending(false);
    }
  };

  return { sendMail, sending, error };
}
