import { NextResponse } from "next/server";
import { getAuthSession } from "@/src/lib/require-auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ attachmentId: string }> | { attachmentId: string } },
) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { attachmentId } = await Promise.resolve(params);
  return NextResponse.json({
    id: attachmentId,
    filename: "doc.pdf",
    url: "https://mock-url",
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ attachmentId: string }> | { attachmentId: string } },
) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { attachmentId } = await Promise.resolve(params);
  return NextResponse.json({
    success: true,
    deletedAttachmentId: attachmentId,
  });
}
