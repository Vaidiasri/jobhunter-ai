import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateSettings } from "@/lib/settings";

export async function POST() {
  try {
    const settings = await getOrCreateSettings();

    if (settings.scrapePending) {
      return NextResponse.json({
        queued: true,
        alreadyPending: true,
        lastScrapedAt: settings.lastScrapedAt,
      });
    }

    await prisma.userSettings.update({
      where: { id: "singleton" },
      data: { scrapePending: true },
    });

    return NextResponse.json({ queued: true, lastScrapedAt: settings.lastScrapedAt });
  } catch {
    return NextResponse.json({ error: "Failed to queue scrape" }, { status: 500 });
  }
}
