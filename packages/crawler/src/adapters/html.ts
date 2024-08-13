import * as cheerio from "cheerio";
import { absUrl, requireString, type AdapterFn, type RawJob } from "./types.js";

/**
 * Config-driven HTML scraping, e.g.
 * { "listSelector": ".job-card", "titleSelector": "h3", "linkSelector": "a",
 *   "locationSelector": ".location", "descriptionSelector": ".summary", "dateSelector": "time",
 *   "linkPattern": "/careers/", "skipTitlePattern": "^(apply|view)" }
 * A listing without a link gets the careers page URL plus "#<title slug>" so each stays distinct.
 */
export interface HtmlConfig {
  listSelector: string;
  titleSelector?: string;
  linkSelector?: string;
  locationSelector?: string;
  descriptionSelector?: string;
  dateSelector?: string;
  linkPattern?: string;
  skipTitlePattern?: string;
  /** Pages to fetch in addition to the careers URL (pagination, category pages). */
  extraPages?: string[];
}

const text = ($el: cheerio.Cheerio<never>) => $el.first().text().replace(/\s+/g, " ").trim();

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

export function parseHtmlList(html: string, pageUrl: string, cfg: HtmlConfig): RawJob[] {
  const $ = cheerio.load(html);
  const out: RawJob[] = [];
  const skip = cfg.skipTitlePattern ? new RegExp(cfg.skipTitlePattern, "i") : null;
  const linkRe = cfg.linkPattern ? new RegExp(cfg.linkPattern, "i") : null;
  $(cfg.listSelector).each((_, node) => {
    const $n = $(node);
    const title = cfg.titleSelector ? text($n.find(cfg.titleSelector) as cheerio.Cheerio<never>) : text($n as cheerio.Cheerio<never>);
    if (!title || title.length < 3 || title.length > 200 || skip?.test(title)) return;
    const $a = cfg.linkSelector ? $n.find(cfg.linkSelector).first() : $n.is("a") ? $n : $n.find("a[href]").first();
    let url = absUrl($a.attr("href"), pageUrl);
    if (url && linkRe && !linkRe.test(url)) url = null;
    out.push({
      title,
      url: url ?? `${pageUrl.split("#")[0]}#${slugify(title)}`,
      location: cfg.locationSelector ? text($n.find(cfg.locationSelector) as cheerio.Cheerio<never>) || null : null,
      description: cfg.descriptionSelector ? text($n.find(cfg.descriptionSelector) as cheerio.Cheerio<never>) || null : null,
      postedAt: cfg.dateSelector ? ($n.find(cfg.dateSelector).first().attr("datetime") ?? text($n.find(cfg.dateSelector) as cheerio.Cheerio<never>)) || null : null,
    });
  });
  return out;
}

export const html: AdapterFn = async (ctx) => {
  const cfg = { ...(ctx.config as unknown as HtmlConfig), listSelector: requireString(ctx.config, "listSelector") };
  const r = await ctx.fetcher.get(ctx.url, { validators: ctx.validators });
  if (r.notModified) return { jobs: [], notModified: true, validators: r.validators };
  let jobs = parseHtmlList(r.text, r.url, cfg);
  for (const extra of cfg.extraPages ?? []) {
    const e = await ctx.fetcher.get(new URL(extra, r.url).href);
    jobs = jobs.concat(parseHtmlList(e.text, e.url, cfg));
  }
  return { jobs, validators: r.validators };
};
