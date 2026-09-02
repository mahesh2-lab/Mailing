import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("==================>", body);
    
    return NextResponse.json({
      token: "mock-jwt-token",
      user: { id: "1", email: body.email },
    });
  } catch (error) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
