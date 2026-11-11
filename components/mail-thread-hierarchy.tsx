"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "@/components/animate-ui/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { avatarColor, getInitials } from "@/lib/utils";
import type { MailItem } from "../hooks/use-mail";
import { EmailHtmlFrame } from "./email-html-frame";

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

interface ThreadStemConnectorProps {
  continues: boolean;
}

function ThreadStemConnector({ continues }: ThreadStemConnectorProps) {
  return (
    <svg
      className="absolute -left-6 top-0 w-6 h-full pointer-events-none text-neutral-400/70 dark:text-neutral-500 overflow-visible"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* If this node is not the last reply, the trunk line continues down 100% */}
      {continues ? (
        <line
          x1="0"
          y1="0"
          x2="0"
          y2="100%"
          stroke="currentColor"
          strokeWidth="2"
        />
      ) : (
        <line
          x1="0"
          y1="0"
          x2="0"
          y2="6"
          stroke="currentColor"
          strokeWidth="2"
        />
      )}
      {/* Curved elbow branching into avatar center at (24, 16) */}
      <path
        d="M 0 0 L 0 6 A 10 10 0 0 0 10 16 L 24 16"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
    </svg>
  );
}

interface ThreadReplyNodeProps {
  reply: ThreadTurn;
  isLast: boolean;
}

function ThreadReplyNode({ reply, isLast }: ThreadReplyNodeProps) {
  return (
    <div className="relative pb-4 group">
      <ThreadStemConnector continues={!isLast} />

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
            <span className="text-sm font-semibold text-foreground">
              {reply.senderName}
            </span>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
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
    if (message.rawHtml) {
      return <EmailHtmlFrame html={message.rawHtml} />;
    }
    return (
      <div className="whitespace-pre-wrap font-sans text-sm text-foreground leading-relaxed select-text w-full overflow-y-auto flex-1 min-h-0">
        {message.rawText || message.body}
      </div>
    );
  }

  const rootTurn = turns[0];
  const replies = turns.slice(1);

  return (
    <div className="reddit-thread-hierarchy w-full overflow-y-auto flex-1 min-h-0 pr-2">
      {/* Root Turn (Latest Message in the Thread) */}
      <div className="relative pb-4 group">
        {showReplies && replies.length > 0 && (
          <div
            className="absolute left-3.25 top-8 bottom-0 w-0.5 bg-neutral-400/70 dark:bg-neutral-500 pointer-events-none"
            aria-hidden="true"
          />
        )}

        <div className="flex items-start gap-3">
          <Avatar className="size-7 shrink-0 ring-2 ring-background mt-0.5">
            {message.sender.avatarUrl && (
              <AvatarImage
                src={message.sender.avatarUrl}
                alt={rootTurn.senderName}
              />
            )}
            <AvatarFallback
              style={{
                background: avatarColor(rootTurn.senderName),
                color: "#ffffff",
              }}
              className="text-[10px] font-semibold"
            >
              {getInitials(rootTurn.senderName)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground">
                {rootTurn.senderName}
              </span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {rootTurn.dateStr}
              </span>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 leading-none">
                Latest
              </span>
            </div>

            <div className="text-sm text-foreground/95 mt-1 leading-relaxed whitespace-pre-wrap wrap-break-word font-normal">
              {rootTurn.content}
            </div>
          </div>
        </div>
      </div>

      {/* Connected Thread Tree for Quoted Replies */}
      {showReplies && replies.length > 0 && (
        <div className="relative pl-9.5">
          {replies.map((reply, index) => (
            <ThreadReplyNode
              key={reply.id}
              reply={reply}
              isLast={index === replies.length - 1}
            />
          ))}
        </div>
      )}

      {/* Collapsible replies toggle button */}
      {replies.length > 0 && (
        <div className={showReplies ? "pl-9.5 pb-3" : "pt-1 pb-3"}>
          <button
            type="button"
            onClick={() => setShowReplies(!showReplies)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
          >
            <span>
              {showReplies
                ? "Hide replies"
                : `Show ${replies.length} earlier ${replies.length === 1 ? "reply" : "replies"}`}
            </span>
            {showReplies ? (
              <ChevronUp className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}
