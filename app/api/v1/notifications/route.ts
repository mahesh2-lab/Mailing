import { NextResponse } from 'next/server';
import { pusherServer } from '@/src/lib/pusher';
import { getAuthSession } from '@/src/lib/require-auth';

export async function GET() {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ data: [{ id: 'n1', title: 'New email', read: false }] });
}

export async function POST(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();

    if (body.action === 'test-pusher' || body.test) {
      const channel = body.channel || 'emails';
      const event = body.event || 'new-email';
      const data = body.data || {
        emailId: `test_${Date.now()}`,
        from: 'Resend Test <notifications@mailing.app>',
        subject: 'Real-time Pusher Test Notification',
        preview: 'This is a real-time test toast notification from Pusher.',
      };

      await pusherServer.trigger(channel, event, data);
      return NextResponse.json({ success: true, message: 'Pusher event broadcasted successfully', triggered: { channel, event, data } });
    }

    return NextResponse.json({ success: true, markedRead: body.ids || [] });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
