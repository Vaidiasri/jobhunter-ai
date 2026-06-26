export interface JSearchJob {
  job_id: string;
  job_title: string;
  employer_name: string;
  employer_logo: string | null;
  job_publisher: string;
  job_employment_type: string;
  job_description: string;
  job_apply_link: string;
  job_apply_is_direct: boolean;
  job_is_remote: boolean;
  job_city: string;
  job_state: string;
  job_country: string;
  job_min_salary: number | null;
  job_max_salary: number | null;
  job_salary_currency: string | null;
  job_posted_at_datetime_utc: string | null;
  job_highlights?: {
    Qualifications?: string[];
    Responsibilities?: string[];
    Benefits?: string[];
  };
}

interface JSearchResponse {
  data: JSearchJob[] | { jobs: JSearchJob[] };
  status: string;
  request_id: string;
}

function extractJobs(data: JSearchJob[] | { jobs: JSearchJob[] }): JSearchJob[] {
  if (Array.isArray(data)) return data;
  return data.jobs ?? [];
}

const JSEARCH_BASE = "https://jsearch.p.rapidapi.com";

const SEARCH_QUERIES = [
  "full stack developer India",
  "frontend developer React India",
  "backend developer Node.js India",
  "MERN stack developer India",
  "software engineer TypeScript India",
  "AI engineer LangChain India",
];

export async function fetchJobsFromJSearch(
  query?: string,
  page = 1,
  datePosted: "today" | "3days" | "week" | "month" = "week",
  noCache = false
): Promise<JSearchJob[]> {
  const apiKey = process.env.JSEARCH_API_KEY;
  if (!apiKey) throw new Error("JSEARCH_API_KEY not set");

  const searchQuery = query || SEARCH_QUERIES[Math.floor(Math.random() * SEARCH_QUERIES.length)];

  const params = new URLSearchParams({
    query: searchQuery,
    page: String(page),
    num_pages: "1",
    date_posted: datePosted,
    country: "in",
  });

  const res = await fetch(`${JSEARCH_BASE}/search-v2?${params}`, {
    headers: {
      "X-RapidAPI-Key": apiKey,
      "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
    },
    ...(noCache ? { cache: "no-store" } : { next: { revalidate: 3600 } }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`JSearch API error ${res.status}: ${text}`);
  }

  const json: JSearchResponse = await res.json();
  return extractJobs(json.data);
}

export async function fetchAllJobQueries(noCache = false): Promise<JSearchJob[]> {
  const results = await Promise.allSettled(
    SEARCH_QUERIES.map((q) => fetchJobsFromJSearch(q, 1, "week", noCache))
  );
  return results
    .filter((r): r is PromiseFulfilledResult<JSearchJob[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);
}

export function detectPlatform(job: JSearchJob): "LINKEDIN" | "NAUKRI" | "INDEED" | "GLASSDOOR" | "OTHER" {
  const publisher = job.job_publisher?.toLowerCase() ?? "";
  const url = job.job_apply_link?.toLowerCase() ?? "";
  if (publisher.includes("linkedin") || url.includes("linkedin")) return "LINKEDIN";
  if (publisher.includes("naukri") || url.includes("naukri")) return "NAUKRI";
  if (publisher.includes("indeed") || url.includes("indeed")) return "INDEED";
  if (publisher.includes("glassdoor") || url.includes("glassdoor")) return "GLASSDOOR";
  return "OTHER";
}

export function isQuickApply(job: JSearchJob): boolean {
  const platform = detectPlatform(job);
  return (platform === "LINKEDIN" || platform === "NAUKRI") && job.job_apply_is_direct;
}

export function meetsMinSalary(job: JSearchJob, minLPA = 6): boolean {
  if (!job.job_min_salary && !job.job_max_salary) return true;
  const salaryLPA = (job.job_min_salary ?? job.job_max_salary ?? 0) / 100000;
  return salaryLPA >= minLPA || salaryLPA === 0;
}
