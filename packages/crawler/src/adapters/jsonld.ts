import * as cheerio from "cheerio";
import { jsonLdBlocks } from "../probe/signals.js";
import { absUrl, type AdapterFn, type RawJob } from "./types.js";

type Obj = Record<string, unknown>;

/** All JobPosting nodes in a JSON-LD tree (@graph, ItemList, arrays). */
export function findJobPostings(node: unknown, out: Obj[] = []): Obj[] {
  if (Array.isArray(node)) {
    for (const n of node) findJobPostings(n, out);
    return out;
  }
  if (!node || typeof node !== "object") return out;
  const o = node as Obj;
  const t = o["@type"];
  if (t === "JobPosting" || (Array.isArray(t) && t.includes("JobPosting"))) out.push(o);
  for (const k of ["@graph", "itemListElement", "item", "mainEntity"]) if (o[k]) findJobPostings(o[k], out);
  return out;
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

function place(loc: unknown): string {
  const list = Array.isArray(loc) ? loc : [loc];
  return list
    .map((l) => {
      const a = ((l as Obj | undefined)?.address ?? {}) as Obj | string;
      if (typeof a === "string") return a;
      const country = typeof a.addressCountry === "object" ? str((a.addressCountry as Obj).name) : str(a.addressCountry);
      return [str(a.addressLocality), str(a.addressRegion), country].filter(Boolean).join(", ");
    })
    .filter(Boolean)
    .join(" / ");
}

export function postingToRaw(p: Obj, pageUrl: string): RawJob | null {
  const title = str(p.title) ?? str(p.name);
  if (!title) return null;
  const validThrough = str(p.validThrough);
  if (validThrough && !Number.isNaN(Date.parse(validThrough)) && Date.parse(validThrough) < Date.now() - 86_400_000) return null;
  const type = Array.isArray(p.employmentType) ? p.employmentType.join(" ") : str(p.employmentType);
  return {
    title,
    url: absUrl(str(p.url) ?? str((p as Obj)["@id"]), pageUrl) ?? pageUrl,
    location: place(p.jobLocation) || (p.jobLocationType === "TELECOMMUTE" ? "Remote" : null),
    description: str(p.description),
    postedAt: str(p.datePosted),
    employmentType: type,
    workplace: p.jobLocationType === "TELECOMMUTE" ? "Remote" : null,
  };
}

export function parseJsonLdPage(html: string, pageUrl: string): RawJob[] {
  const $ = cheerio.load(html);
  const out: RawJob[] = [];
  for (const block of jsonLdBlocks($))
    for (const p of findJobPostings(block)) {
      const raw = postingToRaw(p, pageUrl);
      if (raw) out.push(raw);
    }
  return out;
}

/**
 * JobPosting JSON-LD on the careers page. If the listing page has none, follow links matching
 * adapterConfig.detailLinkPattern (a regex on the href) and read JSON-LD from each detail page.
 */
export const jsonld: AdapterFn = async (ctx) => {
  const r = await ctx.fetcher.get(ctx.url, { validators: ctx.validators });
  if (r.notModified) return { jobs: [], notModified: true, validators: r.validators };
  let jobs = parseJsonLdPage(r.text, r.url);
  const pattern = typeof ctx.config.detailLinkPattern === "string" ? new RegExp(ctx.config.detailLinkPattern, "i") : null;
  if (jobs.length === 0 && pattern) {
    const $ = cheerio.load(r.text);
    const links = new Set<string>();
    $("a[href]").each((_, el) => {
      const u = absUrl($(el).attr("href"), r.url);
      if (u && pattern.test(u)) links.add(u.split("#")[0]!);
    });
    const max = typeof ctx.config.maxDetailPages === "number" ? ctx.config.maxDetailPages : 60;
    for (const link of [...links].slice(0, max)) {
      try {
        const d = await ctx.fetcher.get(link);
        const found = parseJsonLdPage(d.text, d.url).map((j) => ({ ...j, url: j.url === d.url ? link : j.url }));
        jobs = jobs.concat(found);
      } catch (err) {
        ctx.log(`detail ${link}: ${(err as Error).message}`);
      }
    }
  }
  return { jobs, validators: r.validators };
};
