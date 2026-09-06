"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Pusher from "pusher-js";
import { authClient } from "@/src/lib/auth-client";
import {
  emailChannelForUser,
  notificationChannelForUser,
} from "@/lib/realtime-channels";

export function NotificationListener() {
  const { data: session } = authClient.useSession();
  const router = useRouter();

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      return;
    }

    const pusherKey =
      process.env.NEXT_PUBLIC_PUSHER_KEY?.replace(/['"]/g, "") || "";
    const pusherCluster =
      process.env.NEXT_PUBLIC_PUSHER_CLUSTER?.replace(/['"]/g, "") || "";

    console.log("[NotificationListener] Connecting to Pusher...", {
      key: pusherKey,
      cluster: pusherCluster,
    });

    if (
      !pusherKey ||
      !pusherCluster ||
      pusherKey === "undefined" ||
      pusherCluster === "undefined"
    ) {
      console.warn(
        "[NotificationListener] Pusher key or cluster is missing. Real-time notifications will be disabled.",
      );
      return;
    }

    const pusher = new Pusher(pusherKey, {
      cluster: pusherCluster,
      forceTLS: true,
      authEndpoint: "/api/pusher/auth",
    });

    pusher.connection.bind("connected", () => {
      console.log("[NotificationListener] Pusher connected successfully");
    });

    pusher.connection.bind("error", (err: unknown) => {
      console.error("[NotificationListener] Pusher error:", err);
    });

    const emailsChannelName = emailChannelForUser(userId);
    const notificationsChannelName = notificationChannelForUser(userId);
    const emailsChannel = pusher.subscribe(emailsChannelName);

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
              router.push("/inbox");
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

    emailsChannel.bind("sent", (data: { emailId?: string; subject?: string }) => {
      window.dispatchEvent(new CustomEvent("mail:refresh", { detail: data }));
    });

    emailsChannel.bind("read", (data: { emailId?: string }) => {
      window.dispatchEvent(new CustomEvent("mail:refresh", { detail: data }));
    });

    const notificationsChannel = pusher.subscribe(notificationsChannelName);

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
      pusher.unsubscribe(emailsChannelName);
      notificationsChannel.unbind_all();
      pusher.unsubscribe(notificationsChannelName);
      pusher.disconnect();
    };
  }, [router, session?.user?.id]);

  return null;
}
