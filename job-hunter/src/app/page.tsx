import {
  Briefcase,
  Send,
  MessageSquare,
  Trophy,
  Zap,
  Clock,
  TrendingUp,
  RefreshCw,
} from "lucide-react";
import { PLATFORM_COLORS, STATUS_COLORS, timeAgo } from "@/lib/utils";
import { prisma } from "@/lib/prisma";

async function getStats() {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/dashboard/stats`,
      { cache: "no-store" }
    );
    return res.json();
  } catch {
    return null;
  }
}

async function getRecentActivity() {
  return prisma.application.findMany({
    take: 8,
    orderBy: { updatedAt: "desc" },
    include: { job: true },
  });
}

const STAT_CARDS = [
  { key: "totalApplied", label: "Total Applied", icon: Send, color: "text-blue-600", bg: "bg-blue-50" },
  { key: "interviews", label: "Interviews", icon: MessageSquare, color: "text-yellow-600", bg: "bg-yellow-50" },
  { key: "offers", label: "Offers", icon: Trophy, color: "text-green-600", bg: "bg-green-50" },
  { key: "autoApplied", label: "Auto-Applied", icon: Zap, color: "text-purple-600", bg: "bg-purple-50" },
  { key: "queuePending", label: "In Queue", icon: Clock, color: "text-orange-600", bg: "bg-orange-50" },
  { key: "responseRate", label: "Response Rate", icon: TrendingUp, color: "text-teal-600", bg: "bg-teal-50", suffix: "%" },
];

export default async function DashboardPage() {
  const [stats, activity] = await Promise.all([getStats(), getRecentActivity()]);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">
            Welcome back, Vaibhav — here&apos;s your job hunt overview
          </p>
        </div>
        <a
          href="/jobs?refresh=true"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh Jobs
        </a>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {STAT_CARDS.map(({ key, label, icon: Icon, color, bg, suffix = "" }) => (
          <div key={key} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-slate-500 font-medium">{label}</p>
              <div className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900">
              {stats ? `${stats[key] ?? 0}${suffix}` : "—"}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Platform Breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Briefcase className="w-4 h-4" /> Applications by Platform
          </h2>
          {stats?.platformBreakdown && Object.keys(stats.platformBreakdown).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(stats.platformBreakdown as Record<string, number>).map(([platform, count]) => (
                <div key={platform} className="flex items-center justify-between">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${PLATFORM_COLORS[platform]}`}>
                    {platform}
                  </span>
                  <div className="flex items-center gap-3 flex-1 ml-4">
                    <div className="flex-1 bg-slate-100 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${Math.min(100, (count / (stats.totalApplied || 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-slate-700 w-6 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-8">
              No applications yet — start applying!
            </p>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="font-semibold text-slate-800 mb-4">Recent Activity</h2>
          {activity.length > 0 ? (
            <div className="space-y-3">
              {activity.map((app) => (
                <div key={app.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{app.job.title}</p>
                    <p className="text-xs text-slate-500">{app.job.company}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[app.status]}`}>
                      {app.status}
                    </span>
                    <span className="text-xs text-slate-400">{timeAgo(app.updatedAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-8">
              No activity yet
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
