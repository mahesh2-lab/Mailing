"use client";

import { useRealtimeNotifications } from "@/hooks/use-realtime-notifications";

/**
 * NotificationListener
 * Mounts real-time Pusher event listeners for authenticated users.
 * Thin declarative component adhering to clean React architecture standards.
 */
export function NotificationListener() {
  useRealtimeNotifications();
  return null;
}
