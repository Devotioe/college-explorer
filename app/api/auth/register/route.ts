import { NextResponse } from "next/server";
import { createPasswordSession, passwordSessionCookie, registerPasswordUser } from "../../../../lib/password-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: string; displayName?: string; password?: string };
    const user = await registerPasswordUser(body.email ?? "", body.displayName ?? "", body.password ?? "");
    const token = await createPasswordSession(user.id);
    const response = NextResponse.json({ user }, { status: 201 });
    response.cookies.set(passwordSessionCookie(token, request));
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "註冊失敗";
    return NextResponse.json({ error: message }, { status: message.includes("已經註冊") ? 409 : 400 });
  }
}
