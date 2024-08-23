import {
  FIELD_SLUGS,
  INDUSTRY_SLUGS,
  JOB_TYPES,
  SENIORITIES,
  WORK_MODES,
  type FieldSlug,
  type IndustrySlug,
  type JobType,
  type Seniority,
  type WorkMode,
} from "@rekiya/shared/constants";
import type { Job } from "./types";

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
};

const oneOf = <T extends string>(v: string | null, allowed: readonly T[]): T | "" => (v && (allowed as readonly string[]).includes(v) ? (v as T) : "");
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
  return p;
}

export function activeFilterCount(f: Filters): number {
  return (
    (f.industry ? 1 : 0) +
    (f.seniority.length ? 1 : 0) +
    (f.company ? 1 : 0) +
    (f.cse ? 1 : 0) +
    (f.workMode ? 1 : 0) +
    (f.type ? 1 : 0) +
    (f.location ? 1 : 0) +
    (f.newOnly ? 1 : 0)
  );
}

export interface FilterContext {
  /** slug → CSE-listed? (companies, and groups with any listed member) */
  isCse: (companySlug: string) => boolean;
  /** Companies whose jobs count as this company's (a group includes its members). */
  companyMatches: (jobCompany: string, filterCompany: string) => boolean;
  isNew: (job: Job) => boolean;
}

/** All filters except the text query (search ranks separately). Open jobs only. */
export function applyFilters(jobs: Job[], f: Filters, ctx: FilterContext): Job[] {
  const loc = f.location.trim().toLowerCase();
  return jobs.filter(
    (j) =>
      j.status === "open" &&
      (!f.fields.length || j.fields.some((x) => f.fields.includes(x))) &&
      (!f.industry || j.industry === f.industry) &&
      (!f.seniority.length || f.seniority.includes(j.seniority)) &&
      (!f.company || ctx.companyMatches(j.company, f.company)) &&
      (!f.cse || ctx.isCse(j.company)) &&
      (!f.workMode || j.workMode === f.workMode) &&
      (!f.type || j.type === f.type) &&
      (!loc || j.location.toLowerCase().includes(loc)) &&
      (!f.newOnly || ctx.isNew(j)),
  );
}

/** Newest first: first seen, then posted date, then title. */
export function sortNewest(jobs: Job[]): Job[] {
  return [...jobs].sort(
    (a, b) => b.firstSeenAt.localeCompare(a.firstSeenAt) || (b.postedAt ?? "").localeCompare(a.postedAt ?? "") || a.title.localeCompare(b.title),
  );
}
