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
      select: { outreachEmail: true },
    });
    if (cached?.outreachEmail) {
      return NextResponse.json({ outreachEmail: cached.outreachEmail, cached: true });
    }
  }

  try {
    const outreachEmail = await generateWithResume(
      `Write a short cold outreach email to the hiring manager at ${job.company} for the ${job.title} role. Keep it under 150 words, professional but direct. End with a call to action.`
    );

    try {
      await prisma.aiContent.upsert({
        where: { jobId },
        create: { jobId, outreachEmail },
        update: { outreachEmail },
      });
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === "P2002") {
        const existing = await prisma.aiContent.findUnique({ where: { jobId }, select: { outreachEmail: true } });
        return NextResponse.json({ outreachEmail: existing?.outreachEmail, cached: true });
      }
      throw e;
    }

    return NextResponse.json({ outreachEmail, cached: false });
  } catch (err: unknown) {
    const msg = (err as Error).message;
    if (msg === "RESUME_MISSING") {
      return NextResponse.json({ error: "RESUME_MISSING" }, { status: 422 });
    }
    const cached = await prisma.aiContent.findUnique({ where: { jobId }, select: { outreachEmail: true } });
    if (cached?.outreachEmail) {
      return NextResponse.json({ outreachEmail: cached.outreachEmail, cached: true });
    }
    return NextResponse.json({ error: "AI service unavailable" }, { status: 503 });
  }
}
