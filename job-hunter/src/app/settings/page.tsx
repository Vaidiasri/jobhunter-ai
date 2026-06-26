"use client";

import { useEffect, useRef, useState } from "react";
import { User, Key, Zap, Clock, CheckCircle, AlertCircle, FileText, Calendar, Linkedin } from "lucide-react";

const PROFILE = {
  name: "Vaibhav Ghildiyal",
  email: "vaibhavghildiyal2101@gmail.com",
  phone: "+91-9368209983",
  location: "Noida, India",
  minSalary: "6 LPA",
  roles: ["Full Stack Developer", "Frontend Developer", "Backend Developer", "AI Engineer"],
  skills: ["React.js", "Next.js", "Node.js", "TypeScript", "PostgreSQL", "MongoDB", "FastAPI", "Docker", "AWS"],
};

export default function SettingsPage() {
  const [linkedinEmail, setLinkedinEmail] = useState("");
  const [linkedinPass, setLinkedinPass] = useState("");
  const [naukriEmail, setNaukriEmail] = useState("");
  const [naukriPass, setNaukriPass] = useState("");
  const [autoApplySchedule, setAutoApplySchedule] = useState("every6h");

  const [resumeText, setResumeText] = useState("");
  const [resumeSaved, setResumeSaved] = useState(false);
  const [resumeSaving, setResumeSaving] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);

  const [lastScrapedAt, setLastScrapedAt] = useState<string | null>(null);
  const [scrapeLoading, setScrapeLoading] = useState(false);

  const [calendarConnected, setCalendarConnected] = useState(false);

  const [credSaved, setCredSaved] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setResumeText(data.resumeText ?? "");
        setLastScrapedAt(data.lastScrapedAt ?? null);
      });

    const params = new URLSearchParams(window.location.search);
    if (params.get("calendar") === "connected") setCalendarConnected(true);
  }, []);

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfError("");
    setPdfLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/settings/resume-upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setPdfError(data.error ?? "Upload failed");
      } else {
        setResumeText(data.text);
      }
    } finally {
      setPdfLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSaveResume() {
    setResumeSaving(true);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeText }),
    });
    setResumeSaving(false);
    setResumeSaved(true);
    setTimeout(() => setResumeSaved(false), 3000);
  }

  async function handleSaveCreds() {
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoApplySchedule }),
    });
    setCredSaved(true);
    setTimeout(() => setCredSaved(false), 3000);
  }

  async function handleScrape() {
    setScrapeLoading(true);
    try {
      const res = await fetch("/api/linkedin/scrape", { method: "POST" });
      const data = await res.json();
      if (data.alreadyPending) {
        alert("Scrape already queued — worker will process it shortly.");
      }
    } finally {
      setScrapeLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">Configure your profile, resume, and integrations</p>
      </div>

      {/* Profile Card */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm mb-6">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
          <User className="w-4 h-4" /> Your Profile
        </h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {Object.entries({
            Name: PROFILE.name,
            Email: PROFILE.email,
            Phone: PROFILE.phone,
            Location: PROFILE.location,
            "Min Salary": PROFILE.minSalary,
          }).map(([label, value]) => (
            <div key={label}>
              <p className="text-xs text-slate-500 mb-0.5">{label}</p>
              <p className="font-medium text-slate-800">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <p className="text-xs text-slate-500 mb-2">Target Roles</p>
          <div className="flex flex-wrap gap-2">
            {PROFILE.roles.map((r) => (
              <span key={r} className="text-xs px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">{r}</span>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <p className="text-xs text-slate-500 mb-2">Tech Stack</p>
          <div className="flex flex-wrap gap-2">
            {PROFILE.skills.map((s) => (
              <span key={s} className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full">{s}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Resume */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm mb-6">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
          <FileText className="w-4 h-4" /> Resume
        </h2>
        <div className="mb-3 flex items-center gap-3">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={pdfLoading}
            className="text-sm px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            {pdfLoading ? "Extracting…" : "Upload PDF"}
          </button>
          <span className="text-xs text-slate-400">or paste text directly below</span>
          <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handlePdfUpload} />
        </div>
        {pdfError && <p className="text-xs text-red-600 mb-2">{pdfError}</p>}
        <textarea
          value={resumeText}
          onChange={(e) => setResumeText(e.target.value)}
          rows={10}
          placeholder="Paste your resume text here…"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleSaveResume}
          disabled={resumeSaving}
          className="mt-3 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {resumeSaved ? <><CheckCircle className="w-4 h-4" /> Saved!</> : resumeSaving ? "Saving…" : "Save Resume"}
        </button>
      </section>

      {/* Integrations */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm mb-6">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4" /> Integrations
        </h2>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-800">Google Calendar</p>
              <p className="text-xs text-slate-500">Add interview slots directly to your calendar</p>
            </div>
            {calendarConnected ? (
              <span className="text-xs px-2.5 py-1 bg-green-100 text-green-700 rounded-full font-medium flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Connected
              </span>
            ) : (
              <a
                href="/api/calendar/auth"
                className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Connect
              </a>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-800">LinkedIn Connections Scrape</p>
              <p className="text-xs text-slate-500">
                {lastScrapedAt
                  ? `Last scraped: ${new Date(lastScrapedAt).toLocaleDateString()}`
                  : "Never scraped"}
              </p>
            </div>
            <button
              onClick={handleScrape}
              disabled={scrapeLoading}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
            >
              <Linkedin className="w-3.5 h-3.5" />
              {scrapeLoading ? "Queuing…" : "Trigger Scrape"}
            </button>
          </div>
        </div>
      </section>

      {/* Credentials */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm mb-6">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2 mb-1">
          <Key className="w-4 h-4" /> Auto-Apply Credentials
        </h2>
        <p className="text-xs text-slate-500 mb-5 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5 text-yellow-500" />
          Stored in your Railway environment variables — never sent to third parties
        </p>
        <div className="space-y-5">
          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-3">LinkedIn</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Email</label>
                <input type="email" value={linkedinEmail} onChange={(e) => setLinkedinEmail(e.target.value)} placeholder="your@email.com" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Password</label>
                <input type="password" value={linkedinPass} onChange={(e) => setLinkedinPass(e.target.value)} placeholder="••••••••" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-3">Naukri</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Email</label>
                <input type="email" value={naukriEmail} onChange={(e) => setNaukriEmail(e.target.value)} placeholder="your@email.com" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Password</label>
                <input type="password" value={naukriPass} onChange={(e) => setNaukriPass(e.target.value)} placeholder="••••••••" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Auto-Apply Schedule */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm mb-6">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4" /> Auto-Apply Settings
        </h2>
        <div>
          <label className="text-xs text-slate-500 block mb-2">Worker Schedule</label>
          <div className="flex gap-2 flex-wrap">
            {[
              { value: "every1h", label: "Every 1 hour" },
              { value: "every6h", label: "Every 6 hours" },
              { value: "every12h", label: "Every 12 hours" },
              { value: "daily", label: "Once daily" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setAutoApplySchedule(opt.value)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors ${
                  autoApplySchedule === opt.value
                    ? "bg-blue-600 text-white border-blue-600"
                    : "border-slate-200 text-slate-600 hover:border-blue-300"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <button
        onClick={handleSaveCreds}
        className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
      >
        {credSaved ? <><CheckCircle className="w-4 h-4" /> Saved!</> : "Save Settings"}
      </button>
    </div>
  );
}
