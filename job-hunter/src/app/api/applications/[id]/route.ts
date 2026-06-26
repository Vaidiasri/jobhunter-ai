import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApplicationStatus } from "@prisma/client";
import { addDays } from "date-fns";
import { getOrCreateSettings } from "@/lib/settings";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { status, notes } = body as { status?: ApplicationStatus; notes?: string };

  const existing = await prisma.application.findUnique({
    where: { id },
    select: { status: true },
  });

  const data: Record<string, unknown> = {};
  if (status) {
    data.status = status;
    if (status === "APPLIED") data.appliedAt = new Date();
  }
  if (notes !== undefined) data.notes = notes;

  const application = await prisma.application.update({
    where: { id },
    data,
    include: { job: true },
  });

  if (status === "APPLIED" && existing?.status !== "APPLIED") {
    const settings = await getOrCreateSettings();
    const days = settings.reminderDays;
    const now = new Date();
    await prisma.followUpReminder.createMany({
      data: [
        { applicationId: id, type: "INITIAL", dueAt: addDays(now, days) },
        { applicationId: id, type: "FOLLOWUP_2", dueAt: addDays(now, days * 2) },
        { applicationId: id, type: "FOLLOWUP_3", dueAt: addDays(now, days * 4) },
      ],
      skipDuplicates: true,
    });
  }

  if (status && status !== "APPLIED" && existing?.status === "APPLIED") {
    await prisma.followUpReminder.updateMany({
      where: { applicationId: id, status: "PENDING" },
      data: { status: "SKIPPED" },
    });
  }

  return NextResponse.json({ application });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.application.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
