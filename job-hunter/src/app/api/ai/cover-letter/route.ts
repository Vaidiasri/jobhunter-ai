import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateWithResume } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  const { jobId, force } = await req.json();

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { title: true, company: true, description: true },
  });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  if (!force) {
    const cached = await prisma.aiContent.findUnique({
      where: { jobId },
      select: { coverLetter: true },
    });
    if (cached?.coverLetter) {
      return NextResponse.json({ coverLetter: cached.coverLetter, cached: true });
    }
  }

  try {
    const coverLetter = await generateWithResume(
      `Write a 3-paragraph cover letter for this role.\nTitle: ${job.title}\nCompany: ${job.company}\nDescription: ${job.description ?? "N/A"}`
    );

    try {
      await prisma.aiContent.upsert({
        where: { jobId },
        create: { jobId, coverLetter },
        update: { coverLetter },
      });
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === "P2002") {
        const existing = await prisma.aiContent.findUnique({ where: { jobId }, select: { coverLetter: true } });
        return NextResponse.json({ coverLetter: existing?.coverLetter, cached: true });
      }
      throw e;
    }

    return NextResponse.json({ coverLetter, cached: false });
  } catch (err: unknown) {
    const msg = (err as Error).message;
    if (msg === "RESUME_MISSING") {
      return NextResponse.json({ error: "RESUME_MISSING" }, { status: 422 });
    }
    const cached = await prisma.aiContent.findUnique({ where: { jobId }, select: { coverLetter: true } });
    if (cached?.coverLetter) {
      return NextResponse.json({ coverLetter: cached.coverLetter, cached: true });
    }
    return NextResponse.json({ error: "AI service unavailable" }, { status: 503 });
  }
}
