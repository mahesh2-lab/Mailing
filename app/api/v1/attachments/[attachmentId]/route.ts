import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ attachmentId: string }> | { attachmentId: string } },
) {
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
  const { attachmentId } = await Promise.resolve(params);
  return NextResponse.json({
    success: true,
    deletedAttachmentId: attachmentId,
  });
}
