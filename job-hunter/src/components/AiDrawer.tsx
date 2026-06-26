"use client";

import { useState } from "react";
import { X, Copy, Check, RefreshCw, Loader2 } from "lucide-react";

type Tab = "coverLetter" | "tailoredResume" | "outreachEmail";

const TAB_LABELS: Record<Tab, string> = {
  coverLetter: "Cover Letter",
  tailoredResume: "Tailored Resume",
  outreachEmail: "Outreach Email",
};

const TAB_ENDPOINTS: Record<Tab, string> = {
  coverLetter: "/api/ai/cover-letter",
  tailoredResume: "/api/ai/tailor-resume",
  outreachEmail: "/api/ai/outreach-email",
};

const TAB_FIELD: Record<Tab, string> = {
  coverLetter: "coverLetter",
  tailoredResume: "tailoredResume",
  outreachEmail: "outreachEmail",
};

interface Props {
  jobId: string;
  onClose: () => void;
}

export default function AiDrawer({ jobId, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("coverLetter");
  const [content, setContent] = useState<Partial<Record<Tab, string>>>({});
  const [loading, setLoading] = useState<Partial<Record<Tab, boolean>>>({});
  const [error, setError] = useState<Partial<Record<Tab, string>>>({});
  const [copied, setCopied] = useState(false);

  async function generate(tab: Tab, force = false) {
    setLoading((p) => ({ ...p, [tab]: true }));
    setError((p) => ({ ...p, [tab]: "" }));
    try {
      const res = await fetch(TAB_ENDPOINTS[tab], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, force }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 422) {
          setError((p) => ({ ...p, [tab]: "RESUME_MISSING" }));
        } else {
          setError((p) => ({ ...p, [tab]: "AI is busy, try in 1 minute." }));
        }
      } else {
        setContent((p) => ({ ...p, [tab]: data[TAB_FIELD[tab]] }));
      }
    } finally {
      setLoading((p) => ({ ...p, [tab]: false }));
    }
  }

  function handleTabClick(tab: Tab) {
    setActiveTab(tab);
    if (!content[tab] && !loading[tab]) generate(tab);
  }

  async function handleCopy() {
    const text = content[activeTab];
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const tabContent = content[activeTab];
  const tabLoading = loading[activeTab];
  const tabError = error[activeTab];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-slate-800">AI Tools</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b">
          {(Object.keys(TAB_LABELS) as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabClick(tab)}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                activeTab === tab
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto p-5">
          {tabLoading && (
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating…
            </div>
          )}
          {!tabLoading && tabError === "RESUME_MISSING" && (
            <div className="text-sm text-amber-700 bg-amber-50 rounded-lg p-4">
              Add your resume in{" "}
              <a href="/settings" className="underline font-medium">Settings</a>{" "}
              first.
            </div>
          )}
          {!tabLoading && tabError && tabError !== "RESUME_MISSING" && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg p-4 flex items-center justify-between">
              <span>{tabError}</span>
              <button
                onClick={() => generate(activeTab)}
                className="text-xs underline ml-2"
              >
                Retry
              </button>
            </div>
          )}
          {!tabLoading && !tabError && tabContent && (
            <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
              {tabContent}
            </pre>
          )}
          {!tabLoading && !tabError && !tabContent && (
            <button
              onClick={() => generate(activeTab)}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
            >
              Generate
            </button>
          )}
        </div>

        {tabContent && !tabLoading && (
          <div className="flex gap-2 px-5 py-3 border-t">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              onClick={() => generate(activeTab, true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Regenerate
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
