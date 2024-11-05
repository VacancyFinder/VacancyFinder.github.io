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
 *   skipTitlePattern    regex of titles to ignore ("Apply now", "No vacancies"…)
 *   titleStripPattern   regex removed from titles (e.g. reference codes)
 *   extraPages          more pages with the same layout (pagination)
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
}

function slugify(s: string, max = 80): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, max);
}

export function parseHtmlList(html: string, pageUrl: string, cfg: HtmlConfig): RawJob[] {
  const $ = cheerio.load(html);
  const out: RawJob[] = [];
  const skip = cfg.skipTitlePattern ? new RegExp(cfg.skipTitlePattern, "i") : null;
  const strip = cfg.titleStripPattern ? new RegExp(cfg.titleStripPattern, "gi") : null;
  const linkRe = cfg.linkPattern ? new RegExp(cfg.linkPattern, "i") : null;
  const pageBase = pageUrl.split("#")[0]!;
  const text = (root: cheerio.Cheerio<AnyNode>, sel?: string) => (sel ? root.find(sel).first().text().replace(/\s+/g, " ").trim() : "");

  const readItem = (node: AnyNode, department: string | null) => {
    const $n = $(node);
    let title = (cfg.titleSelector ? text($n, cfg.titleSelector) : $n.text()).replace(/\s+/g, " ").trim();
    if (strip) title = title.replace(strip, "").trim();
    if (!title || title.length < 3 || title.length > 200 || skip?.test(title)) return;

    let url: string | null = null;
    let description = cfg.descriptionSelector ? text($n, cfg.descriptionSelector) || null : null;
    const anchor = cfg.anchorAttr ? $n.attr(cfg.anchorAttr) : undefined;
    if (anchor) {
      url = `${pageBase}#job-${slugify(anchor, 200)}`; // never truncate: anchors tell listings apart
      if (!description) {
        const target = $(`[id="${anchor.replace(/"/g, "")}"]`).first();
        description = target.length ? target.text().replace(/\s+/g, " ").trim() || null : null;
      }
    } else {
      const $a = cfg.linkSelector ? $n.find(cfg.linkSelector).first() : $n.is("a") ? $n : $n.find("a[href]").first();
      url = absUrl($a.attr("href"), pageUrl);
      if (url && (url.split("#")[0] === pageBase || (linkRe && !linkRe.test(url)))) url = null;
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
  let jobs = parseHtmlList(r.text, r.url, cfg);
  for (const extra of cfg.extraPages ?? []) {
    const e = await ctx.fetcher.get(new URL(extra, r.url).href);
    jobs = jobs.concat(parseHtmlList(e.text, e.url, cfg));
  }
  return { jobs, validators: r.validators };
};
