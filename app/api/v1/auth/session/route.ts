import { NextResponse } from 'next/server';

export async function GET() {
  // TODO: Verify session token
  return NextResponse.json({ authenticated: true, user: { id: '1', name: 'Demo User' } });
}
