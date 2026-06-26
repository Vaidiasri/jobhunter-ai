import { NextResponse } from "next/server";
import { generateWithResume } from "@/lib/gemini";

export async function POST() {
  try {
    const raw = await generateWithResume(
      `Review this resume for LinkedIn profile optimization. List 5–8 specific, actionable suggestions to improve the LinkedIn profile based on this resume. Focus on headline, summary, skills section, and experience descriptions. Return each suggestion on a new line starting with a dash (-).`
    );

    const suggestions = raw
      .split("\n")
      .map((line) => line.replace(/^[-*•]\s*/, "").trim())
      .filter((line) => line.length > 10);

    return NextResponse.json({ suggestions: suggestions.length > 0 ? suggestions : ["Could not parse suggestions — try again"] });
  } catch (err: unknown) {
    const msg = (err as Error).message;
    if (msg === "RESUME_MISSING") {
      return NextResponse.json({ error: "RESUME_MISSING" }, { status: 422 });
    }
    return NextResponse.json({ suggestions: ["Could not parse suggestions — try again"] });
  }
}
