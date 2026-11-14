import { NextResponse } from "next/server";
import { getCurrentPasswordUser } from "../../../../lib/password-auth";

export async function GET() {
  try {
    return NextResponse.json({ user: await getCurrentPasswordUser() });
  } catch {
    return NextResponse.json({ user: null });
  }
}
