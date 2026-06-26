import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatSalary(min?: number | null, max?: number | null, currency = "INR"): string {
  if (!min && !max) return "Salary not disclosed";
  const fmt = (n: number) => {
    if (currency === "INR") {
      return `₹${(n / 100000).toFixed(1)}L`;
    }
    return `$${Math.round(n / 1000)}k`;
  };
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `${fmt(min)}+`;
  if (max) return `Up to ${fmt(max)}`;
  return "Salary not disclosed";
}

export function timeAgo(date: Date | string | null): string {
  if (!date) return "Unknown";
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-IN");
}

export const PLATFORM_COLORS: Record<string, string> = {
  LINKEDIN: "bg-blue-100 text-blue-700",
  NAUKRI: "bg-orange-100 text-orange-700",
  INDEED: "bg-purple-100 text-purple-700",
  GLASSDOOR: "bg-green-100 text-green-700",
  OTHER: "bg-gray-100 text-gray-600",
};

export const STATUS_COLORS: Record<string, string> = {
  SAVED: "bg-slate-100 text-slate-700",
  APPLIED: "bg-blue-100 text-blue-700",
  INTERVIEW: "bg-yellow-100 text-yellow-700",
  OFFER: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};
