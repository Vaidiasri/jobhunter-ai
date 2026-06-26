import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchAllJobQueries, fetchJobsFromJSearch, detectPlatform, isQuickApply, meetsMinSalary } from "@/lib/jsearch";
import { computeAtsScore } from "@/lib/ats";
import { getOrCreateSettings } from "@/lib/settings";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") ?? undefined;
  const platform = searchParams.get("platform") ?? undefined;
  const remote = searchParams.get("remote");
  const quickApply = searchParams.get("quickApply");
  const refresh = searchParams.get("refresh") === "true";

  try {
    if (refresh) {
      const rawJobs = query
        ? await fetchJobsFromJSearch(query, 1, "week", true)
        : await fetchAllJobQueries(true);

      const filtered = rawJobs.filter((j) => meetsMinSalary(j, 6));

      let resumeText = "";
      try {
        const settings = await getOrCreateSettings();
        resumeText = settings.resumeText ?? "";
      } catch {
        // non-fatal: score without resume
      }

      for (const job of filtered) {
        const plt = detectPlatform(job);
        const existing = await prisma.job.findUnique({
          where: { externalId: job.job_id },
          select: { matchScore: true },
        });
        const atsResult = !existing
          ? computeAtsScore(job.job_description ?? "", resumeText)
          : null;
        const matchScore = atsResult?.score ?? null;

        await prisma.job.upsert({
          where: { externalId: job.job_id },
          create: {
            externalId: job.job_id,
            title: job.job_title,
            company: job.employer_name,
            location: [job.job_city, job.job_state, job.job_country].filter(Boolean).join(", "),
            salaryMin: job.job_min_salary ?? null,
            salaryMax: job.job_max_salary ?? null,
            salaryCurrency: job.job_salary_currency ?? "INR",
            platform: plt,
            url: job.job_apply_link,
            description: job.job_description,
            isQuickApply: isQuickApply(job),
            isRemote: job.job_is_remote,
            employmentType: job.job_employment_type,
            postedAt: job.job_posted_at_datetime_utc
              ? new Date(job.job_posted_at_datetime_utc)
              : null,
            matchScore,
          },
          update: {
            title: job.job_title,
            company: job.employer_name,
            isQuickApply: isQuickApply(job),
            fetchedAt: new Date(),
          },
        });
      }
    }

    const where: Record<string, unknown> = {};
    if (platform) where.platform = platform;
    if (remote === "true") where.isRemote = true;
    if (quickApply === "true") where.isQuickApply = true;

    const jobs = await prisma.job.findMany({
      where,
      orderBy: { postedAt: "desc" },
      take: 100,
      include: {
        applications: { select: { status: true } },
        queueItems: { select: { status: true }, orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    return NextResponse.json({ jobs, count: jobs.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
