import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { destroyPasswordSession, SESSION_COOKIE } from "../../../../lib/password-auth";

export async function POST(request: Request) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  await destroyPasswordSession(token);
  const response = NextResponse.json({ ok: true });
  response.cookies.set({ name: SESSION_COOKIE, value: "", httpOnly: true, sameSite: "lax", secure: new URL(request.url).protocol === "https:", path: "/", maxAge: 0 });
  return response;
}
