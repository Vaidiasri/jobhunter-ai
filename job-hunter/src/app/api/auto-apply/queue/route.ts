import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const queue = await prisma.autoApplyQueue.findMany({
    include: { job: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ queue });
}

export async function POST(req: NextRequest) {
  const { jobId } = await req.json() as { jobId: string };

  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (!job.isQuickApply) {
    return NextResponse.json(
      { error: "This job does not support quick apply" },
      { status: 400 }
    );
  }

  const existing = await prisma.autoApplyQueue.findFirst({
    where: { jobId, status: { in: ["PENDING", "RUNNING"] } },
  });
  if (existing) {
    return NextResponse.json({ error: "Already in queue" }, { status: 409 });
  }

  const item = await prisma.autoApplyQueue.create({
    data: { jobId },
    include: { job: true },
  });

  await prisma.application.upsert({
    where: { jobId },
    create: { jobId, status: "SAVED" },
    update: {},
  });

  return NextResponse.json({ item }, { status: 201 });
}
