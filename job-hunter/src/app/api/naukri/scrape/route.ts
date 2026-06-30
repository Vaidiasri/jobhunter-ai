import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const settings = await prisma.userSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", naukriScrapePending: true },
      update: { naukriScrapePending: true },
    });

    if (settings.naukriScrapePending) {
      return NextResponse.json({ queued: true });
    }

    return NextResponse.json({ error: "Could not queue scrape" }, { status: 500 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
