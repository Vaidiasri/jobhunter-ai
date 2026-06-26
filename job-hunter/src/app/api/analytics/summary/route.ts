import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildSummary } from "@/lib/analytics";

export async function GET() {
  try {
    const applications = await prisma.application.findMany({
      include: { job: { select: { platform: true, title: true } } },
    });
    return NextResponse.json(buildSummary(applications));
  } catch {
    return NextResponse.json({ error: "Failed to load analytics" }, { status: 500 });
  }
}
