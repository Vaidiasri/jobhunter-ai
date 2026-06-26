import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendDigest } from "@/lib/resend";
import { getOrCreateSettings } from "@/lib/settings";

export async function POST() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [jobs, dueReminders, settings] = await Promise.all([
    prisma.job.findMany({
      where: { fetchedAt: { gt: since }, matchScore: { gt: 60 } },
      orderBy: { matchScore: "desc" },
      take: 10,
    }),
    prisma.followUpReminder.findMany({
      where: { dueAt: { lte: new Date() }, status: "PENDING" },
      include: { application: { include: { job: true } } },
    }),
    getOrCreateSettings(),
  ]);

  const sent = await sendDigest(jobs, dueReminders, settings.digestEmail);

  if (!sent) {
    console.error("Digest send failed");
    return NextResponse.json({ sent: false });
  }

  return NextResponse.json({
    sent: true,
    jobCount: jobs.length,
    reminderCount: dueReminders.length,
  });
}
