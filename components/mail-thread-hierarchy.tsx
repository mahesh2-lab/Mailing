"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { avatarColor, getInitials } from "@/lib/utils";
import type { MailItem } from "../hooks/use-mail";

export interface ThreadTurn {
  id: string;
  senderName: string;
  senderEmail: string;
  dateStr: string;
  content: string;
}

export function parseSender(fromStr?: string | null): {
  name: string;
  email: string;
} {
  if (!fromStr) return { name: "Unknown", email: "" };
  const match = fromStr.match(/^(.*?)\s*<([^>]+)>/);
  if (match) {
    const rawName = match[1].replace(/^["']|["']$/g, "").trim();
    const rawEmail = match[2].trim();
    return {
      name: rawName || rawEmail.split("@")[0],
      email: rawEmail,
    };
  }
  const clean = fromStr.trim();
  if (clean.includes("@")) {
    return { name: clean.split("@")[0], email: clean };
  }
  return { name: clean, email: clean };
}

/**
 * Extracts distinct conversation turns from an email body by parsing
 * email reply headers (e.g. "On Thu, Sep 3, 2026 at ... wrote:") even
 * when lines are prefixed with quote markers (">", "|") or wrapped across lines.
 */
export function parseEmailThreadTurns(
  rawHtml: string | undefined,
  rawText: string | undefined,
  rootSender: { name: string; email: string },
  rootTimestamp: string,
): ThreadTurn[] {
  const text =
    rawText ||
    rawHtml?.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "") ||
    "";

  const boundaryRegex =
    /(?:^|\n)[\s>|*]*On\s+([\s\S]+?)\s+wrote:\s*(?:\r?\n|$)/gi;

  const matches: {
    index: number;
    length: number;
    rawHeader: string;
  }[] = [];

  let m: RegExpExecArray | null;
  while ((m = boundaryRegex.exec(text)) !== null) {
    const raw = m[1];
    const cleanHeader = raw
      .split("\n")
      .map((l) => l.replace(/^[\s>|*]+/, ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (cleanHeader.length < 300 && !/wrote:/i.test(cleanHeader)) {
      matches.push({
        index: m.index,
        length: m[0].length,
        rawHeader: cleanHeader,
      });
    }
  }

  if (matches.length === 0) {
    return [
      {
        id: "root",
        senderName: rootSender.name,
        senderEmail: rootSender.email,
        dateStr: rootTimestamp,
        content: text.trim() || "(No content)",
      },
    ];
  }

  const turns: ThreadTurn[] = [];

  // Root message (newest turn in the thread)
  const rootContent = text.slice(0, matches[0].index).trim();
  turns.push({
    id: "root",
    senderName: rootSender.name,
    senderEmail: rootSender.email,
    dateStr: rootTimestamp,
    content: rootContent || "(No message body)",
  });

  // Previous quoted replies
  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const nextIndex =
      i + 1 < matches.length ? matches[i + 1].index : text.length;
    let rawBody = text.slice(cur.index + cur.length, nextIndex).trim();

    rawBody = rawBody
      .split("\n")
      .map((line) => line.replace(/^[\s>|*]+/, ""))
      .join("\n")
      .trim();

    let dateStr = "";
    let senderName = "Unknown";
    let senderEmail = "";

    const emailMatch = cur.rawHeader.match(/<([^>]+)>/);
    if (emailMatch) {
      senderEmail = emailMatch[1].trim();
      const beforeEmail = cur.rawHeader.slice(0, emailMatch.index).trim();
      const timeRegex =
        /^(.*?(?:[0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?(?:\s*[AaPp][Mm])?|[AaPp][Mm]))\s+(.+)$/;
      const timeMatch = beforeEmail.match(timeRegex);
      if (timeMatch) {
        dateStr = timeMatch[1].trim();
        senderName = timeMatch[2].trim();
      } else {
        senderName = beforeEmail;
      }
    } else {
      senderName = cur.rawHeader;
    }

    senderName = senderName
      .replace(/^at\s+/i, "")
      .replace(/^["']|["']$/g, "")
      .trim();

    turns.push({
      id: `turn-${i + 1}`,
      senderName: senderName || "Unknown",
      senderEmail,
      dateStr: dateStr || "Earlier",
      content: rawBody,
    });
  }

  return turns;
}

/**
 * Continuous SVG trunk connector and curved elbow into child avatar.
 * Guarantees zero seam, zero double-line, and exact vertical center alignment.
 */
function ThreadStemConnector() {
  return (
    <svg
      className="absolute -left-7 top-0 w-7 h-full pointer-events-none text-neutral-400/80 dark:text-neutral-400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Continuous trunk line descending to next item */}
      <line
        x1="6"
        y1="0"
        x2="6"
        y2="100%"
        stroke="currentColor"
        strokeWidth="2"
      />
      {/* Curved elbow branching into avatar center at y=15 */}
      <path
        d="M 6 0 L 6 5 A 10 10 0 0 0 16 15 L 28 15"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
    </svg>
  );
}

/**
 * Terminating SVG branch into the "Hide replies" / "Show replies" toggle.
 * Curves directly into the button text and terminates at y=14 without any trailing line.
 */
function ThreadTerminatingConnector() {
  return (
    <svg
      className="absolute -left-7 top-0 w-7 h-7 pointer-events-none text-neutral-400/80 dark:text-neutral-400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M 6 0 L 6 4 A 10 10 0 0 0 16 14 L 24 14"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
    </svg>
  );
}

interface ThreadReplyNodeProps {
  reply: ThreadTurn;
}

function ThreadReplyNode({ reply }: ThreadReplyNodeProps) {
  const handle = `@${reply.senderName.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase() || "user"}`;

  return (
    <div className="relative pb-6 group">
      <ThreadStemConnector />

      <div className="flex items-start gap-3">
        <Avatar className="size-7 shrink-0 ring-2 ring-background mt-0.5">
          <AvatarFallback
            style={{
              background: avatarColor(reply.senderName),
              color: "#ffffff",
            }}
            className="text-[10px] font-semibold"
          >
            {getInitials(reply.senderName)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-xs font-semibold text-foreground">
              {handle}
            </span>
            {reply.senderEmail && (
              <span className="text-[11px] text-muted-foreground/60 truncate">
                &lt;{reply.senderEmail}&gt;
              </span>
            )}
            <span className="text-[11px] text-muted-foreground ml-auto whitespace-nowrap">
              {reply.dateStr}
            </span>
          </div>

          <div className="text-sm text-foreground/90 mt-1 leading-relaxed whitespace-pre-wrap wrap-break-word font-normal">
            {reply.content}
          </div>
        </div>
      </div>
    </div>
  );
}

export interface ThreadHierarchyViewerProps {
  message: MailItem;
}

export function ThreadHierarchyViewer({ message }: ThreadHierarchyViewerProps) {
  const [showReplies, setShowReplies] = useState(true);

  const turns = useMemo(() => {
    return parseEmailThreadTurns(
      message.rawHtml || message.body,
      message.rawText ||
        (message.body && !message.body.includes("<div")
          ? message.body
          : undefined),
      message.sender,
      new Date(message.timestamp).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
  }, [
    message.rawHtml,
    message.rawText,
    message.body,
    message.sender,
    message.timestamp,
  ]);

  // Single turn: standard message view with no quotes
  if (turns.length <= 1) {
    return (
      <div
        className="email-body-content text-sm text-foreground/90 leading-relaxed font-normal"
        dangerouslySetInnerHTML={{ __html: message.body }}
      />
    );
  }

  const rootTurn = turns[0];
  const replies = turns.slice(1);

  return (
    <div className="reddit-thread-hierarchy space-y-4">
      {/* Root Turn Content */}
      <div className="text-sm text-foreground/95 leading-relaxed font-normal whitespace-pre-wrap">
        {rootTurn.content}
      </div>

      {/* Connected Thread Tree */}
      <div className="relative pl-9 sm:pl-10 pt-1">
        {showReplies && (
          <div className="flex flex-col">
            {replies.map((reply) => (
              <ThreadReplyNode key={reply.id} reply={reply} />
            ))}
          </div>
        )}

        {/* Collapsible replies toggle */}
        <div className="relative">
          <ThreadTerminatingConnector />

          <button
            type="button"
            onClick={() => setShowReplies(!showReplies)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/60 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
          >
            <span>
              {showReplies
                ? "Hide replies"
                : `Show ${replies.length} ${replies.length === 1 ? "reply" : "replies"}`}
            </span>
            {showReplies ? (
              <ChevronUp className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
