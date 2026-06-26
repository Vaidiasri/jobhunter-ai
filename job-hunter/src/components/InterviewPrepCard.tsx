"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, RefreshCw, Loader2 } from "lucide-react";

interface Props {
  company: string;
  role: string;
}

export default function InterviewPrepCard({ company, role }: Props) {
  const [open, setOpen] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load(fresh = false) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ role });
      if (fresh) params.set("fresh", "1");
      const res = await fetch(`/api/interview-prep/${encodeURIComponent(company)}?${params}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setQuestions([]);
      } else {
        setQuestions(data.questions ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next && questions.length === 0 && !loading) load();
  }

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <div>
          <p className="text-sm font-medium text-slate-800">Interview Prep — {company}</p>
          <p className="text-xs text-slate-500">{role}</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">AI-generated, not verified</span>
            <button
              onClick={() => load(true)}
              disabled={loading}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
            >
              <RefreshCw className="w-3 h-3" /> Refresh questions
            </button>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : error ? (
            <p className="text-sm text-slate-500">{error}</p>
          ) : (
            <ol className="list-decimal list-inside space-y-2">
              {questions.map((q, i) => (
                <li key={i} className="text-sm text-slate-700 leading-snug">{q}</li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
