import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildSummary } from "@/lib/analytics";

export async function GET() {
  const [
    totalJobs,
    applicationsByStatus,
    platformBreakdown,
    queueStats,
    recentApplications,
  ] = await Promise.all([
    prisma.job.count(),

    prisma.application.groupBy({
      by: ["status"],
      _count: { status: true },
    }),

    prisma.application.findMany({
      include: { job: { select: { platform: true, title: true } } },
    }).then((apps) => {
      const summary = buildSummary(apps);
      const counts: Record<string, number> = {};
      summary.byPlatform.forEach(({ platform, count }) => { counts[platform] = count; });
      return counts;
    }),

    prisma.autoApplyQueue.groupBy({
      by: ["status"],
      _count: { status: true },
    }),

    prisma.application.findMany({
      take: 5,
      orderBy: { updatedAt: "desc" },
      include: { job: { select: { title: true, company: true, platform: true } } },
    }),
  ]);

  const statusMap: Record<string, number> = {};
  applicationsByStatus.forEach((row) => {
    statusMap[row.status] = row._count.status;
  });

  const queueMap: Record<string, number> = {};
  queueStats.forEach((row) => {
    queueMap[row.status] = row._count.status;
  });

  const totalApplied = statusMap["APPLIED"] ?? 0;
  const interviews = statusMap["INTERVIEW"] ?? 0;
  const offers = statusMap["OFFER"] ?? 0;
  const responseRate = totalApplied > 0 ? Math.round(((interviews + offers) / totalApplied) * 100) : 0;

  return NextResponse.json({
    totalJobs,
    totalApplied,
    totalSaved: statusMap["SAVED"] ?? 0,
    interviews,
    offers,
    rejected: statusMap["REJECTED"] ?? 0,
    responseRate,
    autoApplied: queueMap["COMPLETED"] ?? 0,
    queuePending: queueMap["PENDING"] ?? 0,
    platformBreakdown,
    recentApplications,
  });
}
