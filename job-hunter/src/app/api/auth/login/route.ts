import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";

export async function POST(req: NextRequest) {
  if (!process.env.ADMIN_PASSWORD) throw new Error("ADMIN_PASSWORD env var is required");
  if (!process.env.SESSION_SECRET) throw new Error("SESSION_SECRET env var is required");
  const { password } = await req.json();

  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const secret = new TextEncoder().encode(process.env.SESSION_SECRET!);
  const token = await new SignJWT({ sub: "vaibhav" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(secret);

  const res = NextResponse.json({ ok: true });
  res.cookies.set("session", token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return res;
}
