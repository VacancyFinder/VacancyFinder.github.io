import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { absUrl, requireString, type AdapterFn, type RawJob } from "./types.js";

/**
 * Config-driven HTML scraping. Every selector is relative to one listing (`listSelector`).
 *
 *   listSelector        one element per job (required)
 *   titleSelector       title inside the item (default: the item's own text)
 *   linkSelector        link inside the item (default: the item if it is an <a>, else its first link)
 *   locationSelector / departmentSelector / typeSelector / workplaceSelector / descriptionSelector / dateSelector
 *   defaultLocation     used when the page shows no location (e.g. "Colombo")
 *   groupSelector       optional: iterate these groups; `listSelector` is then relative to each group
 *   groupTitleSelector  heading inside a group, used as the department
 *   anchorAttr          attribute naming the job (e.g. "rel"); the URL becomes page#job-<value> and the
 *                       description is read from the element with that id (popup/accordion pages)
 *   linkPattern         regex a link must match to be used (otherwise a #job- anchor is used)
 *   requireLink         skip items without a (matching) link — filters out menus/footers that match listSelector
 *   skipTitlePattern    regex of titles to ignore ("Apply now", "No vacancies"…)
 *   titleStripPattern   regex removed from titles (e.g. reference codes)
 *   extraPages          more pages with the same layout
 *   pagination          { template: "…/page/{n}/" or "…&startrow={offset}", start?: 2, step?: 10, maxPages?: 10 };
 *                       stops at the first page that adds no new listings or fails
 *   closingDateSelector + closingDateFormat ("dmy" | "mdy"): listings whose closing date has passed are dropped
 *
 * Any selector may end in "@attr" to read an attribute instead of text, e.g. "input.desc@value".
 */
export interface HtmlConfig {
  listSelector: string;
  titleSelector?: string;
  linkSelector?: string;
  locationSelector?: string;
  departmentSelector?: string;
  typeSelector?: string;
  workplaceSelector?: string;
  descriptionSelector?: string;
  dateSelector?: string;
  defaultLocation?: string;
  groupSelector?: string;
  groupTitleSelector?: string;
  anchorAttr?: string;
  linkPattern?: string;
  skipTitlePattern?: string;
  titleStripPattern?: string;
  extraPages?: string[];
  pagination?: { template: string; start?: number; step?: number; maxPages?: number };
  closingDateSelector?: string;
  closingDateFormat?: "dmy" | "mdy";
  requireLink?: boolean;
}

/** "23.09.2026" / "31/10/2026" / "09/30/2026" → Date (UTC), or null if unreadable. */
export function parseClosingDate(text: string, format: "dmy" | "mdy" = "dmy"): Date | null {
  const m = text.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (!m) return null;
  const [a, b, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const [day, month] = format === "mdy" ? [b, a] : [a, b];
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(Date.UTC(y, month - 1, day, 23, 59, 59));
}

function slugify(s: string, max = 80): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, max);
}

