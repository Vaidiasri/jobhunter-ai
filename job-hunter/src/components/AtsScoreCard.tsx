"use client";

interface AtsResult {
  score: number | null;
  nonEnglish?: boolean;
  matched: string[];
  missing: string[];
}

interface Props {
  result: AtsResult;
  compact?: boolean;
}

function scoreColor(score: number | null): string {
  if (score === null) return "#94a3b8";
  if (score >= 70) return "#22c55e";
  if (score >= 40) return "#f59e0b";
  return "#ef4444";
}

function ScoreRing({ score }: { score: number | null }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const pct = score !== null ? score / 100 : 0;
  const dash = circ * pct;
  const color = scoreColor(score);

  return (
    <svg width="96" height="96" viewBox="0 0 96 96">
      <circle cx="48" cy="48" r={r} fill="none" stroke="#e2e8f0" strokeWidth="8" />
      <circle
        cx="48"
        cy="48"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 48 48)"
      />
      <text x="48" y="53" textAnchor="middle" fontSize="18" fontWeight="700" fill={color}>
        {score !== null ? score : "N/A"}
      </text>
    </svg>
  );
}

export default function AtsScoreCard({ result, compact = false }: Props) {
  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <ScoreRing score={result.score} />
        {result.nonEnglish && (
          <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">Non-English JD</span>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-4">
        <ScoreRing score={result.score} />
        <div>
          <p className="text-sm font-medium text-slate-700">ATS Score</p>
          {result.nonEnglish && (
            <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">Non-English JD</span>
          )}
          {result.score === null && !result.nonEnglish && (
            <span className="text-xs text-slate-400">N/A</span>
          )}
        </div>
      </div>

      {result.matched.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-1.5 font-medium">Matched keywords</p>
          <div className="flex flex-wrap gap-1.5">
            {result.matched.map((kw) => (
              <span key={kw} className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {result.missing.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-1.5 font-medium">Missing keywords</p>
          <div className="flex flex-wrap gap-1.5">
            {result.missing.slice(0, 20).map((kw) => (
              <span key={kw} className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
