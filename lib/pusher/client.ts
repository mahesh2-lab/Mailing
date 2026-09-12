import Pusher from "pusher-js";
import { PusherConnectionError } from "./types";

let pusherInstance: Pusher | null = null;

export function getPusherClient(): Pusher | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (pusherInstance) {
    return pusherInstance;
  }

  const pusherKey =
    process.env.NEXT_PUBLIC_PUSHER_KEY?.replace(/['"]/g, "").trim() || "";
  const pusherCluster =
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER?.replace(/['"]/g, "").trim() || "";

  if (
    !pusherKey ||
    !pusherCluster ||
    pusherKey === "undefined" ||
    pusherCluster === "undefined"
  ) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[PusherClient] Pusher key or cluster is missing. Real-time updates will be disabled.",
      );
    }
    return null;
  }

  pusherInstance = new Pusher(pusherKey, {
    cluster: pusherCluster,
    forceTLS: true,
    authEndpoint: "/api/pusher/auth",
  });

  pusherInstance.connection.bind("error", (err: PusherConnectionError) => {
    const code = err?.error?.data?.code || err?.data?.code;
    const message =
      err?.error?.data?.message ||
      err?.data?.message ||
      err?.message ||
      err?.type ||
      "";

    // Ignore benign transport closure events (like code 1006 or standard reconnects)
    if (!code && (!message || message === "WebSocketError")) {
      return;
    }

    if (process.env.NODE_ENV === "development") {
      console.warn("[PusherClient] Connection event:", {
        code: code || "N/A",
        message: message || "Transport reconnecting",
        state: pusherInstance?.connection.state,
      });
    }
  });

  return pusherInstance;
}

export function disconnectPusherClient(): void {
  if (pusherInstance) {
    pusherInstance.connection.unbind_all();
    pusherInstance.disconnect();
    pusherInstance = null;
  }
}
