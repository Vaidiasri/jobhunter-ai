import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateSettings } from "@/lib/settings";

export async function GET() {
  const settings = await getOrCreateSettings();
  const { calendarToken: _omit, ...rest } = settings;
  return NextResponse.json(rest);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { resumeText, digestEmail, reminderDays } = body;

  if (reminderDays !== undefined) {
    if (!Number.isInteger(reminderDays) || reminderDays <= 0) {
      return NextResponse.json({ error: "reminderDays must be a positive integer" }, { status: 400 });
    }
  }

  const updated = await prisma.userSettings.update({
    where: { id: "singleton" },
    data: {
      ...(resumeText !== undefined && { resumeText }),
      ...(digestEmail !== undefined && { digestEmail }),
      ...(reminderDays !== undefined && { reminderDays }),
    },
  });

  const { calendarToken: _omit, ...rest } = updated;
  return NextResponse.json(rest);
}
