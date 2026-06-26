import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createCalendarEvent } from "@/lib/calendar";
import { getOrCreateSettings } from "@/lib/settings";

export async function POST(req: NextRequest) {
  const { applicationId, scheduledAt: scheduledAtStr } = await req.json();

  const scheduledAt = new Date(scheduledAtStr);
  if (scheduledAt <= new Date()) {
    return NextResponse.json({ error: "Interview time must be in the future" }, { status: 400 });
  }

  const settings = await getOrCreateSettings();
  if (!settings.calendarToken) {
    return NextResponse.json(
      { error: "Calendar not connected", reAuthUrl: "/api/calendar/auth" },
      { status: 401 }
    );
  }

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { job: { select: { title: true, company: true } } },
  });
  if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });

  const title = `Interview: ${application.job.title} at ${application.job.company}`;
  const description = `Job interview for ${application.job.title} at ${application.job.company}`;

  try {
    const { googleEventId, htmlLink } = await createCalendarEvent(
      settings.calendarToken,
      title,
      description,
      scheduledAt
    );

    await prisma.calendarEvent.upsert({
      where: { applicationId_scheduledAt: { applicationId, scheduledAt } },
      create: { applicationId, googleEventId, htmlLink, scheduledAt },
      update: { googleEventId, htmlLink },
    });

    return NextResponse.json({ eventId: googleEventId, htmlLink });
  } catch (err: unknown) {
    const msg = (err as Error).message;
    if (msg === "TOKEN_EXPIRED") {
      await prisma.userSettings.update({
        where: { id: "singleton" },
        data: { calendarToken: null },
      });
      return NextResponse.json(
        { error: "Calendar token expired", reAuthUrl: "/api/calendar/auth" },
        { status: 401 }
      );
    }
    return NextResponse.json({ error: "Google Calendar API error" }, { status: 502 });
  }
}
