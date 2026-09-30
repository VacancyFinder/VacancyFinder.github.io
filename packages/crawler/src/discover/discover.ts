import * as cheerio from "cheerio";
import { canonicalCareersUrl, domainOf, isSharedHost } from "@rekiya/shared";
import { HttpError, RobotsDisallowedError, type PoliteFetcher } from "../http/fetcher.js";
import { CAREER_WORDS, extractSignals } from "../probe/signals.js";

export const COMMON_PATHS = ["/careers", "/career", "/careers/", "/jobs", "/join-us", "/work-with-us", "/vacancies"];
const URL_WORDS = /career|jobs?\b|vacanc|join-?us|work-?with-?us|opportunit|recruit/i;
const MAX_CANDIDATES = 8;

export interface Candidate {
  url: string;
  score: number;
  evidence: string[];
  title?: string;
  status?: number;
  jsonLdJobPostings?: number;
  ats?: string[];
}

export interface DomainResult {
  domain: string;
  website: string;
  companies: string[];
  candidates: Candidate[];
  errors: string[];
}

function sameSite(a: string, b: string): boolean {
  const da = domainOf(a);
  const db = domainOf(b);
  if (!da || !db) return false;
  return da === db || da.endsWith(`.${db}`) || db.endsWith(`.${da}`);
}

function errText(err: unknown): string {
  if (err instanceof RobotsDisallowedError) return "robots.txt disallows";
  if (err instanceof HttpError) return `HTTP ${err.status}`;
  return (err as Error).message;
}

/**
 * Look for a company's careers page without guessing: homepage links, sitemap entries, and a
 * fixed list of common paths. Every candidate carries the evidence that produced it; nothing is
 * activated automatically.
 */
export async function discoverDomain(fetcher: PoliteFetcher, website: string, companies: string[]): Promise<DomainResult> {
  const domain = domainOf(website) ?? website;
  const res: DomainResult = { domain, website, companies, candidates: [], errors: [] };
  const byKey = new Map<string, Candidate>();
  const add = (url: string, points: number, evidence: string) => {
    let key: string;
    try {
      key = canonicalCareersUrl(url);
    } catch {
      return;
    }
    const c = byKey.get(key) ?? { url, score: 0, evidence: [] };
    c.score += points;
    if (!c.evidence.includes(evidence)) c.evidence.push(evidence);
    byKey.set(key, c);
  };
  const fetched = new Map<string, { status: number; title: string; jsonLd: number; ats: string[] }>();

  // 1. Homepage links.
  let homeUrl = website;
  try {
    const r = await fetcher.get(website);
    homeUrl = r.url;
    const $ = cheerio.load(r.text);
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") ?? "";
      const text = $(el).text().replace(/\s+/g, " ").trim();
      let abs: string;
      try {
        abs = new URL(href, r.url).href;
      } catch {
        return;
      }
      if (!/^https?:/.test(abs)) return;
      const textHit = CAREER_WORDS.test(text) && text.length <= 40;
      const urlHit = URL_WORDS.test(new URL(abs).pathname) || URL_WORDS.test(new URL(abs).hostname.split(".")[0] ?? "");
      if (!textHit && !urlHit) return;
      if (sameSite(abs, website)) add(abs, textHit ? 3 : 2, `homepage link "${text.slice(0, 40)}"`);
      else if (isSharedHost(domainOf(abs))) add(abs, 2, `homepage links to job site "${text.slice(0, 40)}"`);
    });
    for (const a of extractSignals(r.text, r.url).ats) add(a.url, 4, `homepage references ${a.ats} account ${a.id}`);
  } catch (err) {
    res.errors.push(`homepage: ${errText(err)}`);
  }

  // 2. Sitemap entries.
  try {
    let maps = await fetcher.sitemaps(website);
    if (maps.length === 0) maps = [new URL("/sitemap.xml", homeUrl).href];
    const queue = maps.slice(0, 3);
    let visited = 0;
    while (queue.length && visited < 5) {
      const sm = queue.shift()!;
      visited++;
      try {
        const r = await fetcher.get(sm);
        const locs = [...r.text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]!);
        if (/<sitemapindex/i.test(r.text)) {
          queue.push(...locs.filter((l) => /page|career|job/i.test(l)).slice(0, 3));
          continue;
        }
        for (const loc of locs.filter((l) => URL_WORDS.test(new URL(l, sm).pathname)).slice(0, 10)) add(loc, 2, `sitemap entry in ${new URL(sm).pathname}`);
      } catch (err) {
        if (!(err instanceof HttpError && err.status === 404)) res.errors.push(`sitemap ${sm}: ${errText(err)}`);
      }
    }
  } catch (err) {
    res.errors.push(`sitemap: ${errText(err)}`);
  }

  // 3. Common paths.
  for (const path of COMMON_PATHS) {
    const url = new URL(path, homeUrl).href;
    try {
      const r = await fetcher.get(url);
      const finalPath = new URL(r.url).pathname.replace(/\/+$/, "");
      if (finalPath === "" || !sameSite(r.url, website)) continue; // redirected to homepage / elsewhere
      const s = extractSignals(r.text, r.url);
      const $ = cheerio.load(r.text);
      const heading = `${s.title} ${$("h1").first().text()}`;
      if (!CAREER_WORDS.test(heading) && !URL_WORDS.test(finalPath)) continue;
      fetched.set(canonicalCareersUrl(r.url), { status: r.status, title: s.title, jsonLd: s.jsonLdJobPostings, ats: s.ats.map((a) => `${a.ats}:${a.id}`) });
      add(r.url, CAREER_WORDS.test(heading) ? 3 : 2, `common path ${path} → ${r.status}${r.url !== url ? ` (${new URL(r.url).pathname})` : ""}`);
    } catch (err) {
      if (!(err instanceof HttpError && err.status === 404)) res.errors.push(`${path}: ${errText(err)}`);
    }
  }

  // 4. Fetch the best candidates not yet seen, to attach page evidence.
  const ranked = [...byKey.values()].sort((a, b) => b.score - a.score);
  for (const c of ranked.slice(0, 3)) {
    const key = canonicalCareersUrl(c.url);
    if (fetched.has(key) || !sameSite(c.url, website)) continue;
    try {
      const r = await fetcher.get(c.url);
      const s = extractSignals(r.text, r.url);
      fetched.set(key, { status: r.status, title: s.title, jsonLd: s.jsonLdJobPostings, ats: s.ats.map((a) => `${a.ats}:${a.id}`) });
    } catch (err) {
      c.evidence.push(`fetch failed: ${errText(err)}`);
      c.score -= 2;
    }
  }
  for (const c of ranked) {
    const f = fetched.get(canonicalCareersUrl(c.url));
    if (!f) continue;
    c.status = f.status;
    c.title = f.title;
    c.jsonLdJobPostings = f.jsonLd;
    c.ats = f.ats;
    if (CAREER_WORDS.test(f.title)) c.score += 1;
    if (f.jsonLd > 0) c.score += 2;
  }
  res.candidates = ranked.filter((c) => c.score > 0).sort((a, b) => b.score - a.score).slice(0, MAX_CANDIDATES);
  return res;
}
