"use client";

import { useState, useEffect } from "react";
import { X, Copy, Download, Zap, CheckCheck, FileText } from "lucide-react";

interface Props {
  jobId: string;
  jobTitle: string;
  company: string;
  isQuickApply: boolean;
  onClose: () => void;
  onQueue: () => Promise<void>;
}

export default function TailoredResumeModal({ jobId, jobTitle, company, isQuickApply, onClose, onQueue }: Props) {
  const [resume, setResume] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [queuing, setQueuing] = useState(false);
  const [queued, setQueued] = useState(false);

  useEffect(() => {
    async function generate() {
      try {
        const res = await fetch("/api/ai/tailor-resume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId }),
        });
        const data = await res.json();
        if (res.status === 422) {
          setError("Upload your resume in Settings first.");
        } else if (!res.ok) {
          setError(data.error ?? "AI service unavailable. Try again later.");
        } else {
          setResume(data.tailoredResume);
        }
      } catch {
        setError("Failed to connect to AI service.");
      } finally {
        setLoading(false);
      }
    }
    generate();
  }, [jobId]);

  const handleCopy = async () => {
    if (!resume) return;
    await navigator.clipboard.writeText(resume);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPdf = () => {
    if (!resume) return;

    const lines = resume.split("\n");
    const name = lines[0]?.trim() || "Resume";

    // Convert plain-text resume into styled HTML sections
    const htmlLines = lines.map((line, i) => {
      const trimmed = line.trim();
      if (i === 0 && trimmed) {
        return `<h1>${trimmed}</h1>`;
      }
      if (i === 1 && trimmed) {
        return `<p class="contact">${trimmed}</p>`;
      }
      // Section headers: all-caps or ends with colon, short line
      if (trimmed && trimmed.length < 40 && (trimmed === trimmed.toUpperCase() || trimmed.endsWith(":"))) {
        return `<h2>${trimmed.replace(/:$/, "")}</h2>`;
      }
      if (trimmed.startsWith("•") || trimmed.startsWith("-") || trimmed.startsWith("*")) {
        return `<li>${trimmed.replace(/^[•\-*]\s*/, "")}</li>`;
      }
      if (trimmed === "") return `</ul><div class="spacer"></div><ul>`;
      return `<p>${trimmed}</p>`;
    });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${name}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Georgia', serif; font-size: 11pt; color: #111; background: #fff; padding: 28mm 22mm; line-height: 1.55; }
  h1 { font-size: 22pt; font-weight: 700; color: #1a1a2e; letter-spacing: 0.5px; margin-bottom: 2px; }
  .contact { font-size: 9.5pt; color: #555; margin-bottom: 14px; }
  h2 { font-size: 11pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; color: #1a1a2e; border-bottom: 1.5px solid #1a1a2e; padding-bottom: 2px; margin: 14px 0 6px; }
  p { margin-bottom: 4px; font-size: 10.5pt; }
  li { margin-left: 16px; margin-bottom: 3px; font-size: 10.5pt; list-style: disc; }
  ul { margin: 0; padding: 0; list-style: none; }
  .spacer { margin: 3px 0; }
  @media print {
    body { padding: 14mm 16mm; }
    @page { margin: 0; size: A4; }
  }
</style>
</head>
<body>
<ul>${htmlLines.join("\n")}</ul>
</body>
</html>`;

    const win = window.open("", "_blank", "width=850,height=1100");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
    }, 400);
  };

  const handleQueueApply = async () => {
    setQueuing(true);
    await onQueue();
    setQueued(true);
    setQueuing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-600" />
              AI-Tailored Resume
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">{jobTitle} · {company}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
              <p className="text-sm text-slate-500">AI is adding missing keywords to your resume…</p>
            </div>
          )}
          {error && (
            <div className="text-center py-16">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}
          {resume && (
            <pre className="text-sm text-slate-800 whitespace-pre-wrap font-mono bg-slate-50 rounded-xl p-5 leading-relaxed border border-slate-100">
              {resume}
            </pre>
          )}
        </div>

        {resume && (
          <div className="flex items-center gap-2 px-6 py-4 border-t border-slate-200">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
            >
              {copied ? <CheckCheck className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              onClick={handleDownloadPdf}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="w-4 h-4" /> Download PDF
            </button>
            {isQuickApply && (
              <button
                onClick={handleQueueApply}
                disabled={queuing || queued}
                className="ml-auto flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                <Zap className="w-4 h-4" />
                {queued ? "Queued for Apply!" : queuing ? "Queuing…" : "Auto-Apply Now"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
