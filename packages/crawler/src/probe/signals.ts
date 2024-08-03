import * as cheerio from "cheerio";

/** ATS / job-board hosts and how to read the account id from a URL. */
export const ATS_PATTERNS: { ats: string; re: RegExp }[] = [
  { ats: "lever", re: /https?:\/\/(?:jobs|api)\.(?:eu\.)?lever\.co\/(?:v0\/postings\/)?([\w.-]+)/i },
  { ats: "greenhouse", re: /https?:\/\/(?:boards|job-boards)(?:\.eu)?\.greenhouse\.io\/(?:embed\/job_board(?:\/js)?\?for=)?([\w-]+)/i },
  { ats: "greenhouse", re: /boards-api\.greenhouse\.io\/v1\/boards\/([\w-]+)/i },
  { ats: "workable", re: /https?:\/\/apply\.workable\.com\/(?:api\/v\d\/(?:widget\/)?accounts\/)?([\w-]+)/i },
  { ats: "workable", re: /https?:\/\/([\w-]+)\.workable\.com/i },
  { ats: "smartrecruiters", re: /https?:\/\/(?:careers|jobs)\.smartrecruiters\.com\/([\w-]+)/i },
  { ats: "teamtailor", re: /https?:\/\/([\w-]+)\.teamtailor\.com/i },
  { ats: "workday", re: /https?:\/\/([\w-]+)\.(wd\d+)\.myworkdayjobs\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?([\w-]+)/i },
  { ats: "bamboohr", re: /https?:\/\/([\w-]+)\.bamboohr\.com/i },
  { ats: "recruitee", re: /https?:\/\/([\w-]+)\.recruitee\.com/i },
  { ats: "ashby", re: /https?:\/\/jobs\.ashbyhq\.com\/([\w-]+)/i },
  { ats: "zohorecruit", re: /https?:\/\/([\w-]+)\.zohorecruit\.com/i },
  { ats: "successfactors", re: /https?:\/\/[\w.-]*successfactors\.(?:com|eu)[^"'\s]*/i },
  { ats: "oracle-hcm", re: /https?:\/\/[\w.-]*\.oraclecloud\.com\/hcmUI\/CandidateExperience[^"'\s]*/i },
  { ats: "hrmhive", re: /https?:\/\/[\w.-]*hrmhive[\w.-]*/i },
  { ats: "topjobs", re: /https?:\/\/(?:www\.)?topjobs\.lk[^"'\s]*/i },
  { ats: "xpressjobs", re: /https?:\/\/(?:www\.)?xpress\.jobs[^"'\s]*/i },
  { ats: "linkedin-jobs", re: /https?:\/\/(?:[\w]+\.)?linkedin\.com\/(?:company\/[\w-]+\/jobs|jobs\/[^"'\s]*)/i },
  { ats: "google-form", re: /https?:\/\/(?:docs\.google\.com\/forms|forms\.gle)\/[^"'\s]*/i },
];

export const CAREER_WORDS =
  /\b(careers?|jobs?|vacanc(?:y|ies)|join(?:\s|-)?(?:us|our team)|work(?:\s|-)with(?:\s|-)us|opportunit(?:y|ies)|openings?|hiring|recruit\w*)\b/i;

export interface AtsHit {
  ats: string;
  id: string;
  url: string;
}

export interface PageSignals {
  title: string;
  textLength: number;
  jsonLdJobPostings: number;
  jsonLdTypes: string[];
  ats: AtsHit[];
  iframes: string[];
  pdfLinks: number;
  imageHeavy: boolean;
  jobishLinks: { text: string; href: string }[];
  emails: string[];
  hints: string[];
  likelyJsRendered: boolean;
}

function collectLdTypes(node: unknown, out: string[]): void {
  if (Array.isArray(node)) {
    for (const n of node) collectLdTypes(n, out);
    return;
  }
  if (!node || typeof node !== "object") return;
  const o = node as Record<string, unknown>;
  const t = o["@type"];
  if (typeof t === "string") out.push(t);
  else if (Array.isArray(t)) out.push(...t.filter((x): x is string => typeof x === "string"));
  if (o["@graph"]) collectLdTypes(o["@graph"], out);
  if (o.itemListElement) collectLdTypes(o.itemListElement, out);
  if (o.item) collectLdTypes(o.item, out);
}

export function jsonLdBlocks($: cheerio.CheerioAPI): unknown[] {
  const out: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text().trim();
    if (!raw) return;
    try {
      out.push(JSON.parse(raw));
    } catch {
      // Some sites emit invalid JSON-LD (trailing commas, raw newlines in strings). Skip it.
    }
  });
  return out;
}

export function extractSignals(html: string, baseUrl: string): PageSignals {
  const $ = cheerio.load(html);
  const ldTypes: string[] = [];
  for (const b of jsonLdBlocks($)) collectLdTypes(b, ldTypes);

  const ats = new Map<string, AtsHit>();
  for (const p of ATS_PATTERNS) {
    const re = new RegExp(p.re.source, `${p.re.flags.replace("g", "")}g`);
    for (const m of html.matchAll(re)) {
      const id = m.slice(1).filter(Boolean).join("/") || m[0];
      const key = `${p.ats}:${id.toLowerCase()}`;
      if (!ats.has(key)) ats.set(key, { ats: p.ats, id, url: m[0] });
    }
  }

  const abs = (href: string) => {
    try {
      return new URL(href, baseUrl).href;
    } catch {
      return href;
    }
  };
  const jobishLinks: { text: string; href: string }[] = [];
  let pdfLinks = 0;
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (/\.pdf(\?|#|$)/i.test(href)) pdfLinks++;
    if ((CAREER_WORDS.test(text) || /career|job|vacanc|position|opening|apply/i.test(href)) && jobishLinks.length < 40) {
      jobishLinks.push({ text: text.slice(0, 80), href: abs(href) });
    }
  });

  const emails = [...new Set(html.match(/[\w.+-]+@[\w-]+\.[\w.-]*[a-z]{2,}/gi) ?? [])]
    .filter((e) => !/\.(png|jpe?g|gif|svg|webp)$/i.test(e) && !/sentry|example|wixpress/i.test(e))
    .slice(0, 10);

  const hints: string[] = [];
  if (/wp-content|wp-json/i.test(html)) hints.push("wordpress");
  if (/elementor/i.test(html)) hints.push("elementor");
  if (/__NEXT_DATA__/.test(html)) hints.push("nextjs");
  if (/ng-version|ng-app/i.test(html)) hints.push("angular");
  if (/data-reactroot|id="root"|id="app"/i.test(html)) hints.push("spa-root");
  if (/wix\.com|wixstatic/i.test(html)) hints.push("wix");
  if (/squarespace/i.test(html)) hints.push("squarespace");
  if (/drupal/i.test(html)) hints.push("drupal");
  if (/cloudflare/i.test(html) && /challenge|cf-chl/i.test(html)) hints.push("cloudflare-challenge");

  $("script,style,noscript,svg").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim();
  const imgs = $("img").length;

  return {
    title: $("title").first().text().replace(/\s+/g, " ").trim().slice(0, 150),
    textLength: text.length,
    jsonLdJobPostings: ldTypes.filter((t) => t === "JobPosting").length,
    jsonLdTypes: [...new Set(ldTypes)],
    ats: [...ats.values()],
    iframes: $("iframe[src]")
      .map((_, el) => abs($(el).attr("src") ?? ""))
      .get()
      .slice(0, 10),
    pdfLinks,
    imageHeavy: imgs > 5 && text.length < 1500,
    jobishLinks,
    emails,
    hints,
    likelyJsRendered: text.length < 400,
  };
}
