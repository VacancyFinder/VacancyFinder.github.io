import {
  FIELD_LABELS,
  FIELD_SLUGS,
  INDUSTRY_LABELS,
  INDUSTRY_SLUGS,
  JOB_TYPE_LABELS,
  JOB_TYPES,
  SENIORITIES,
  SENIORITY_LABELS,
  WORK_MODE_LABELS,
  WORK_MODES,
  type FieldSlug,
  type IndustrySlug,
  type JobType,
  type Seniority,
  type WorkMode,
} from "@rekiya/shared/constants";
import type { Job } from "./types";

export const SORTS = ["newest", "posted", "company"] as const;
export type SortKey = (typeof SORTS)[number] | "relevance";
export const SORT_LABELS: Record<SortKey, string> = {
  relevance: "Best match",
  newest: "Newest on Rekiya",
  posted: "Date posted",
  company: "Company (A–Z)",
};

export const POSTED_WITHIN = ["1", "3", "7", "30"] as const;
export type PostedWithin = (typeof POSTED_WITHIN)[number] | "";
export const POSTED_LABELS: Record<Exclude<PostedWithin, "">, string> = {
  "1": "Last 24 hours",
  "3": "Last 3 days",
  "7": "Last 7 days",
  "30": "Last 30 days",
};

/** Everything the feed can be filtered by. Lives in the URL hash so views are shareable. */
export interface Filters {
  q: string;
  fields: FieldSlug[];
  industry: IndustrySlug | "";
  seniority: Seniority[];
  company: string;
  cse: boolean;
  workMode: WorkMode | "";
  type: JobType | "";
  location: string;
  newOnly: boolean;
  posted: PostedWithin;
  /** "" = default (best match while searching, else newest). */
  sort: SortKey | "";
}

export const EMPTY_FILTERS: Filters = {
  q: "",
  fields: [],
  industry: "",
  seniority: [],
  company: "",
  cse: false,
  workMode: "",
  type: "",
  location: "",
  newOnly: false,
  posted: "",
  sort: "",
};

const oneOf = <T extends string>(v: string | null, allowed: readonly T[]): T | "" =>
  v && (allowed as readonly string[]).includes(v) ? (v as T) : "";
const listOf = <T extends string>(v: string | null, allowed: readonly T[]): T[] =>
  (v ?? "")
    .split(",")
    .filter((x): x is T => (allowed as readonly string[]).includes(x))
    .filter((x, i, a) => a.indexOf(x) === i);

export function parseFilters(p: URLSearchParams): Filters {
  return {
    q: (p.get("q") ?? "").slice(0, 120),
    fields: listOf(p.get("fields"), FIELD_SLUGS),
    industry: oneOf(p.get("industry"), INDUSTRY_SLUGS),
    seniority: listOf(p.get("seniority"), SENIORITIES),
    company: (p.get("company") ?? "").replace(/[^a-z0-9-]/g, "").slice(0, 80),
    cse: p.get("cse") === "1",
    workMode: oneOf(p.get("workMode"), WORK_MODES),
    type: oneOf(p.get("type"), JOB_TYPES),
    location: (p.get("location") ?? "").slice(0, 60),
    newOnly: p.get("new") === "1",
    posted: oneOf(p.get("posted"), POSTED_WITHIN),
    sort: oneOf(p.get("sort"), [...SORTS, "relevance"] as const),
  };
}

export function serializeFilters(f: Filters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.fields.length) p.set("fields", f.fields.join(","));
  if (f.industry) p.set("industry", f.industry);
  if (f.seniority.length) p.set("seniority", f.seniority.join(","));
  if (f.company) p.set("company", f.company);
  if (f.cse) p.set("cse", "1");
  if (f.workMode) p.set("workMode", f.workMode);
  if (f.type) p.set("type", f.type);
  if (f.location) p.set("location", f.location);
  if (f.newOnly) p.set("new", "1");
  if (f.posted) p.set("posted", f.posted);
  if (f.sort) p.set("sort", f.sort);
  return p;
}

