import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateWithResume } from "@/lib/gemini";
import { computeAtsScore } from "@/lib/ats";
import { getOrCreateSettings } from "@/lib/settings";

export async function POST(req: NextRequest) {
  const { jobId, force } = await req.json();

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { description: true },
  });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const settings = await getOrCreateSettings();
  const heuristic = computeAtsScore(job.description ?? "", settings.resumeText ?? "");

  if (heuristic?.nonEnglish) {
    return NextResponse.json({ score: null, nonEnglish: true, matched: [], missing: [] });
  }

  if (!force && heuristic !== null) {
    const cached = await prisma.aiContent.findUnique({
      where: { jobId },
      select: { atsScore: true, atsKeywords: true },
    });
    if (cached?.atsScore !== null && cached?.atsScore !== undefined) {
      return NextResponse.json({ score: cached.atsScore, keywords: cached.atsKeywords, cached: true });
    }
    return NextResponse.json({ ...heuristic, cached: false });
  }

  try {
    const raw = await generateWithResume(
      `Analyze this job description and extract the 15 most important keywords an ATS would look for.\nJob Description: ${job.description ?? "N/A"}\n\nReturn a JSON object: { "score": number (0-100), "matched": string[], "missing": string[] }`
    );

    let parsed: { score: number; matched: string[]; missing: string[] } | null = null;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch {
      // fallback to heuristic
    }

    const result = parsed ?? heuristic ?? { score: null, matched: [], missing: [] };

    await prisma.aiContent.upsert({
      where: { jobId },
      create: { jobId, atsScore: result.score, atsKeywords: result as object },
      update: { atsScore: result.score, atsKeywords: result as object },
    });

    return NextResponse.json({ ...result, cached: false });
  } catch (err: unknown) {
    const msg = (err as Error).message;
    if (msg === "RESUME_MISSING") {
      return NextResponse.json({ error: "RESUME_MISSING" }, { status: 422 });
    }
    return NextResponse.json(heuristic ?? { score: null, matched: [], missing: [] });
  }
}
