"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Search, Filter, Zap, Wifi } from "lucide-react";
import JobCard from "@/components/JobCard";
import { cn } from "@/lib/utils";

type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  platform: string;
  url: string;
  isQuickApply: boolean;
  isRemote: boolean;
  postedAt: string | null;
  matchScore: number | null;
  applications: { status: string }[];
  queueItems: { status: string }[];
};

const PLATFORMS = ["ALL", "LINKEDIN", "INDEED", "GLASSDOOR", "OTHER"];

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("ALL");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [quickApplyOnly, setQuickApplyOnly] = useState(false);

  const fetchJobs = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    const params = new URLSearchParams();
    if (refresh) params.set("refresh", "true");
    if (platform !== "ALL") params.set("platform", platform);
    if (remoteOnly) params.set("remote", "true");
    if (quickApplyOnly) params.set("quickApply", "true");

    const res = await fetch(`/api/jobs?${params}`);
    const data = await res.json();
    const sorted = (data.jobs ?? []).sort(
      (a: Job, b: Job) => (b.matchScore ?? -1) - (a.matchScore ?? -1)
    );
    setJobs(sorted);
    setLoading(false);
    setRefreshing(false);
  }, [platform, remoteOnly, quickApplyOnly]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const handleSave = async (jobId: string) => {
    await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, status: "SAVED" }),
    });
    await fetchJobs();
  };

  const handleQueue = async (jobId: string) => {
    await fetch("/api/auto-apply/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
    });
    await fetchJobs();
  };

  const filtered = jobs.filter((j) =>
    search
      ? j.title.toLowerCase().includes(search.toLowerCase()) ||
        j.company.toLowerCase().includes(search.toLowerCase())
      : true
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Job Feed</h1>
          <p className="text-slate-500 text-sm mt-1">
            {loading ? "Loading..." : `${filtered.length} jobs matching your profile`}
          </p>
        </div>
        <button
          onClick={() => fetchJobs(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
          {refreshing ? "Fetching..." : "Fetch New Jobs"}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search title or company..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-1">
            <Filter className="w-4 h-4 text-slate-400" />
            {PLATFORMS.map((p) => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                  platform === p ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            onClick={() => setRemoteOnly(!remoteOnly)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
              remoteOnly ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            <Wifi className="w-3.5 h-3.5" /> Remote
          </button>

          <button
            onClick={() => setQuickApplyOnly(!quickApplyOnly)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
              quickApplyOnly ? "bg-yellow-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            <Zap className="w-3.5 h-3.5" /> Quick Apply
          </button>
        </div>
      </div>

      {/* Job Grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-1/4 mb-3" />
              <div className="h-5 bg-slate-200 rounded w-3/4 mb-2" />
              <div className="h-4 bg-slate-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-slate-400 text-lg mb-3">No jobs found</p>
          <button
            onClick={() => fetchJobs(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            Fetch Jobs from APIs
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {filtered.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onSave={handleSave}
              onQueue={handleQueue}
            />
          ))}
        </div>
      )}
    </div>
  );
}
