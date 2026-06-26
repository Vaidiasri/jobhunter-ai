import { NextResponse } from "next/server";
import { generateAuthUrl } from "@/lib/calendar";

export async function GET() {
  const url = generateAuthUrl();
  return NextResponse.redirect(url);
}
