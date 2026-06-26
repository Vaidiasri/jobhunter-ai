import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface Application {
  id: string;
  appliedAt: Date | null;
}

interface Job {
  title: string;
  company: string;
  url: string;
}

interface Reminder {
  id: string;
  type: string;
  dueAt: Date;
}

export async function sendFollowUpReminder(
  application: Application,
  job: Job,
  reminderType: string
): Promise<boolean> {
  try {
    const daysSince = application.appliedAt
      ? Math.floor((Date.now() - application.appliedAt.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const typeLabel =
      reminderType === "INITIAL"
        ? "Initial follow-up"
        : reminderType === "FOLLOWUP_2"
        ? "Second follow-up"
        : "Final follow-up";

    await resend.emails.send({
      from: "onboarding@resend.dev",
      to: process.env.DIGEST_EMAIL ?? "",
      subject: `JobHunter: Follow up on ${job.title} at ${job.company}`,
      html: `
        <h2>${typeLabel}</h2>
        <p><strong>${job.title}</strong> at <strong>${job.company}</strong></p>
        <p><a href="${job.url}">View Job</a></p>
        ${daysSince !== null ? `<p>Applied ${daysSince} day(s) ago.</p>` : ""}
      `,
    });
    return true;
  } catch (err) {
    console.error("sendFollowUpReminder failed:", err);
    return false;
  }
}

interface DigestJob {
  id: string;
  title: string;
  company: string;
  url: string;
  matchScore: number | null;
}

interface DigestReminder extends Reminder {
  application: { job: Job };
}

export async function sendDigest(
  jobs: DigestJob[],
  dueReminders: DigestReminder[],
  toEmail: string | null
): Promise<boolean> {
  if (!toEmail) return false;
  try {
    const jobRows =
      jobs.length > 0
        ? jobs
            .map(
              (j) =>
                `<tr><td><a href="${j.url}">${j.title}</a></td><td>${j.company}</td><td>${j.matchScore ?? "N/A"}</td></tr>`
            )
            .join("")
        : `<tr><td colspan="3">No new jobs matched today</td></tr>`;

    const reminderRows =
      dueReminders.length > 0
        ? dueReminders
            .map(
              (r) =>
                `<li>${r.application.job.title} at ${r.application.job.company} — ${r.type.replace("_", " ")}</li>`
            )
            .join("")
        : "<li>No follow-ups due today</li>";

    await resend.emails.send({
      from: "onboarding@resend.dev",
      to: toEmail,
      subject: `JobHunter Daily Digest — ${new Date().toLocaleDateString()}`,
      html: `
        <h2>New Matches</h2>
        <table border="1" cellpadding="6">
          <thead><tr><th>Title</th><th>Company</th><th>Match %</th></tr></thead>
          <tbody>${jobRows}</tbody>
        </table>
        <h2>Follow-up Today</h2>
        <ul>${reminderRows}</ul>
      `,
    });
    return true;
  } catch (err) {
    console.error("sendDigest failed:", err);
    return false;
  }
}