/** Filters besides field and search (those have their own controls). */
export function activeFilterCount(f: Filters): number {
  return (
    (f.industry ? 1 : 0) +
    (f.seniority.length ? 1 : 0) +
    (f.company ? 1 : 0) +
    (f.cse ? 1 : 0) +
    (f.workMode ? 1 : 0) +
    (f.type ? 1 : 0) +
    (f.location ? 1 : 0) +
    (f.newOnly ? 1 : 0) +
    (f.posted ? 1 : 0)
  );
}

export const hasAnyFilter = (f: Filters) => activeFilterCount(f) > 0 || f.fields.length > 0 || f.q.trim() !== "";

export interface Chip {
  key: string;
  label: string;
  /** Applying this patch removes the chip's filter. */
  remove: Partial<Filters>;
}

/** One removable chip per active filter value, in the order people read them. */
export function activeChips(f: Filters, companyName: (slug: string) => string): Chip[] {
  const out: Chip[] = [];
  if (f.q.trim()) out.push({ key: "q", label: `“${f.q.trim()}”`, remove: { q: "" } });
  for (const x of f.fields) out.push({ key: `f-${x}`, label: FIELD_LABELS[x], remove: { fields: f.fields.filter((y) => y !== x) } });
  for (const x of f.seniority)
    out.push({ key: `s-${x}`, label: SENIORITY_LABELS[x], remove: { seniority: f.seniority.filter((y) => y !== x) } });
  if (f.workMode) out.push({ key: "wm", label: WORK_MODE_LABELS[f.workMode], remove: { workMode: "" } });
  if (f.type) out.push({ key: "ty", label: JOB_TYPE_LABELS[f.type], remove: { type: "" } });
  if (f.posted) out.push({ key: "po", label: `Posted: ${POSTED_LABELS[f.posted].toLowerCase()}`, remove: { posted: "" } });
  if (f.location) out.push({ key: "lo", label: `Location: ${f.location}`, remove: { location: "" } });
  if (f.company) out.push({ key: "co", label: companyName(f.company), remove: { company: "" } });
  if (f.industry) out.push({ key: "in", label: INDUSTRY_LABELS[f.industry], remove: { industry: "" } });
  if (f.cse) out.push({ key: "cse", label: "CSE-listed", remove: { cse: false } });
  if (f.newOnly) out.push({ key: "new", label: "New since last visit", remove: { newOnly: false } });
  return out;
}

export interface QuickFilter {
  key: string;
  label: string;
  isOn: (f: Filters) => boolean;
  toggle: (f: Filters) => Partial<Filters>;
}

const ENTRY: Seniority[] = ["intern", "trainee", "junior"];
const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));

/** One-tap shortcuts for the most common searches. */
export const QUICK_FILTERS: QuickFilter[] = [
  {
    key: "week",
    label: "Posted this week",
    isOn: (f) => f.posted === "7",
    toggle: (f) => ({ posted: f.posted === "7" ? "" : "7" }),
  },
  {
    key: "remote",
    label: "Remote",
    isOn: (f) => f.workMode === "remote",
    toggle: (f) => ({ workMode: f.workMode === "remote" ? "" : "remote" }),
  },
  {
    key: "hybrid",
    label: "Hybrid",
    isOn: (f) => f.workMode === "hybrid",
    toggle: (f) => ({ workMode: f.workMode === "hybrid" ? "" : "hybrid" }),
  },
  {
    key: "entry",
    label: "Entry level",
    isOn: (f) => sameSet(f.seniority, ENTRY),
    toggle: (f) => ({ seniority: sameSet(f.seniority, ENTRY) ? [] : ENTRY }),
  },
  {
    key: "intern",
    label: "Internships",
    isOn: (f) => f.type === "internship",
    toggle: (f) => ({ type: f.type === "internship" ? "" : "internship" }),
  },
  {
    key: "senior",
    label: "Senior & lead",
    isOn: (f) => sameSet(f.seniority, ["senior", "lead", "principal"]),
    toggle: (f) => ({ seniority: sameSet(f.seniority, ["senior", "lead", "principal"]) ? [] : ["senior", "lead", "principal"] }),
  },
  {
    key: "cse",
    label: "CSE-listed",
    isOn: (f) => f.cse,
    toggle: (f) => ({ cse: !f.cse }),
  },
];

