import Pusher from "pusher";

const appId = (process.env.PUSHER_APP_ID || process.env.NEXT_PUBLIC_PUSHER_APP_ID || "2190994").trim().replace(/^"|"$/g, "");
const key = (process.env.PUSHER_KEY || process.env.NEXT_PUBLIC_PUSHER_KEY || "5080052518da30ff9d53").trim().replace(/^"|"$/g, "");
const secret = (process.env.PUSHER_SECRET || "ab38d0804e4176aece64").trim().replace(/^"|"$/g, "");
const cluster = (process.env.PUSHER_CLUSTER || process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "ap2").trim().replace(/^"|"$/g, "");

export const pusherServer = new Pusher({
  appId,
  key,
  secret,
  cluster,
  useTLS: true,
});
