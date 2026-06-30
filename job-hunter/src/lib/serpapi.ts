export interface SerpJob {
  job_id: string;
  job_title: string;
  employer_name: string;
  job_publisher: string;            // the "via" field — "via LinkedIn", "via Naukri", etc.
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
  job_employment_type: string;
}

interface SerpApiJob {
  title: string;
  company_name: string;
  location: string;
  via: string;
  description: string;
  job_id: string;
  detected_extensions?: {
    posted_at?: string;
    schedule_type?: string;
    salary?: string;
    work_from_home?: boolean;
  };
  apply_options?: { title: string; link: string }[];
}

interface SerpApiResponse {
  jobs_results?: SerpApiJob[];
  error?: string;
}

const SERP_SEARCHES = [
  { q: "full stack developer", location: "Noida, Uttar Pradesh, India" },
  { q: "react developer javascript", location: "Noida, Uttar Pradesh, India" },
  { q: "software engineer", location: "Gurgaon, Haryana, India" },
  { q: "full stack developer node.js", location: "Gurgaon, Haryana, India" },
  { q: "MERN stack developer", location: "Bangalore, Karnataka, India" },
  { q: "software engineer typescript", location: "Bangalore, Karnataka, India" },
  { q: "frontend developer react", location: "Delhi, India" },
  { q: "backend developer", location: "Mumbai, Maharashtra, India" },
  { q: "software engineer", location: "Hyderabad, Telangana, India" },
];

// Convert SerpAPI's relative "1 day ago" strings to ISO UTC strings
function parsePostedAt(relative: string | undefined): string | null {
  if (!relative) return null;
  const now = Date.now();
  const lower = relative.toLowerCase();
  if (lower.includes("just now") || lower.includes("today") || lower.includes("hour")) {
    const h = lower.match(/(\d+)\s*hour/);
    const ms = h ? parseInt(h[1]) * 3600_000 : 0;
    return new Date(now - ms).toISOString();
  }
  const days = lower.match(/(\d+)\s*day/);
  if (days) return new Date(now - parseInt(days[1]) * 86400_000).toISOString();
  const weeks = lower.match(/(\d+)\s*week/);
  if (weeks) return new Date(now - parseInt(weeks[1]) * 7 * 86400_000).toISOString();
  return new Date(now).toISOString();
}

// Parse Indian salary strings like "₹8,00,000–₹12,00,000 a year"
function parseSalary(salary: string | undefined): { min: number | null; max: number | null } {
  if (!salary) return { min: null, max: null };
  const nums = salary.replace(/[₹,]/g, "").match(/\d+/g);
  if (!nums) return { min: null, max: null };
  const values = nums.map(Number).filter((n) => n > 1000);
  if (values.length === 0) return { min: null, max: null };
  return { min: values[0] ?? null, max: values[1] ?? null };
}

// Pick the best apply link — prefer the platform-specific one
function pickApplyLink(applyOptions: { title: string; link: string }[] = [], via: string): string {
  if (!applyOptions.length) return "";
  const viaLower = via.toLowerCase();
  // try to find the matching platform link
  for (const opt of applyOptions) {
    const t = opt.title.toLowerCase();
    if (viaLower.includes("linkedin") && t.includes("linkedin")) return opt.link;
    if (viaLower.includes("naukri") && t.includes("naukri")) return opt.link;
    if (viaLower.includes("indeed") && t.includes("indeed")) return opt.link;
    if (viaLower.includes("glassdoor") && t.includes("glassdoor")) return opt.link;
  }
  return applyOptions[0].link;
}

function mapSerpJob(raw: SerpApiJob): SerpJob {
  const loc = raw.location ?? "";
  const parts = loc.split(",").map((s) => s.trim());
  const salary = parseSalary(raw.detected_extensions?.salary);
  return {
    job_id: "serp-" + raw.job_id,
    job_title: raw.title,
    employer_name: raw.company_name,
    job_publisher: raw.via ?? "",
    job_description: raw.description ?? "",
    job_apply_link: pickApplyLink(raw.apply_options, raw.via ?? ""),
    job_apply_is_direct: (raw.apply_options?.length ?? 0) > 0,
    job_is_remote: raw.detected_extensions?.work_from_home ?? loc.toLowerCase().includes("remote"),
    job_city: parts[0] ?? "",
    job_state: parts[1] ?? "",
    job_country: parts[parts.length - 1] ?? "India",
    job_min_salary: salary.min,
    job_max_salary: salary.max,
    job_salary_currency: salary.min ? "INR" : null,
    job_posted_at_datetime_utc: parsePostedAt(raw.detected_extensions?.posted_at),
    job_employment_type: raw.detected_extensions?.schedule_type ?? "FULLTIME",
  };
}

export async function fetchJobsFromSerp(
  query: string,
  location: string,
  datePosted: "today" | "3days" | "week" | "month" = "week",
  noCache = false
): Promise<SerpJob[]> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) throw new Error("SERPAPI_KEY not set");

  const chipDate =
    datePosted === "today" ? "date_posted:today"
    : datePosted === "3days" ? "date_posted:3days"
    : datePosted === "week" ? "date_posted:week"
    : "date_posted:month";

  const params = new URLSearchParams({
    engine: "google_jobs",
    q: query,
    location,
    chips: chipDate,
    hl: "en",
    api_key: apiKey,
  });

  const res = await fetch(`https://serpapi.com/search.json?${params}`, {
    ...(noCache ? { cache: "no-store" } : { next: { revalidate: 3600 } }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SerpAPI error ${res.status}: ${text}`);
  }

  const json: SerpApiResponse = await res.json();
  if (json.error) throw new Error(`SerpAPI: ${json.error}`);
  return (json.jobs_results ?? []).map(mapSerpJob);
}

export async function fetchAllJobQueries(
  noCache = false,
  datePosted: "today" | "3days" | "week" | "month" = "week"
): Promise<SerpJob[]> {
  const results = await Promise.allSettled(
    SERP_SEARCHES.map(({ q, location }) => fetchJobsFromSerp(q, location, datePosted, noCache))
  );
  return results
    .filter((r): r is PromiseFulfilledResult<SerpJob[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);
}

export function detectPlatform(job: SerpJob): "LINKEDIN" | "NAUKRI" | "INDEED" | "GLASSDOOR" | "OTHER" {
  const via = job.job_publisher?.toLowerCase() ?? "";
  const url = job.job_apply_link?.toLowerCase() ?? "";
  if (via.includes("linkedin") || url.includes("linkedin")) return "LINKEDIN";
  if (via.includes("naukri") || url.includes("naukri")) return "NAUKRI";
  if (via.includes("indeed") || url.includes("indeed")) return "INDEED";
  if (via.includes("glassdoor") || url.includes("glassdoor")) return "GLASSDOOR";
  return "OTHER";
}

export function isQuickApply(job: SerpJob): boolean {
  const platform = detectPlatform(job);
  return (platform === "LINKEDIN" || platform === "NAUKRI") && job.job_apply_is_direct;
}

// SerpAPI rarely returns Indian salaries — treat missing salary as valid
export function meetsMinSalary(job: SerpJob, minLPA = 6): boolean {
  if (!job.job_min_salary && !job.job_max_salary) return true;
  const salaryLPA = (job.job_min_salary ?? job.job_max_salary ?? 0) / 100_000;
  return salaryLPA >= minLPA || salaryLPA === 0;
}
