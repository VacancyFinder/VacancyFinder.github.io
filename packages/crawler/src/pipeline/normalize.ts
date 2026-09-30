import { createHash } from "node:crypto";
import type { Company, FieldSlug, IndustrySlug, Job, Overrides } from "@rekiya/shared";
import { Job as JobSchema } from "@rekiya/shared";
import type { RawJob } from "../adapters/types.js";
import { classifyFields } from "../classify/fields.js";
import { classifySeniority } from "../classify/seniority.js";
import { cleanText, cleanTitle, detectJobType, detectWorkMode, isoDate, normalizeLocation, snippet } from "../classify/text.js";

const TRACKING = /^(utm_\w+|gh_src|gh_jid_src|source|src|ref|referrer|lever-source|lever-origin|fbclid|gclid|mc_[a-z]+)$/i;

/**
 * Canonical listing URL for ids: lowercase host without www, https, no hash, tracking params removed.
 * Other query params are kept because some sites tell listings apart only by ?id=… (deviation from the
 * spec's "no query", which would merge different jobs). Synthetic "#job-…" anchors (listings with no
 * link of their own) are kept for the same reason.
 */
export function canonicalListingUrl(url: string): string {
  const u = new URL(url);
  const hash = u.hash.startsWith("#job-") ? u.hash : "";
  u.protocol = "https:";
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
  u.hash = "";
  for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
  u.searchParams.sort();
  const path = u.pathname.replace(/\/+$/, "") || "/";
  const q = u.searchParams.toString();
  return `https://${u.hostname}${path}${q ? `?${q}` : ""}${hash}`;
}

export function jobId(company: string, url: string): string {
  return createHash("sha1")
    .update(`${company}|${canonicalListingUrl(url)}`)
    .digest("hex");
}

export interface Attribution {
  /** Company slugs that share this target. */
  companies: Company[];
  /** Group slug when several companies share the page. */
  parentGroup: string | null;
  /** Extra companies to recognise in listings (adapterConfig.attributeTo). */
  extra: { company: Company; pattern: RegExp }[];
}

const LEGAL = /\b(plc|ltd|limited|pvt|\(pvt\)|private|holdings?|company|co)\b\.?/gi;

function namePattern(name: string): RegExp | null {
  const core = name
    .replace(/\(.*?\)/g, " ")
    .replace(LEGAL, " ")
    .replace(/&/g, "and")
    .replace(/\s+/g, " ")
    .trim();
  if (core.length < 4) return null;
  const esc = core
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\band\b/g, "(?:and|&)")
    .replace(/ /g, "\\s+");
  return new RegExp(`\\b${esc}\\b(?!\\s+group)`, "i");
}

/** Which company a listing belongs to: a subsidiary only when exactly one is named, else the group. */
export function attribute(raw: RawJob, a: Attribution): Company | { slug: string; group: true } {
  if (a.companies.length === 1 && a.extra.length === 0) return a.companies[0]!;
  const hay = [raw.title, raw.department, raw.location].filter(Boolean).join(" | ");
  const hits = new Set<Company>();
  for (const e of a.extra) if (e.pattern.test(hay)) hits.add(e.company);
  if (hits.size === 0) {
    for (const c of a.companies) {
      const p = namePattern(c.name);
      if (p?.test(hay)) hits.add(c);
    }
  }
  if (hits.size === 1) return [...hits][0]!;
  if (a.parentGroup) return { slug: a.parentGroup, group: true };
  return a.companies[0]!;
}

/** A group's industry: "diversified" if any member is, else the most common member industry. */
export function groupIndustry(companies: Company[]): IndustrySlug {
  if (companies.some((c) => c.industry === "diversified")) return "diversified";
  const n = new Map<IndustrySlug, number>();
  for (const c of companies) n.set(c.industry, (n.get(c.industry) ?? 0) + 1);
  return [...n.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))[0]![0];
}

export function applyOverrides(job: Job, ov: Overrides | null): Job {
  if (!ov) return job;
  let out = job;
  for (const p of ov.titlePatterns) {
    if (new RegExp(p.match, p.flags ?? "i").test(out.title)) out = { ...out, ...p.set } as Job;
  }
  const byId = ov.jobs[job.id];
  if (byId) out = { ...out, ...byId } as Job;
  return out;
}

export interface NormalizeContext {
  attribution: Attribution;
  source: string;
  now: string;
  /** Keep only listings whose location/title matches (global ATS accounts). */
  locationFilter?: RegExp;
  overrides: Overrides | null;
}

export type Normalized = Omit<Job, "firstSeenAt" | "lastSeenAt" | "status" | "missedRuns" | "closedAt">;

export function normalizeJob(raw: RawJob, ctx: NormalizeContext): { job?: Job; dropped?: string } {
  const title = cleanTitle(raw.title);
  if (!title) return { dropped: "empty title" };
  let url: string;
  try {
    url = new URL(raw.url).href;
  } catch {
    return { dropped: `bad url ${JSON.stringify(raw.url)}` };
  }
  const location = normalizeLocation(raw.location);
  if (ctx.locationFilter && !ctx.locationFilter.test(`${raw.location ?? ""} ${title}`)) return { dropped: "outside location filter" };

  const who = attribute(raw, ctx.attribution);
  const company = who.slug;
  const industry = "group" in who ? groupIndustry(ctx.attribution.companies) : (who as Company).industry;
  const desc = cleanText(raw.description);
  const seniority = classifySeniority(title, desc);
  let type = detectJobType(raw.employmentType, title);
  if (type === "unspecified") type = detectJobType(desc.slice(0, 600));
  if (seniority === "intern" && type === "unspecified") type = "internship";
  let workMode = detectWorkMode(raw.workplace, raw.location, title);
  if (workMode === "unspecified") workMode = detectWorkMode(desc.slice(0, 800));
  const fields: FieldSlug[] = classifyFields(`${title} ${raw.department ?? ""}`.trim(), desc, industry);

  const draft: Job = {
    id: jobId(company, url),
    title: title.slice(0, 300),
    company,
    industry,
    fields,
    seniority,
    type,
    workMode,
    location: location.slice(0, 200),
    snippet: snippet(desc),
    url,
    source: ctx.source,
    postedAt: isoDate(raw.postedAt ?? null),
    firstSeenAt: ctx.now,
    lastSeenAt: ctx.now,
    status: "open",
    missedRuns: 0,
    closedAt: null,
  };
  const job = applyOverrides(draft, ctx.overrides);
  const parsed = JobSchema.safeParse(job);
  if (!parsed.success) return { dropped: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  return { job: parsed.data };
}
