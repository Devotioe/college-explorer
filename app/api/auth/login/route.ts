import { NextResponse } from "next/server";
import { authenticatePasswordUser, createPasswordSession, passwordSessionCookie } from "../../../../lib/password-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: string; password?: string };
    const user = await authenticatePasswordUser(body.email ?? "", body.password ?? "");
    if (!user) return NextResponse.json({ error: "Email 或密碼不正確" }, { status: 401 });
    const token = await createPasswordSession(user.id);
    const response = NextResponse.json({ user });
    response.cookies.set(passwordSessionCookie(token, request));
    return response;
  } catch {
    return NextResponse.json({ error: "登入失敗，請稍後再試" }, { status: 500 });
  }
}