export interface FilterContext {
  /** slug → CSE-listed? (companies, and groups with any listed member) */
  isCse: (companySlug: string) => boolean;
  /** Companies whose jobs count as this company's (a group includes its members). */
  companyMatches: (jobCompany: string, filterCompany: string) => boolean;
  isNew: (job: Job) => boolean;
  /** Jobs the user hid (or whose company they hid). */
  isHidden?: (job: Job) => boolean;
  now?: number;
}

/** The date a listing went up: the site's own date when it gives one, else when Rekiya first saw it. */
export const jobDate = (j: Pick<Job, "postedAt" | "firstSeenAt">): string => j.postedAt ?? j.firstSeenAt;

/** All filters except the text query (search ranks separately). Open jobs only. */
export function applyFilters(jobs: Job[], f: Filters, ctx: FilterContext): Job[] {
  const loc = f.location.trim().toLowerCase();
  const cutoff = f.posted ? (ctx.now ?? Date.now()) - Number(f.posted) * 86_400_000 : 0;
  return jobs.filter(
    (j) =>
      j.status === "open" &&
      !ctx.isHidden?.(j) &&
      (!f.fields.length || j.fields.some((x) => f.fields.includes(x))) &&
      (!f.industry || j.industry === f.industry) &&
      (!f.seniority.length || f.seniority.includes(j.seniority)) &&
      (!f.company || ctx.companyMatches(j.company, f.company)) &&
      (!f.cse || ctx.isCse(j.company)) &&
      (!f.workMode || j.workMode === f.workMode) &&
      (!f.type || j.type === f.type) &&
      (!loc || j.location.toLowerCase().includes(loc)) &&
      (!f.newOnly || ctx.isNew(j)) &&
      (!cutoff || Date.parse(jobDate(j)) >= cutoff),
  );
}

/** Newest first: first seen, then posted date, then title. */
export function sortNewest(jobs: Job[]): Job[] {
  return [...jobs].sort(
    (a, b) =>
      b.firstSeenAt.localeCompare(a.firstSeenAt) || (b.postedAt ?? "").localeCompare(a.postedAt ?? "") || a.title.localeCompare(b.title),
  );
}

export function sortJobs(jobs: Job[], sort: Exclude<SortKey, "relevance">, companyName: (slug: string) => string): Job[] {
  if (sort === "newest") return sortNewest(jobs);
  if (sort === "posted") return [...jobs].sort((a, b) => jobDate(b).localeCompare(jobDate(a)) || a.title.localeCompare(b.title));
  return [...jobs].sort((a, b) => companyName(a.company).localeCompare(companyName(b.company)) || a.title.localeCompare(b.title));
}

/** Jobs like this one: shared fields count most, then same seniority, same employer, then recency. */
export function similarJobs(job: Job, all: Job[], limit = 6): Job[] {
  const scored: [Job, number][] = [];
  for (const j of all) {
    if (j.id === job.id || j.status !== "open") continue;
    const shared = j.fields.filter((f) => job.fields.includes(f) && f !== "other").length;
    if (!shared) continue;
    const s = shared * 3 + (j.seniority === job.seniority && j.seniority !== "unspecified" ? 2 : 0) + (j.company === job.company ? 1 : 0);
    scored.push([j, s]);
  }
  return scored
    .sort((a, b) => b[1] - a[1] || b[0].firstSeenAt.localeCompare(a[0].firstSeenAt))
    .slice(0, limit)
    .map(([j]) => j);
}

/** A short human name for a saved search, from its filters. */
export function describeFilters(f: Filters, companyName: (slug: string) => string): string {
  const parts = activeChips({ ...f, q: "" }, companyName).map((c) => c.label);
  const q = f.q.trim() ? `“${f.q.trim()}”` : "";
  const text = [q, ...parts].filter(Boolean).join(" · ");
  return text || "All jobs";
}
