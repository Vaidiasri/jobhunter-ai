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
      select: { tailoredResume: true },
    });
    if (cached?.tailoredResume) {
      return NextResponse.json({ tailoredResume: cached.tailoredResume, cached: true });
    }
  }

  try {
    const tailoredResume = await generateWithResume(
      `Rewrite the resume above to emphasize the skills and keywords most relevant to this job.\nTitle: ${job.title}\nCompany: ${job.company}\nDescription: ${job.description ?? "N/A"}\n\nReturn only the rewritten resume text.`
    );

    try {
      await prisma.aiContent.upsert({
        where: { jobId },
        create: { jobId, tailoredResume },
        update: { tailoredResume },
      });
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === "P2002") {
        const existing = await prisma.aiContent.findUnique({ where: { jobId }, select: { tailoredResume: true } });
        return NextResponse.json({ tailoredResume: existing?.tailoredResume, cached: true });
      }
      throw e;
    }

    return NextResponse.json({ tailoredResume, cached: false });
  } catch (err: unknown) {
    const msg = (err as Error).message;
    console.error("[tailor-resume] Gemini error:", err);
    if (msg === "RESUME_MISSING") {
      return NextResponse.json({ error: "RESUME_MISSING" }, { status: 422 });
    }
    const cached = await prisma.aiContent.findUnique({ where: { jobId }, select: { tailoredResume: true } });
    if (cached?.tailoredResume) {
      return NextResponse.json({ tailoredResume: cached.tailoredResume, cached: true });
    }
    return NextResponse.json({ error: "AI service unavailable" }, { status: 503 });
  }
}
