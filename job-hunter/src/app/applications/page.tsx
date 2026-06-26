"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Trash2, ChevronRight } from "lucide-react";
import { cn, PLATFORM_COLORS, STATUS_COLORS, timeAgo } from "@/lib/utils";
import FollowUpBadge from "@/components/FollowUpBadge";
import InterviewPrepCard from "@/components/InterviewPrepCard";
import CalendarModal from "@/components/CalendarModal";

type CalendarEvent = {
  id: string;
  htmlLink: string;
  scheduledAt: string;
};

type Reminder = {
  id: string;
  type: string;
  status: string;
  dueAt: string;
};

type Application = {
  id: string;
  status: string;
  appliedAt: string | null;
  notes: string | null;
  updatedAt: string;
  followUpReminders: Reminder[];
  calendarEvents: CalendarEvent[];
  job: {
    id: string;
    title: string;
    company: string;
    location: string;
    platform: string;
    url: string;
    isRemote: boolean;
  };
};

const COLUMNS: { key: string; label: string; color: string }[] = [
  { key: "SAVED", label: "Saved", color: "bg-slate-100 border-slate-300" },
  { key: "APPLIED", label: "Applied", color: "bg-blue-50 border-blue-300" },
  { key: "INTERVIEW", label: "Interview", color: "bg-yellow-50 border-yellow-300" },
  { key: "OFFER", label: "Offer", color: "bg-green-50 border-green-300" },
  { key: "REJECTED", label: "Rejected", color: "bg-red-50 border-red-300" },
];

const NEXT_STATUS: Record<string, string> = {
  SAVED: "APPLIED",
  APPLIED: "INTERVIEW",
  INTERVIEW: "OFFER",
};

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [calendarModalAppId, setCalendarModalAppId] = useState<string | null>(null);

  const fetchApplications = async () => {
    const res = await fetch("/api/applications");
    const data = await res.json();
    setApplications(data.applications ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchApplications(); }, []);

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await fetchApplications();
  };

  const deleteApplication = async (id: string) => {
    await fetch(`/api/applications/${id}`, { method: "DELETE" });
    await fetchApplications();
  };

  const byStatus = (status: string) =>
    applications.filter((a) => a.status === status);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Application Tracker</h1>
        <p className="text-slate-500 text-sm mt-1">
          {applications.length} total applications · drag or advance to update status
        </p>
      </div>

      {loading ? (
        <div className="flex gap-4">
          {COLUMNS.map((col) => (
            <div key={col.key} className="flex-1 bg-slate-100 rounded-xl h-96 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((col) => {
            const items = byStatus(col.key);
            return (
              <div key={col.key} className="flex-shrink-0 w-64">
                <div className={cn("rounded-xl border-2 p-3", col.color)}>
                  <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className="font-semibold text-slate-700 text-sm">{col.label}</h3>
                    <span className={cn(
                      "text-xs font-bold px-2 py-0.5 rounded-full",
                      STATUS_COLORS[col.key]
                    )}>
                      {items.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {items.map((app) => (
                      <div
                        key={app.id}
                        className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm group"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-800 leading-snug line-clamp-2">
                              {app.job.title}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">{app.job.company}</p>
                          </div>
                          <a
                            href={app.job.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-shrink-0 text-slate-400 hover:text-blue-600 mt-0.5"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>

                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          <span className={cn(
                            "text-xs px-1.5 py-0.5 rounded-full font-medium",
                            PLATFORM_COLORS[app.job.platform]
                          )}>
                            {app.job.platform}
                          </span>
                          {app.job.isRemote && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700">
                              Remote
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          <FollowUpBadge reminders={app.followUpReminders} />
                          <p className="text-xs text-slate-400">{timeAgo(app.updatedAt)}</p>
                        </div>

                        {(app.status === "INTERVIEW" || app.status === "OFFER") && (
                          <div className="mt-2 space-y-2">
                            <InterviewPrepCard company={app.job.company} role={app.job.title} />
                            {app.calendarEvents.length > 0 ? (
                              <div className="text-xs text-green-700 bg-green-50 rounded px-2 py-1">
                                ✓ Added to Google Calendar —{" "}
                                <a href={app.calendarEvents[0].htmlLink} target="_blank" rel="noopener noreferrer" className="underline">
                                  View event
                                </a>
                              </div>
                            ) : (
                              <button
                                onClick={() => setCalendarModalAppId(app.id)}
                                className="text-xs px-3 py-1 border border-slate-300 rounded-lg hover:bg-slate-50"
                              >
                                + Add to Calendar
                              </button>
                            )}
                          </div>
                        )}

                        <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {NEXT_STATUS[app.status] && (
                            <button
                              onClick={() => updateStatus(app.id, NEXT_STATUS[app.status])}
                              title={`Move to ${NEXT_STATUS[app.status]}`}
                              className="flex-1 flex items-center justify-center gap-1 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
                            >
                              <ChevronRight className="w-3 h-3" />
                              {NEXT_STATUS[app.status]}
                            </button>
                          )}
                          {app.status !== "REJECTED" && (
                            <button
                              onClick={() => updateStatus(app.id, "REJECTED")}
                              title="Mark Rejected"
                              className="py-1 px-2 text-xs bg-red-50 text-red-500 rounded hover:bg-red-100 transition-colors"
                            >
                              ✕
                            </button>
                          )}
                          <button
                            onClick={() => deleteApplication(app.id)}
                            title="Delete"
                            className="py-1 px-2 text-xs bg-slate-50 text-slate-400 rounded hover:bg-slate-100 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {items.length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-6">Empty</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {calendarModalAppId && (
        <CalendarModal
          applicationId={calendarModalAppId}
          onClose={() => setCalendarModalAppId(null)}
          onSuccess={() => { setCalendarModalAppId(null); fetchApplications(); }}
        />
      )}
    </div>
  );
}
