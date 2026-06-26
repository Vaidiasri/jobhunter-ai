import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, encryptToken } from "@/lib/calendar";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/settings?calendar=error", req.url));
  }

  try {
    const { refresh_token } = await exchangeCodeForTokens(code);
    const encrypted = encryptToken(refresh_token);
    await prisma.userSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", calendarToken: encrypted },
      update: { calendarToken: encrypted },
    });
    return NextResponse.redirect(new URL("/settings?calendar=connected", req.url));
  } catch {
    return NextResponse.redirect(new URL("/settings?calendar=error", req.url));
  }
}
