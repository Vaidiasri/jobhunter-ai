interface ApplicationWithJob {
  id: string;
  status: string;
  createdAt: Date | string;
  job: {
    platform: string;
    title: string;
  };
}

export interface AnalyticsSummary {
  byPlatform: { platform: string; count: number }[];
  byRole: { role: string; count: number; pct: number }[];
  responseRate: number;
  weeklyTrend: { week: string; count: number }[];
}

export function aggregateByPlatform(applications: ApplicationWithJob[]): { platform: string; count: number }[] {
  const map = new Map<string, number>();
  for (const a of applications) {
    map.set(a.job.platform, (map.get(a.job.platform) ?? 0) + 1);
  }
  return [...map.entries()].map(([platform, count]) => ({ platform, count })).sort((a, b) => b.count - a.count);
}

export function aggregateByRole(applications: ApplicationWithJob[]): { role: string; count: number; pct: number }[] {
  const map = new Map<string, number>();
  for (const a of applications) {
    const role = a.job.title.split(/\s+/)[0] ?? "Other";
    map.set(role, (map.get(role) ?? 0) + 1);
  }
  const total = applications.length || 1;
  return [...map.entries()]
    .map(([role, count]) => ({ role, count, pct: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count);
}

export function computeResponseRate(applications: ApplicationWithJob[]): number {
  const applied = applications.filter((a) => a.status === "APPLIED").length;
  const responded = applications.filter((a) =>
    ["INTERVIEW", "OFFER", "REJECTED"].includes(a.status)
  ).length;
  if (applied === 0 && responded === 0) return 0;
  return Math.round((responded / Math.max(applied + responded, 1)) * 100);
}

export function computeWeeklyTrend(
  applications: ApplicationWithJob[],
  weeks = 8
): { week: string; count: number }[] {
  const now = new Date();
  const result: { week: string; count: number }[] = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - (i + 1) * 7);
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() - i * 7);

    const count = applications.filter((a) => {
      const d = new Date(a.createdAt);
      return d >= weekStart && d < weekEnd;
    }).length;

    result.push({
      week: weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      count,
    });
  }

  return result;
}

export function buildSummary(applications: ApplicationWithJob[]): AnalyticsSummary {
  return {
    byPlatform: aggregateByPlatform(applications),
    byRole: aggregateByRole(applications),
    responseRate: computeResponseRate(applications),
    weeklyTrend: computeWeeklyTrend(applications),
  };
}
