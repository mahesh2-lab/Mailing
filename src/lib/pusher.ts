import Pusher from "pusher";

const appId = (process.env.PUSHER_APP_ID || process.env.NEXT_PUBLIC_PUSHER_APP_ID || "").trim().replace(/^"|"$/g, "");
const key = (process.env.PUSHER_KEY || process.env.NEXT_PUBLIC_PUSHER_KEY || "").trim().replace(/^"|"$/g, "");
const secret = (process.env.PUSHER_SECRET || "").trim().replace(/^"|"$/g, "");
const cluster = (process.env.PUSHER_CLUSTER || process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "").trim().replace(/^"|"$/g, "");

export const pusherServer = new Pusher({
  appId,
  key,
  secret,
  cluster,
  useTLS: true,
});
