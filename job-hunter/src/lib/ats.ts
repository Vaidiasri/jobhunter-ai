const STOP_WORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with","by",
  "from","as","is","was","are","were","be","been","being","have","has","had",
  "do","does","did","will","would","could","should","may","might","shall","can",
  "not","no","nor","so","yet","both","either","neither","each","few","more",
  "most","other","some","such","than","then","that","this","these","those",
  "its","it","we","you","he","she","they","their","our","your","my","his","her",
]);

const TECH_STACK = new Set([
  "react","node","typescript","javascript","python","java","go","rust","docker",
  "kubernetes","aws","gcp","azure","postgres","postgresql","mysql","mongodb","redis",
  "graphql","rest","api","nextjs","express","fastapi","django","spring","git",
]);

export function extractKeywords(text: string): Set<string> {
  const words = text.toLowerCase().split(/\W+/);
  const result = new Set<string>();
  for (const w of words) {
    if (w.length >= 3 && !STOP_WORDS.has(w)) result.add(w);
  }
  return result;
}

export function detectNonEnglish(text: string): boolean {
  const words = text.toLowerCase().split(/\W+/).filter((w) => w.length >= 2);
  if (words.length === 0) return false;
  const stopCount = words.filter((w) => STOP_WORDS.has(w)).length;
  return stopCount / words.length < 0.1;
}

export interface AtsResult {
  score: number | null;
  nonEnglish?: boolean;
  matched: string[];
  missing: string[];
}

export function computeAtsScore(jdText: string, resumeText: string): AtsResult | null {
  if (!jdText?.trim()) return null;

  if (detectNonEnglish(jdText)) {
    return { score: null, nonEnglish: true, matched: [], missing: [] };
  }

  const jdWords = extractKeywords(jdText);
  const resumeWords = extractKeywords(resumeText ?? "");

  const matched: string[] = [];
  const missing: string[] = [];
  for (const w of jdWords) {
    if (resumeWords.has(w)) matched.push(w);
    else missing.push(w);
  }

  const baseScore = Math.min(70, Math.round((matched.length / Math.max(jdWords.size, 1)) * 100));

  let bonus = 0;

  const jdLower = jdText.toLowerCase();
  const resumeLower = (resumeText ?? "").toLowerCase();
  const titleWords = jdLower.split(/\W+/).slice(0, 5);
  if (titleWords.some((w) => w.length > 3 && resumeLower.includes(w))) bonus += 15;

  const techMatches = [...TECH_STACK].filter((t) => jdLower.includes(t) && resumeLower.includes(t));
  if (techMatches.length >= 2) bonus += 10;

  if (jdLower.includes("remote") && resumeLower.includes("remote")) bonus += 5;

  return {
    score: Math.min(100, baseScore + bonus),
    matched,
    missing,
  };
}
