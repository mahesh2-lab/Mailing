import { NextResponse } from "next/server";
import { pusherServer } from "@/src/lib/pusher";
import { getAuthSession } from "@/src/lib/require-auth";

function getChannelUserId(channelName: string): string | null {
  const emailMatch = channelName.match(/^private-emails-(.+)$/);
  if (emailMatch) return emailMatch[1];

  const notificationMatch = channelName.match(/^private-notifications-(.+)$/);
  if (notificationMatch) return notificationMatch[1];

  return null;
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const socketId = formData.get("socket_id");
  const channelName = formData.get("channel_name");

  if (typeof socketId !== "string" || typeof channelName !== "string") {
    return NextResponse.json({ error: "Invalid auth payload" }, { status: 400 });
  }

  const channelUserId = getChannelUserId(channelName);
  if (!channelUserId || channelUserId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const auth = pusherServer.authorizeChannel(socketId, channelName);
  return NextResponse.json(auth);
}
