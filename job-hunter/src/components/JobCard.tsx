"use client";

import { useState } from "react";
import { MapPin, Clock, Zap, ExternalLink, Bookmark, BookmarkCheck, Sparkles, BarChart2, FileText, Send } from "lucide-react";
import { cn, formatSalary, timeAgo, PLATFORM_COLORS } from "@/lib/utils";
import AiDrawer from "./AiDrawer";
import AtsScoreCard from "./AtsScoreCard";
import TailoredResumeModal from "./TailoredResumeModal";

interface JobCardProps {
  job: {
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
  onSave: (jobId: string) => Promise<void>;
  onQueue: (jobId: string) => Promise<void>;
}

function MatchScoreBadge({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">N/A</span>;
  }
  const color =
    score >= 70
      ? "bg-green-100 text-green-700"
      : score >= 40
      ? "bg-amber-100 text-amber-700"
      : "bg-slate-100 text-slate-500";
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>{score}% match</span>;
}

export default function JobCard({ job, onSave, onQueue }: JobCardProps) {
  const [loading, setLoading] = useState<"save" | "queue" | null>(null);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [tailorOpen, setTailorOpen] = useState(false);
  const [atsOpen, setAtsOpen] = useState(false);
  const [atsResult, setAtsResult] = useState<{ score: number | null; nonEnglish?: boolean; matched: string[]; missing: string[] } | null>(null);
  const [atsLoading, setAtsLoading] = useState(false);

  const isSaved = job.applications.length > 0;
  const isQueued = job.queueItems[0]?.status === "PENDING" || job.queueItems[0]?.status === "RUNNING";
  const isApplied = job.queueItems[0]?.status === "COMPLETED" || job.applications[0]?.status === "APPLIED";

  const handleSave = async () => {
    if (isSaved || loading) return;
    setLoading("save");
    await onSave(job.id);
    setLoading(null);
  };

  const handleQueue = async () => {
    if (isQueued || isApplied || loading) return;
    setLoading("queue");
    await onQueue(job.id);
    setLoading(null);
  };

  const handleAtsClick = async () => {
    setAtsOpen(true);
    if (!atsResult) {
      setAtsLoading(true);
      try {
        const res = await fetch("/api/ai/ats-score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: job.id }),
        });
        const data = await res.json();
        setAtsResult(data);
      } finally {
        setAtsLoading(false);
      }
    }
  };

  return (
    <>
      <div className={cn(
        "bg-white border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow",
        isApplied ? "border-green-200 bg-green-50/30" : "border-slate-200"
      )}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PLATFORM_COLORS[job.platform]}`}>
                {job.platform}
              </span>
              {job.isRemote && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">Remote</span>
              )}
              {job.isQuickApply && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 flex items-center gap-1">
                  <Zap className="w-3 h-3" /> Quick Apply
                </span>
              )}
              {isApplied && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">✓ Applied</span>
              )}
              <MatchScoreBadge score={job.matchScore} />
            </div>
            <h3 className="font-semibold text-slate-900 text-base leading-snug">{job.title}</h3>
            <p className="text-sm text-slate-600 mt-0.5">{job.company}</p>
          </div>

          <div className="flex gap-1.5 flex-shrink-0">
            <button
              onClick={handleSave}
              disabled={isSaved || loading === "save"}
              title={isSaved ? "Saved" : "Save job"}
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                isSaved ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              )}
            >
              {isSaved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
            </button>
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" /> {job.location || "India"}
          </span>
          {job.postedAt && (
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> {timeAgo(job.postedAt)}
            </span>
          )}
          <span className="font-medium text-slate-700">
            {formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency ?? "INR")}
          </span>
        </div>

        <div className="flex gap-2 mt-3 flex-wrap">
          <button
            onClick={() => setAiDrawerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100"
          >
            <Sparkles className="w-3.5 h-3.5" /> Cover Letter
          </button>
          <button
            onClick={handleAtsClick}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100"
          >
            <BarChart2 className="w-3.5 h-3.5" /> ATS Score
          </button>
          <button
            onClick={() => setTailorOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100"
          >
            <FileText className="w-3.5 h-3.5" /> Tailor Resume
          </button>
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Send className="w-3.5 h-3.5" /> Apply Now
          </a>
        </div>

        {atsOpen && (
          <div className="mt-3 border border-slate-200 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b">
              <span className="text-xs font-medium text-slate-600">ATS Analysis</span>
              <button onClick={() => setAtsOpen(false)} className="text-xs text-slate-400 hover:text-slate-600">✕</button>
            </div>
            {atsLoading ? (
              <div className="p-4 text-xs text-slate-400">Analyzing…</div>
            ) : atsResult ? (
              <AtsScoreCard result={atsResult} />
            ) : null}
          </div>
        )}

        {job.isQuickApply && !isApplied && (
          <button
            onClick={handleQueue}
            disabled={isQueued || loading === "queue"}
            className={cn(
              "mt-4 w-full py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2",
              isQueued
                ? "bg-yellow-100 text-yellow-700 cursor-default"
                : "bg-blue-600 text-white hover:bg-blue-700"
            )}
          >
            <Zap className="w-4 h-4" />
            {loading === "queue" ? "Adding to queue..." : isQueued ? "In auto-apply queue" : "Auto-Apply"}
          </button>
        )}
      </div>

      {aiDrawerOpen && <AiDrawer jobId={job.id} onClose={() => setAiDrawerOpen(false)} />}
      {tailorOpen && (
        <TailoredResumeModal
          jobId={job.id}
          jobTitle={job.title}
          company={job.company}
          isQuickApply={job.isQuickApply}
          onClose={() => setTailorOpen(false)}
          onQueue={async () => { await onQueue(job.id); setTailorOpen(false); }}
        />
      )}
    </>
  );
}
