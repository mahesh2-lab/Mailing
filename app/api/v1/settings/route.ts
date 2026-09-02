import { NextResponse } from 'next/server';
import { z } from 'zod';

const SettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  notifications: z.boolean().optional(),
});

export async function GET() {
  return NextResponse.json({ theme: 'light', notifications: true });
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    
    const parseResult = SettingsSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parseResult.error.format() }, { status: 400 });
    }

    return NextResponse.json({ theme: 'light', notifications: true, ...parseResult.data });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
