import { NextRequest, NextResponse } from "next/server";
import pdfParse from "pdf-parse";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file || file.type !== "application/pdf") {
    return NextResponse.json({ error: "PDF file required" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File exceeds 10 MB limit" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { text } = await pdfParse(buffer);

    if (!text?.trim()) {
      return NextResponse.json(
        { error: "Could not extract text — try a text-based PDF or paste your resume directly" },
        { status: 422 }
      );
    }

    return NextResponse.json({ text: text.trim() });
  } catch {
    return NextResponse.json(
      { error: "Could not extract text — try a text-based PDF or paste your resume directly" },
      { status: 422 }
    );
  }
}
