import { NextResponse } from 'next/server';
import { getAuthSession } from '@/src/lib/require-auth';

export async function POST(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    
    return NextResponse.json({ success: true, updatedIds: body.ids || [] });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
