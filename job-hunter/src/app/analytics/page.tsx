"use client";

import { useEffect, useState } from "react";
import type { AnalyticsSummary } from "@/lib/analytics";

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/analytics/summary");
      if (!res.ok) throw new Error("Failed");
      setData(await res.json());
    } catch {
      setError("Could not load analytics");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="p-8 max-w-4xl space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse h-32" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <p className="text-red-600 mb-3">{error}</p>
        <button onClick={load} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const maxPlatformCount = Math.max(...data.byPlatform.map((p) => p.count), 1);
  const maxTrend = Math.max(...data.weeklyTrend.map((w) => w.count), 1);

  return (
    <div className="p-8 max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>

      {/* Response Rate */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Response Rate</h2>
        <p className="text-5xl font-bold text-slate-900">{data.responseRate}%</p>
        <p className="text-sm text-slate-500 mt-1">of applications received a reply</p>
      </section>

      {/* Platform Breakdown */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Applications by Platform</h2>
        {data.byPlatform.length === 0 ? (
          <p className="text-slate-400 text-sm">No data yet</p>
        ) : (
          <div className="space-y-3">
            {data.byPlatform.map(({ platform, count }) => (
              <div key={platform} className="flex items-center gap-3">
                <span className="text-sm text-slate-600 w-24 flex-shrink-0">{platform}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-3">
                  <div
                    className="bg-blue-500 h-3 rounded-full"
                    style={{ width: `${(count / maxPlatformCount) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-slate-700 w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Weekly Trend (sparkline) */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Weekly Applications (last 8 weeks)</h2>
        <div className="flex items-end gap-2 h-24">
          {data.weeklyTrend.map(({ week, count }) => (
            <div key={week} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs text-slate-400">{count > 0 ? count : ""}</span>
              <div
                className="w-full bg-blue-500 rounded-t"
                style={{ height: `${Math.max(4, (count / maxTrend) * 80)}px` }}
              />
              <span className="text-xs text-slate-400 truncate w-full text-center">{week}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Role Breakdown */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Top Roles Applied</h2>
        {data.byRole.length === 0 ? (
          <p className="text-slate-400 text-sm">No data yet</p>
        ) : (
          <div className="space-y-2">
            {data.byRole.slice(0, 10).map(({ role, count, pct }) => (
              <div key={role} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">{role}</span>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400">{count} apps</span>
                  <span className="font-medium text-slate-600 w-10 text-right">{pct}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
