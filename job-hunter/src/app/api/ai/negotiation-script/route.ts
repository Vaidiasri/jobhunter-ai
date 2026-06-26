import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateWithResume } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  const { jobId, force } = await req.json();

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { title: true, company: true, salaryMin: true, salaryMax: true },
  });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  if (!force) {
    const cached = await prisma.aiContent.findUnique({
      where: { jobId },
      select: { negotiationScript: true },
    });
    if (cached?.negotiationScript) {
      return NextResponse.json({ negotiationScript: cached.negotiationScript, cached: true });
    }
  }

  try {
    const salaryRange = job.salaryMin
      ? `${job.salaryMin}–${job.salaryMax ?? job.salaryMin}`
      : "not specified";

    const negotiationScript = await generateWithResume(
      `Write a salary negotiation script for this offer.\nCompany: ${job.company}\nRole: ${job.title}\nOffered range: ${salaryRange}\n\nInclude: opening statement, justification points based on my resume, counter-offer approach, and closing. Keep it conversational and confident.`
    );

    try {
      await prisma.aiContent.upsert({
        where: { jobId },
        create: { jobId, negotiationScript },
        update: { negotiationScript },
      });
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === "P2002") {
        const existing = await prisma.aiContent.findUnique({ where: { jobId }, select: { negotiationScript: true } });
        return NextResponse.json({ negotiationScript: existing?.negotiationScript, cached: true });
      }
      throw e;
    }

    return NextResponse.json({ negotiationScript, cached: false });
  } catch (err: unknown) {
    const msg = (err as Error).message;
    if (msg === "RESUME_MISSING") {
      return NextResponse.json({ error: "RESUME_MISSING" }, { status: 422 });
    }
    const cached = await prisma.aiContent.findUnique({ where: { jobId }, select: { negotiationScript: true } });
    if (cached?.negotiationScript) {
      return NextResponse.json({ negotiationScript: cached.negotiationScript, cached: true });
    }
    return NextResponse.json({ error: "AI service unavailable" }, { status: 503 });
  }
}
