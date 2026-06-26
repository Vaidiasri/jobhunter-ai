import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApplicationStatus } from "@prisma/client";

export async function GET() {
  const applications = await prisma.application.findMany({
    include: {
      job: true,
      followUpReminders: true,
      calendarEvents: true,
    },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ applications });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { jobId, status = "SAVED", notes } = body as {
    jobId: string;
    status?: ApplicationStatus;
    notes?: string;
  };

  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  const existing = await prisma.application.findUnique({ where: { jobId } });
  if (existing) {
    return NextResponse.json({ error: "Application already exists" }, { status: 409 });
  }

  const application = await prisma.application.create({
    data: {
      jobId,
      status,
      notes,
      appliedAt: status === "APPLIED" ? new Date() : null,
    },
    include: { job: true },
  });

  return NextResponse.json({ application }, { status: 201 });
}
