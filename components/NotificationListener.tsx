"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import Pusher from "pusher-js";

export function NotificationListener() {
  useEffect(() => {
    const pusherKey =
      process.env.NEXT_PUBLIC_PUSHER_KEY || "";
    const pusherCluster =
      process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "";

    console.log("[NotificationListener] Connecting to Pusher...", {
      key: pusherKey,
      cluster: pusherCluster,
    });

    if (!pusherKey || !pusherCluster) {
      console.warn("[NotificationListener] Pusher key or cluster is missing. Real-time notifications will be disabled.");
      return;
    }

    const pusher = new Pusher(pusherKey, {
      cluster: pusherCluster,
      forceTLS: true,
    });

    pusher.connection.bind("connected", () => {
      console.log("[NotificationListener] Pusher connected successfully");
    });

    pusher.connection.bind("error", (err: any) => {
      console.error("[NotificationListener] Pusher error:", err);
    });

    
    const emailsChannel = pusher.subscribe("emails");

    emailsChannel.bind(
      "new-email",
      (data: {
        emailId?: string;
        from?: string;
        to?: string | string[];
        subject?: string;
        preview?: string;
      }) => {
        const from =
          data?.from?.replace(/<.*>/, "").trim() ||
          data?.from ||
          "Unknown Sender";
        const subject = data?.subject || "No Subject";

        toast.info(`New Email from ${from}`, {
          id: data.emailId ? `email-${data.emailId}` : undefined,
          description: subject,
          duration: 6000,
          action: {
            label: "View",
            onClick: () => {
              window.location.href = "/inbox";
            },
          },
        });

        window.dispatchEvent(new CustomEvent("mail:refresh", { detail: data }));
      },
    );

    emailsChannel.bind(
      "delivered",
      (data: {
        emailId?: string;
        to?: string | string[];
        subject?: string;
      }) => {
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
      },
    );

    emailsChannel.bind(
      "bounced",
      (data: {
        emailId?: string;
        to?: string | string[];
        subject?: string;
      }) => {
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
      },
    );

    emailsChannel.bind("sent", (data: any) => {
      window.dispatchEvent(new CustomEvent("mail:refresh", { detail: data }));
    });

    emailsChannel.bind("read", (data: any) => {
      window.dispatchEvent(new CustomEvent("mail:refresh", { detail: data }));
    });

    
    const notificationsChannel = pusher.subscribe("notifications");

    notificationsChannel.bind(
      "notification",
      (data: { title?: string; message?: string; description?: string }) => {
        toast.info(data.title || "Notification", {
          description: data.message || data.description,
          duration: 5000,
        });
      },
    );

    notificationsChannel.bind(
      "payment-success",
      (data: { message?: string }) => {
        toast.success(data?.message || "Payment successful!");
      },
    );

    notificationsChannel.bind(
      "toast",
      (data: {
        type?: "success" | "error" | "info" | "warning";
        message?: string;
        description?: string;
      }) => {
        const msg = data.message || "Notification";
        const opts = { description: data.description };
        if (data.type === "success") toast.success(msg, opts);
        else if (data.type === "error") toast.error(msg, opts);
        else if (data.type === "warning") toast.warning(msg, opts);
        else toast.info(msg, opts);
      },
    );

    notificationsChannel.bind(
      "test",
      (data: { message?: string; description?: string }) => {
        toast.success(data.message || "Pusher Connected!", {
          description:
            data.description ||
            "Pusher real-time notifications are working properly.",
        });
      },
    );

    return () => {
      emailsChannel.unbind_all();
      pusher.unsubscribe("emails");
      notificationsChannel.unbind_all();
      pusher.unsubscribe("notifications");
      pusher.disconnect();
    };
  }, []);

  return null;
}
