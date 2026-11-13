import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getInitials(name: string) {
  const parts = name.trim().split(" ");
  return parts.length > 1
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  "#4f7df3",
  "#e0614a",
  "#3aaa72",
  "#d4784b",
  "#7b5ea7",
  "#4498c5",
  "#c45b8a",
  "#5b8c5a",
];

export function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function extractErrorMessage(
  error: unknown,
  fallback = "An unexpected error occurred",
): string {
  if (!error) return fallback;
  if (typeof error === "string" && error.trim()) return error;

  if (typeof error === "object") {
    const responseData = (error as { response?: { data?: unknown } }).response?.data;
    if (typeof responseData === "string" && responseData.trim()) {
      return responseData;
    }
    if (typeof responseData === "object" && responseData !== null) {
      const dataObj = responseData as Record<string, unknown>;
      if (typeof dataObj.error === "string" && dataObj.error.trim()) return dataObj.error;
      if (typeof dataObj.message === "string" && dataObj.message.trim()) return dataObj.message;
    }

    const errObj = error as Record<string, unknown>;
    if (typeof errObj.error === "string" && errObj.error.trim()) return errObj.error;
    if (typeof errObj.message === "string" && errObj.message.trim()) return errObj.message;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}


