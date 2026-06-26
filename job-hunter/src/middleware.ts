import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const EXEMPT = ["/api/calendar/callback", "/api/auth/login", "/api/auth/logout", "/login"];
const CRON_PATHS = ["/api/digest/send", "/api/reminders/check"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow static assets
  if (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Always allow exempt paths
  if (EXEMPT.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Cron routes: verify Bearer token, no session cookie needed
  if (CRON_PATHS.some((p) => pathname.startsWith(p))) {
    const auth = req.headers.get("authorization");
    const secret = process.env.CRON_SECRET;
    if (!secret || auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // All other routes require a valid session cookie
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    // Misconfigured server — block everything
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const token = req.cookies.get("session")?.value;
  if (!token) {
    return redirectOrUnauthorized(req, pathname);
  }

  try {
    const secret = new TextEncoder().encode(sessionSecret);
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    return redirectOrUnauthorized(req, pathname);
  }
}

function redirectOrUnauthorized(req: NextRequest, pathname: string) {
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
