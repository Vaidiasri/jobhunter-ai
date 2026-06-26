"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface Props {
  applicationId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CalendarModal({ applicationId, onClose, onSuccess }: Props) {
  const [datetime, setDatetime] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [reAuthUrl, setReAuthUrl] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/calendar/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, scheduledAt: datetime }),
      });
      const data = await res.json();
      if (res.status === 400) {
        setError("Please choose a future date/time");
      } else if (res.status === 401) {
        setReAuthUrl(data.reAuthUrl ?? "/api/calendar/auth");
      } else if (!res.ok) {
        setError("Failed to create calendar event. Try again.");
      } else {
        onSuccess();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-800">Add Interview to Calendar</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {reAuthUrl ? (
          <div className="text-sm text-slate-600">
            <p className="mb-3">Calendar connection expired.</p>
            <a
              href={reAuthUrl}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-block"
            >
              Reconnect Calendar
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-slate-600 block mb-1">Interview Date & Time</label>
              <input
                type="datetime-local"
                value={datetime}
                onChange={(e) => setDatetime(e.target.value)}
                required
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={onClose} className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !datetime}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Adding…" : "Add to Calendar"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
