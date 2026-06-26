import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateWithResume } from "@/lib/gemini";
import { addDays } from "date-fns";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ company: string }> }
) {
  const { company } = await params;
  const role = req.nextUrl.searchParams.get("role") ?? "Software Engineer";
  const fresh = req.nextUrl.searchParams.get("fresh") === "1";

  if (!fresh) {
    const cached = await prisma.interviewPrep.findUnique({
      where: { company_role: { company, role } },
    });
    if (cached && cached.expiresAt > new Date()) {
      return NextResponse.json({ questions: cached.questions, source: "cache", expiresAt: cached.expiresAt });
    }
  }

  async function fetchQuestions(): Promise<string[]> {
    const raw = await generateWithResume(
      `List 10 likely interview questions for a ${role} position at ${company}. Number each question. Be specific to the company and role.`
    );
    const lines = raw
      .split("\n")
      .map((l) => l.replace(/^\d+[.)]\s*/, "").trim())
      .filter((l) => l.length > 10);
    return lines;
  }

  try {
    let questions: string[];
    try {
      questions = await fetchQuestions();
    } catch {
      questions = await fetchQuestions();
    }

    if (questions.length === 0) {
      return NextResponse.json({ questions: [], error: `No data found for this company` });
    }

    const expiresAt = addDays(new Date(), 30);
    await prisma.interviewPrep.upsert({
      where: { company_role: { company, role } },
      create: { company, role, questions, expiresAt },
      update: { questions, expiresAt, fetchedAt: new Date() },
    });

    return NextResponse.json({ questions, source: "fresh", expiresAt });
  } catch (err: unknown) {
    const msg = (err as Error).message;
    if (msg === "RESUME_MISSING") {
      return NextResponse.json({ error: "RESUME_MISSING" }, { status: 422 });
    }
    return NextResponse.json({ questions: [], error: "No data found for this company" });
  }
}
