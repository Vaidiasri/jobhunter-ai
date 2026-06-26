"use client";

interface Reminder {
  id: string;
  type: string;
  status: string;
  dueAt: string;
}

interface Props {
  reminders: Reminder[];
}

export default function FollowUpBadge({ reminders }: Props) {
  const pending = reminders
    .filter((r) => r.status === "PENDING")
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

  if (pending.length === 0) return null;

  const next = pending[0];
  const dueAt = new Date(next.dueAt);
  const now = new Date();
  const diffMs = dueAt.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  let colorClass = "bg-green-100 text-green-700";
  let label: string;

  if (diffDays < 0) {
    colorClass = "bg-red-100 text-red-700";
    label = "Follow up overdue";
  } else if (diffDays <= 3) {
    colorClass = "bg-amber-100 text-amber-700";
    label = diffDays === 0 ? "Follow up today" : `Follow up in ${diffDays}d`;
  } else {
    label = `Follow up in ${diffDays}d`;
  }

  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colorClass}`}>
      {label}
    </span>
  );
}
