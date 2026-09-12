"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/src/lib/auth-client";
import { getPusherClient } from "@/lib/pusher/client";
import {
  emailChannelForUser,
  notificationChannelForUser,
} from "@/lib/realtime-channels";
import type {
  NewEmailPayload,
  DeliveryStatusPayload,
  NotificationPayload,
  ToastPayload,
} from "@/lib/pusher/types";

export function useRealtimeNotifications() {
  const { data: session } = authClient.useSession();
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      return;
    }

    const pusher = getPusherClient();
    if (!pusher) {
      return;
    }

    const emailsChannelName = emailChannelForUser(userId);
    const notificationsChannelName = notificationChannelForUser(userId);

    const emailsChannel = pusher.subscribe(emailsChannelName);
    const notificationsChannel = pusher.subscribe(notificationsChannelName);

    // Email Events
    emailsChannel.bind("new-email", (data: NewEmailPayload) => {
      const from =
        data?.from?.replace(/<.*>/, "").trim() ||
        data?.from ||
        "Unknown Sender";
      const subject = data?.subject || "No Subject";

      toast.info(`New Email from ${from}`, {
        id: data?.emailId ? `email-${data.emailId}` : undefined,
        description: subject,
        duration: 6000,
        action: {
          label: "View",
          onClick: () => {
            routerRef.current.push("/inbox");
          },
        },
      });

      window.dispatchEvent(new CustomEvent("mail:refresh", { detail: data }));
    });

    emailsChannel.bind("delivered", (data: DeliveryStatusPayload) => {
      const recipient = Array.isArray(data?.to)
        ? data.to.join(", ")
        : data?.to || "recipient";
      toast.success("Email Delivered", {
        description: data?.subject
          ? `"${data.subject}" to ${recipient}`
          : `Delivered to ${recipient}`,
        duration: 4000,
      });
      window.dispatchEvent(new CustomEvent("mail:refresh", { detail: data }));
    });

    emailsChannel.bind("bounced", (data: DeliveryStatusPayload) => {
      const recipient = Array.isArray(data?.to)
        ? data.to.join(", ")
        : data?.to || "recipient";
      toast.error("Email Bounced", {
        description: data?.subject
          ? `"${data.subject}" failed for ${recipient}`
          : `Delivery failed for ${recipient}`,
        duration: 6000,
      });
      window.dispatchEvent(new CustomEvent("mail:refresh", { detail: data }));
    });

    emailsChannel.bind("sent", (data: { emailId?: string; subject?: string }) => {
      window.dispatchEvent(new CustomEvent("mail:refresh", { detail: data }));
    });

    emailsChannel.bind("read", (data: { emailId?: string }) => {
      window.dispatchEvent(new CustomEvent("mail:refresh", { detail: data }));
    });

    // Notification Events
    notificationsChannel.bind("notification", (data: NotificationPayload) => {
      toast.info(data.title || "Notification", {
        description: data.message || data.description,
        duration: 5000,
      });
    });

    notificationsChannel.bind("payment-success", (data: { message?: string }) => {
      toast.success(data?.message || "Payment successful!");
    });

    notificationsChannel.bind("toast", (data: ToastPayload) => {
      const msg = data.message || "Notification";
      const opts = { description: data.description };
      if (data.type === "success") toast.success(msg, opts);
      else if (data.type === "error") toast.error(msg, opts);
      else if (data.type === "warning") toast.warning(msg, opts);
      else toast.info(msg, opts);
    });

    notificationsChannel.bind("test", (data: { message?: string; description?: string }) => {
      toast.success(data.message || "Pusher Connected!", {
        description:
          data.description ||
          "Pusher real-time notifications are working properly.",
      });
    });

    return () => {
      emailsChannel.unbind_all();
      pusher.unsubscribe(emailsChannelName);
      notificationsChannel.unbind_all();
      pusher.unsubscribe(notificationsChannelName);
    };
  }, [session?.user?.id]);
}
