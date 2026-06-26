import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendFollowUpReminder } from "@/lib/resend";

export async function GET() {
  const dueReminders = await prisma.followUpReminder.findMany({
    where: { dueAt: { lte: new Date() }, status: "PENDING" },
    include: {
      application: {
        include: { job: true },
      },
    },
  });

  let sent = 0;
  let skipped = 0;

  for (const reminder of dueReminders) {
    const ok = await sendFollowUpReminder(
      reminder.application,
      reminder.application.job,
      reminder.type
    );
    if (ok) {
      await prisma.followUpReminder.update({
        where: { id: reminder.id },
        data: { status: "SENT", sentAt: new Date() },
      });
      sent++;
    } else {
      console.error(`Reminder ${reminder.id} send failed — will retry next run`);
      skipped++;
    }
  }

  return NextResponse.json({ sent, skipped });
}