export function parseHtmlList(html: string, pageUrl: string, cfg: HtmlConfig, now = new Date()): RawJob[] {
  const $ = cheerio.load(html);
  const out: RawJob[] = [];
  const skip = cfg.skipTitlePattern ? new RegExp(cfg.skipTitlePattern, "i") : null;
  const strip = cfg.titleStripPattern ? new RegExp(cfg.titleStripPattern, "gi") : null;
  const linkRe = cfg.linkPattern ? new RegExp(cfg.linkPattern, "i") : null;
  const pageBase = pageUrl.split("#")[0]!;
  const text = (root: cheerio.Cheerio<AnyNode>, sel?: string) => {
    if (!sel) return "";
    const at = sel.lastIndexOf("@");
    if (at > 0 && /^[\w-]+$/.test(sel.slice(at + 1))) {
      const v =
        root
          .find(sel.slice(0, at))
          .first()
          .attr(sel.slice(at + 1)) ?? "";
      return v.replace(/\s+/g, " ").trim();
    }
    return root.find(sel).first().text().replace(/\s+/g, " ").trim();
  };

  const readItem = (node: AnyNode, department: string | null) => {
    const $n = $(node);
    let title = (cfg.titleSelector ? text($n, cfg.titleSelector) : $n.text()).replace(/\s+/g, " ").trim();
    if (strip) title = title.replace(strip, "").trim();
    if (!title || title.length < 3 || title.length > 200 || skip?.test(title)) return;
    if (cfg.closingDateSelector) {
      const closes = parseClosingDate(text($n, cfg.closingDateSelector), cfg.closingDateFormat);
      if (closes && closes.getTime() < now.getTime()) return; // deadline passed
    }

    let url: string | null = null;
    let description = cfg.descriptionSelector ? text($n, cfg.descriptionSelector) || null : null;
    const anchor = cfg.anchorAttr ? $n.attr(cfg.anchorAttr) : undefined;
    if (anchor) {
      url = `${pageBase}#job-${slugify(anchor, 200)}`; // never truncate: anchors tell listings apart
      if (!description && cfg.anchorAttr !== "id") {
        // Popup/accordion pages keep the details in a separate element with that id.
        const target = $(`[id="${anchor.replace(/"/g, "")}"]`).first();
        description = target.length ? target.text().replace(/\s+/g, " ").trim() || null : null;
      }
    } else {
      const $a = cfg.linkSelector ? $n.find(cfg.linkSelector).first() : $n.is("a") ? $n : $n.find("a[href]").first();
      url = absUrl($a.attr("href"), pageUrl);
      if (url && (url.split("#")[0] === pageBase || (linkRe && !linkRe.test(url)))) url = null;
      if (!url && cfg.requireLink) return;
    }
    out.push({
      title,
      url: url ?? `${pageBase}#job-${slugify(title)}`,
      location: text($n, cfg.locationSelector) || cfg.defaultLocation || null,
      description,
      postedAt: cfg.dateSelector ? ($n.find(cfg.dateSelector).first().attr("datetime") ?? text($n, cfg.dateSelector)) || null : null,
      department: text($n, cfg.departmentSelector) || department,
      employmentType: text($n, cfg.typeSelector) || null,
      workplace: text($n, cfg.workplaceSelector) || null,
    });
  };

  if (cfg.groupSelector) {
    $(cfg.groupSelector).each((_, g) => {
      const $g = $(g);
      const dept = cfg.groupTitleSelector ? text($g, cfg.groupTitleSelector) || null : null;
      $g.find(cfg.listSelector).each((__, node) => readItem(node, dept));
    });
  } else {
    $(cfg.listSelector).each((_, node) => readItem(node, null));
  }
  return out;
}

export const html: AdapterFn = async (ctx) => {
  const cfg = { ...(ctx.config as unknown as HtmlConfig), listSelector: requireString(ctx.config, "listSelector") };
  const r = await ctx.fetcher.get(ctx.url, { validators: ctx.validators });
  if (r.notModified) return { jobs: [], notModified: true, validators: r.validators };
  const now = new Date(ctx.now ?? Date.now());
  let jobs = parseHtmlList(r.text, r.url, cfg, now);
  for (const extra of cfg.extraPages ?? []) {
    const e = await ctx.fetcher.get(new URL(extra, r.url).href);
    jobs = jobs.concat(parseHtmlList(e.text, e.url, cfg, now));
  }
  const pg = cfg.pagination;
  if (pg) {
    const step = pg.step ?? 1;
    const seen = new Set(jobs.map((j) => j.url));
    for (let n = pg.start ?? 2; n < (pg.start ?? 2) + (pg.maxPages ?? 10); n++) {
      const url = new URL(pg.template.replace("{n}", String(n)).replace("{offset}", String((n - 1) * step)), r.url).href;
      let page: RawJob[];
      try {
        const e = await ctx.fetcher.get(url);
        page = parseHtmlList(e.text, e.url, cfg, now).filter((j) => !seen.has(j.url));
      } catch {
        break; // past the last page (404) or a transient error: keep what we have
      }
      if (page.length === 0) break;
      for (const j of page) seen.add(j.url);
      jobs = jobs.concat(page);
    }
  }
  return { jobs, validators: r.validators };
};
