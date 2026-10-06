/**
 * Build-time SEO: a real HTML page for every public route (so search engines and AI crawlers that don't run
 * JavaScript see the content), plus sitemap.xml, robots.txt, llms.txt / llms-full.txt, 404.html and the list
 * of fresh URLs to ping IndexNow with. The live app replaces the prerendered markup on its first render.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  FIELD_DESCRIPTIONS,
  FIELD_LABELS,
  FIELD_SLUGS,
  INDUSTRY_LABELS,
  JOB_TYPE_LABELS,
  SENIORITY_LABELS,
  WORK_MODE_LABELS,
  type FieldSlug,
  type IndustrySlug,
} from "@rekiya/shared/constants";
import type { Company, Group, Job } from "@rekiya/shared";
import {
  absUrl,
  COMPANIES_META,
  COMPANY_META,
  companyPath,
  FIELD_META,
  fieldPath,
  HOME_META,
  INSIGHTS_META,
  INTERNSHIPS_META,
  INTERNSHIPS_INTRO,
  INTERNSHIPS_PATH,
  isInternship,
  locationIntro,
  LOCATION_META,
  LOCATION_MIN_JOBS,
  locationPath,
  PLACES,
  placeSlugsOf,
  JOB_META,
  jobPath,
  JOBS_META,
  SITE_NAME,
  type PageMeta,
} from "../src/lib/paths.js";
import {
  breadcrumbLd,
  companyCrumbs,
  FAQ_TEXT,
  faqLd,
  fieldCrumbs,
  internshipCrumbs,
  jobListLd,
  locationCrumbs,
  jobPostingLd,
  ldJson,
  organizationLd,
  websiteLd,
} from "../src/lib/structured-data.js";
import type { Job as WebJob } from "../src/lib/types.js";
import { cleanSnippet, hue, initials } from "../src/lib/format.js";
import { renderOgPng, type OgCard } from "./og.js";
import { placeOf } from "../src/lib/share.js";
import { POLICY_PAGES } from "../src/lib/policies.js";

export interface SeoInput {
  outDir: string;
  siteUrl: string;
  jobs: Job[];
  companies: Company[];
  groups: Group[];
  generatedAt: string;
  /** Verification tokens for Google Search Console / Bing Webmaster Tools (repo variables). */
  verify?: { google?: string; bing?: string };
  /** Where to write the IndexNow URL list (outside the published site). */
  indexNowFile?: string;
  /** Where to write the Google Indexing API notifications for this sync (outside the published site). */
  googleIndexingFile?: string;
}

/** One sync's entry in data/changes/<day>.json. */
export interface ChangeEntry {
  at: string;
  added: { id: string; title: string; company: string }[];
  closed: { id: string; title: string; company: string }[];
}

/**
 * Google Indexing API notifications for the sync that produced this build: job pages it added (URL_UPDATED) and
 * job pages it removed (URL_DELETED — those URLs now return 404). Only JobPosting pages may use the API.
 */
export function googleIndexingUrls(
  siteUrl: string,
  change: ChangeEntry | undefined,
  generatedAt: string,
  companyName: (slug: string) => string,
  live: Set<string>,
): { updated: string[]; deleted: string[] } {
  if (!change || change.at !== generatedAt) return { updated: [], deleted: [] };
  const url = (j: { id: string; title: string; company: string }) => absUrl(siteUrl, jobPath(j, companyName(j.company)));
  return {
    updated: change.added.map(url).filter((u) => live.has(u)),
    deleted: change.closed.map(url).filter((u) => !live.has(u)),
  };
}

interface Page extends PageMeta {
  path: string;
  noindex?: boolean;
  jsonLd?: unknown[];
  body: string;
  /** Extra <head> tags (RSS alternates). */
  head?: string;
  lastmod?: string;
  priority?: number;
  /** Link-preview card (WhatsApp, Facebook, LinkedIn…). Pages without one use the site image. */
  og?: Omit<OgCard, "host">;
}

/** Where a page's preview image lives: "/" → /og/home.png, "/job/x-1/" → /og/job/x-1.png. */
export const ogImagePath = (path: string) => (path === "/" ? "/og/home.png" : `/og${path.replace(/\/+$/, "")}.png`);
const hostOf = (siteUrl: string) => siteUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "");

export const esc = (s: string) =>
  s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c]!);

const day = (iso: string) => iso.slice(0, 10);
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Colombo" });

// ---- HTML fragments (Tailwind classes the app already uses, so the CSS covers them) ----------------------

function shell(content: string): string {
  const nav = [
    ["/jobs/", "Jobs"],
    ["/companies/", "Companies"],
    ["/insights/", "Insights"],
  ]
    .map(([h, l]) => `<li><a class="rounded-lg px-3 py-2 text-sm font-medium text-brand-100 hover:bg-white/10" href="${h}">${l}</a></li>`)
    .join("");
  return `<div id="prerender" class="flex min-h-screen flex-col">
<header class="sticky top-0 z-40 bg-brand-800 text-white shadow"><div class="container-page flex h-14 items-center justify-between gap-4">
<a href="/" class="flex items-center gap-2 text-lg font-bold tracking-tight"><img src="/favicon.svg" alt="" width="28" height="28" class="rounded-md">Rekiya</a>
<nav aria-label="Main"><ul class="flex gap-1">${nav}</ul></nav></div></header>
<main class="container-page w-full flex-1 pb-16 pt-6">${content}</main>
<footer class="border-t border-slate-200 bg-white text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"><div class="container-page py-8">
<p><strong>Rekiya</strong> — the latest job vacancies in Sri Lanka, collected every 3 hours from employers' own career pages. We link to each company's listing and never handle applications.</p>
<p class="mt-2"><a class="link" href="/jobs/">All jobs</a> · <a class="link" href="/internships/">Internships</a> · <a class="link" href="/companies/">Companies</a> · <a class="link" href="/insights/">Insights</a> · <a class="link" href="/about/">About &amp; FAQ</a> · <a class="link" href="/sitemap.xml">Sitemap</a></p>
</div></footer></div>`;
}

const crumbs = (items: [string, string][]) =>
  `<nav aria-label="Breadcrumb" class="text-sm text-slate-600"><ol class="flex flex-wrap gap-1">${items
    .map(([n, p], i) =>
      i < items.length - 1 ? `<li><a class="link" href="${p}">${esc(n)}</a> /</li>` : `<li aria-current="page">${esc(n)}</li>`,
    )
    .join("")}</ol></nav>`;

function jobItem(j: Job, company: string): string {
  const facts = [
    j.location,
    j.seniority !== "unspecified" ? SENIORITY_LABELS[j.seniority] : "",
    j.workMode !== "unspecified" ? WORK_MODE_LABELS[j.workMode] : "",
    j.type !== "unspecified" ? JOB_TYPE_LABELS[j.type] : "",
  ].filter(Boolean);
  return `<li class="card p-4"><h3 class="font-semibold"><a class="hover:underline" href="${jobPath(j, company)}">${esc(j.title)}</a></h3>
<p class="text-sm text-slate-700">${esc(company)}${facts.length ? ` · ${esc(facts.join(" · "))}` : ""} · <time datetime="${day(j.postedAt ?? j.firstSeenAt)}">${fmtDate(j.postedAt ?? j.firstSeenAt)}</time></p></li>`;
}

const jobList = (jobs: Job[], name: (s: string) => string) =>
  jobs.length
    ? `<ul class="mt-4 grid gap-3">${jobs.map((j) => jobItem(j, name(j.company))).join("\n")}</ul>`
    : `<p class="mt-4">No open jobs right now.</p>`;

// ---- the document ---------------------------------------------------------------------------------------

export function renderDocument(template: string, siteUrl: string, p: Page, verify: SeoInput["verify"] = {}): string {
  const url = absUrl(siteUrl, p.path);
  const robots = p.noindex ? "noindex, follow" : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";
  let html = template
    .replace(/<html([^>]*)>/, p.body ? `<html$1 data-pr="${esc(p.path)}">` : "<html$1>")
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(p.title)}</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${esc(p.description)}$2`)
    .replace(/(<meta\s+name="robots"\s+content=")[^"]*(")/, `$1${robots}$2`)
    .replace(/(<meta\s+property="og:title"\s+content=")[^"]*(")/, `$1${esc(p.title)}$2`)
    .replace(/(<meta\s+property="og:description"\s+content=")[^"]*(")/, `$1${esc(p.description)}$2`)
    .replace(/(<meta\s+property="og:url"\s+content=")[^"]*(")/, `$1${esc(url)}$2`)
    .replace(/(<meta\s+name="twitter:title"\s+content=")[^"]*(")/, `$1${esc(p.title)}$2`)
    .replace(/(<meta\s+name="twitter:description"\s+content=")[^"]*(")/, `$1${esc(p.description)}$2`)
    .replace(/(<link\s+rel="canonical"\s+href=")[^"]*(")/, `$1${esc(url)}$2`);
  if (p.og && !p.noindex) {
    const image = absUrl(siteUrl, ogImagePath(p.path));
    html = html
      .replace(/(<meta\s+property="og:image"\s+content=")[^"]*(")/, `$1${esc(image)}$2`)
      .replace(/(<meta\s+name="twitter:image"\s+content=")[^"]*(")/, `$1${esc(image)}$2`)
      .replace(/(<meta\s+property="og:image:secure_url"\s+content=")[^"]*(")/, `$1${esc(image)}$2`)
      .replace(/(<meta\s+property="og:image:alt"\s+content=")[^"]*(")/, `$1${esc(p.og.title)}$2`);
  }
  if (p.noindex) html = html.replace(/\s*<link\s+rel="canonical"[^>]*>/, "");
  const head = [
    p.head ?? "",
    verify.google ? `<meta name="google-site-verification" content="${esc(verify.google)}" />` : "",
    verify.bing ? `<meta name="msvalidate.01" content="${esc(verify.bing)}" />` : "",
    ...(p.jsonLd ?? []).map((ld) => `<script type="application/ld+json" data-ld="page">${ldJson(ld)}</script>`),
  ]
    .filter(Boolean)
    .join("\n    ");
  html = html.replace("</head>", `    ${head}\n  </head>`);
  return html.replace(/<div id="root"><\/div>/, `<div id="root">${p.body ? shell(p.body) : ""}</div>`);
}

// ---- pages -----------------------------------------------------------------------------------------------

export function buildPages(inp: SeoInput): Page[] {
  const { siteUrl } = inp;
  const open = inp.jobs.filter((j) => j.status === "open");
  const newest = [...open].sort((a, b) => b.firstSeenAt.localeCompare(a.firstSeenAt) || a.title.localeCompare(b.title));
  const companyBySlug = new Map(inp.companies.map((c) => [c.slug, c]));
  const groupBySlug = new Map(inp.groups.map((g) => [g.slug, g]));
  const name = (s: string) => companyBySlug.get(s)?.name ?? groupBySlug.get(s)?.name ?? s;
  const website = (s: string) => companyBySlug.get(s)?.website ?? null;
  const byCompany = new Map<string, Job[]>();
  for (const j of newest) byCompany.set(j.company, [...(byCompany.get(j.company) ?? []), j]);
  // A group page lists its members' jobs too.
  const jobsFor = (slug: string) =>
    newest.filter(
      (j) => j.company === slug || companyBySlug.get(j.company)?.parentGroup === slug || companyBySlug.get(slug)?.parentGroup === j.company,
    );
  const fieldJobs = (f: FieldSlug) => newest.filter((j) => j.fields.includes(f));
  const hiring = new Set(open.map((j) => j.company)).size;
  const updated = fmtDate(inp.generatedAt);
  const pages: Page[] = [];
  const asWeb = (j: Job) => j as unknown as WebJob; // same shape; the web type is the zod-free mirror

  const fieldLinks = FIELD_SLUGS.filter((f) => fieldJobs(f).length)
    .map(
      (f) =>
        `<li><a class="pill pill-off" href="${fieldPath(f)}">${esc(FIELD_LABELS[f])} jobs <span>(${fieldJobs(f).length})</span></a></li>`,
    )
    .join("");

  // Cities with enough open jobs for a page of their own (never thin "Jobs in X" pages).
  const byPlace = new Map<string, Job[]>();
  for (const j of newest) for (const s of placeSlugsOf(j.location)) byPlace.set(s, [...(byPlace.get(s) ?? []), j]);
  const livePlaces = [...byPlace.entries()].filter(([, js]) => js.length >= LOCATION_MIN_JOBS).sort((a, b) => b[1].length - a[1].length);
  const placeLinks = livePlaces
    .map(
      ([s, js]) => `<li><a class="pill pill-off" href="${locationPath(s)}">Jobs in ${esc(PLACES[s]!)} <span>(${js.length})</span></a></li>`,
    )
    .join("");
  /** Job page → its city, field and internship hubs, so every new job gets links into (and from) the hubs. */
  const browseMore = (j: Job) => {
    const links = [
      ...placeSlugsOf(j.location)
        .filter((s) => (byPlace.get(s)?.length ?? 0) >= LOCATION_MIN_JOBS)
        .map((s) => `<a class="link" href="${locationPath(s)}">Jobs in ${esc(PLACES[s]!)}</a>`),
      ...j.fields
        .filter((f) => f !== "other")
        .map((f) => `<a class="link" href="${fieldPath(f)}">${esc(FIELD_LABELS[f])} jobs in Sri Lanka</a>`),
      ...(isInternship(j) ? [`<a class="link" href="${INTERNSHIPS_PATH}">Internships in Sri Lanka</a>`] : []),
    ];
    return links.length ? `<p class="mt-4">Browse more: ${links.join(" · ")}</p>` : "";
  };
  /** Company page: what Rekiya has seen over time — data no other page has. */
  const history = (slug: string, companyName: string) => {
    const seen = inp.jobs.filter((j) => j.company === slug);
    if (!seen.length) return "";
    const since = seen.reduce((m, j) => (j.firstSeenAt < m ? j.firstSeenAt : m), seen[0]!.firstSeenAt);
    return `<p class="mt-2">Rekiya has listed ${seen.length} vacanc${seen.length === 1 ? "y" : "ies"} from ${esc(companyName)}'s careers page since ${fmtDate(since)}.</p>`;
  };

  // Home
  const topCo = [...byCompany.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 12);
  pages.push({
    ...HOME_META(open.length, hiring),
    path: "/",
    priority: 1,
    lastmod: inp.generatedAt,
    jsonLd: [websiteLd(siteUrl), organizationLd(siteUrl), faqLd(FAQ_TEXT)],
    og: {
      eyebrow: "Let us do the searching. You do the applying.",
      title: "Latest job vacancies in Sri Lanka",
      titleWidth: 860,
      stats: [
        [open.length.toLocaleString("en"), "open jobs"],
        [String(hiring), "companies hiring"],
        [String(FIELD_SLUGS.filter((f) => fieldJobs(f).length).length), "fields"],
      ],
    },
    body: `<section class="rounded-2xl bg-brand-800 p-6 text-white sm:p-10">
<p class="text-sm font-semibold uppercase tracking-widest text-amber-300">Let us do the searching. You do the applying.</p>
<h1 class="mt-2 text-3xl font-extrabold tracking-tight sm:text-5xl">Latest job vacancies in Sri Lanka</h1>
<p class="mt-4 max-w-2xl text-lg text-brand-100">Fresh Sri Lankan job vacancies from employers' official career pages: ${open.length.toLocaleString("en")} open jobs at ${hiring} employers, updated every 3 hours (last update ${updated}). You apply directly on each employer's site.</p>
<form action="/jobs/" method="get" role="search" class="mt-6 flex max-w-xl gap-2"><label for="pr-q" class="sr-only">Search jobs</label>
<input id="pr-q" name="q" type="search" placeholder="Job title, skill or company" class="input h-12 flex-1 text-base"><button class="btn h-12 bg-amber-400 px-6 text-brand-950" type="submit">Search jobs</button></form></section>
<section class="mt-10"><h2 class="text-2xl font-bold">Latest jobs in Sri Lanka</h2>${jobList(newest.slice(0, 24), name)}<p class="mt-4"><a class="link" href="/jobs/">See all ${open.length} jobs</a></p></section>
<section class="mt-10"><h2 class="text-2xl font-bold">Browse jobs by field</h2><ul class="mt-4 flex flex-wrap gap-2">${fieldLinks}</ul></section>
<section class="mt-10"><h2 class="text-2xl font-bold">Internships and jobs by location</h2><ul class="mt-4 flex flex-wrap gap-2"><li><a class="pill pill-off" href="${INTERNSHIPS_PATH}">Internships in Sri Lanka</a></li>${placeLinks}</ul></section>
<section class="mt-10"><h2 class="text-2xl font-bold">Top hiring companies in Sri Lanka</h2><ul class="mt-4 grid gap-2 sm:grid-cols-3">${topCo
      .map(([s, js]) => `<li><a class="link" href="${companyPath(s)}">${esc(name(s))}</a> — ${js.length} open jobs</li>`)
      .join("")}</ul></section>
<section class="mt-10 max-w-3xl"><h2 class="text-2xl font-bold">Questions</h2><dl class="mt-4 grid gap-4">${FAQ_TEXT.map(
      ([q, a]) => `<div><dt class="font-semibold">${esc(q)}</dt><dd class="text-slate-700">${esc(a)}</dd></div>`,
    ).join("")}</dl></section>`,
  });

  // About (same content as home in the app; canonical is the home page)
  pages.push({
    title: `About Rekiya — How We Find Jobs in Sri Lanka | ${SITE_NAME}`,
    description:
      "How Rekiya collects job vacancies from Sri Lankan companies' own career pages every 3 hours, which fields it covers, and how to apply. Free, no sign-up.",
    path: "/about/",
    noindex: false,
    jsonLd: [faqLd(FAQ_TEXT)],
    body: `<h1 class="text-3xl font-bold">About Rekiya</h1><p class="mt-3 max-w-3xl">Rekiya (රැකියා — “jobs” in Sinhala) lists open vacancies from the official career pages of Sri Lankan companies: every company on the Colombo Stock Exchange plus leading tech employers. It respects each site's robots.txt, keeps only a short excerpt and always links to the original listing.</p>
<p class="mt-3 max-w-3xl">Read <a class="link" href="/how-it-works/">how Rekiya works</a> (sources, update frequency, closed jobs, corrections and removal), the <a class="link" href="/privacy/">privacy policy</a> and the <a class="link" href="/terms/">terms of use</a>.</p>
<dl class="mt-6 grid max-w-3xl gap-4">${FAQ_TEXT.map(([q, a]) => `<div><dt class="font-semibold">${esc(q)}</dt><dd class="text-slate-700">${esc(a)}</dd></div>`).join("")}</dl>`,
  });

  // All jobs
  pages.push({
    ...JOBS_META(open.length),
    path: "/jobs/",
    og: {
      eyebrow: "Jobs in Sri Lanka",
      title: "All job vacancies, newest first",
      subtitle: `${open.length.toLocaleString("en")} open jobs at ${hiring} employers`,
      chips: ["IT & software", "Banking & finance", "Marketing", "Engineering"],
    },
    priority: 0.9,
    lastmod: inp.generatedAt,
    jsonLd: [
      breadcrumbLd(siteUrl, [
        ["Home", "/"],
        ["Jobs", "/jobs/"],
      ]),
      jobListLd(siteUrl, "Job vacancies in Sri Lanka", newest.map(asWeb), name),
    ],
    body: `${crumbs([
      ["Home", "/"],
      ["Jobs", "/jobs/"],
    ])}<h1 class="mt-3 text-3xl font-bold">Job vacancies in Sri Lanka</h1><p class="mt-2">${open.length} open jobs, newest first. Updated ${updated}.</p>
<ul class="mt-4 flex flex-wrap gap-2">${fieldLinks}</ul>${placeLinks ? `<ul class="mt-2 flex flex-wrap gap-2">${placeLinks}</ul>` : ""}<h2 class="mt-6 text-xl font-bold">Newest vacancies</h2>${jobList(newest.slice(0, 200), name)}`,
  });

  // Fields
  for (const f of FIELD_SLUGS) {
    const list = fieldJobs(f);
    const others = FIELD_SLUGS.filter((x) => x !== f && fieldJobs(x).length).slice(0, 8);
    pages.push({
      ...FIELD_META(f, list.length),
      path: fieldPath(f),
      og: {
        eyebrow: "Jobs in Sri Lanka",
        title: `${FIELD_LABELS[f]} jobs`,
        subtitle: `${list.length} open ${list.length === 1 ? "vacancy" : "vacancies"} from company career pages`,
        chips: [...new Set(list.map((j) => name(j.company)))].slice(0, 3),
      },
      noindex: list.length === 0,
      priority: 0.8,
      lastmod: list[0]?.firstSeenAt ?? inp.generatedAt,
      head: `<link rel="alternate" type="application/rss+xml" title="${esc(FIELD_LABELS[f])} jobs in Sri Lanka" href="/feeds/${f}.xml" />`,
      jsonLd: [breadcrumbLd(siteUrl, fieldCrumbs(f)), jobListLd(siteUrl, `${FIELD_LABELS[f]} jobs in Sri Lanka`, list.map(asWeb), name)],
      body: `${crumbs(fieldCrumbs(f))}<h1 class="mt-3 text-3xl font-bold">${esc(FIELD_LABELS[f])} jobs in Sri Lanka</h1>
<p class="mt-2 max-w-3xl">${list.length} open ${esc(FIELD_LABELS[f])} vacancies (${esc(FIELD_DESCRIPTIONS[f])}) from Sri Lankan company career pages, updated ${updated}.</p>
<h2 class="mt-6 text-xl font-bold">Open ${esc(FIELD_LABELS[f])} vacancies</h2>${jobList(list, name)}<h2 class="mt-8 text-xl font-bold">Related fields</h2><ul class="mt-2 flex flex-wrap gap-2">${others
        .map((x) => `<li><a class="pill pill-off" href="${fieldPath(x)}">${esc(FIELD_LABELS[x])} jobs</a></li>`)
        .join("")}</ul>`,
    });
  }

  // Internships: one landing page for "internships in Sri Lanka" searches.
  const interns = newest.filter(isInternship);
  const internFields = [...new Set(interns.flatMap((j) => j.fields))].filter((f) => f !== "other").slice(0, 8);
  pages.push({
    ...INTERNSHIPS_META(interns.length),
    path: INTERNSHIPS_PATH,
    og: {
      eyebrow: "Internships in Sri Lanka",
      title: "Internships & trainee jobs",
      subtitle: `${interns.length} open from company career pages`,
      chips: internFields.slice(0, 3).map((f) => FIELD_LABELS[f]),
    },
    noindex: interns.length === 0,
    priority: 0.9,
    lastmod: interns[0]?.firstSeenAt ?? inp.generatedAt,
    jsonLd: [
      breadcrumbLd(siteUrl, internshipCrumbs),
      jobListLd(siteUrl, "Internships in Sri Lanka", interns.map(asWeb), name),
      faqLd(FAQ_TEXT.filter(([q]) => /internship/i.test(q))),
    ],
    body: `${crumbs(internshipCrumbs)}<h1 class="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Internships in Sri Lanka</h1>
<p class="mt-2 max-w-3xl text-slate-700">${esc(INTERNSHIPS_INTRO)}</p>
<p class="mt-3 text-sm"><a class="link" href="/jobs/?type=internship">Search and filter internships</a> · <a class="link" href="/jobs/?seniority=intern,trainee,junior">All entry-level jobs</a></p>
<h2 class="mt-6 text-xl font-bold">Open internships</h2><div class="mt-3">${jobList(interns, name)}</div>${
      internFields.length
        ? `<section class="mt-8"><h2 class="text-xl font-bold">Internships by field</h2><ul class="mt-2 flex flex-wrap gap-2">${internFields
            .map((f) => `<li><a class="pill pill-off" href="${fieldPath(f)}">${esc(FIELD_LABELS[f])}</a></li>`)
            .join("")}</ul></section>`
        : ""
    }`,
  });

  // Locations: one page per city with enough open jobs.
  for (const [slug, list] of livePlaces) {
    const place = PLACES[slug]!;
    const placeFields = [...new Set(list.flatMap((j) => j.fields))].filter((f) => f !== "other").slice(0, 8);
    const placeCos = [...new Set(list.map((j) => j.company))];
    pages.push({
      ...LOCATION_META(place, list.length),
      path: locationPath(slug),
      og: {
        eyebrow: "Jobs in Sri Lanka",
        title: `Jobs in ${place}`,
        subtitle: `${list.length} open vacancies from company career pages`,
        chips: placeCos.slice(0, 3).map(name),
      },
      priority: 0.8,
      lastmod: list[0]?.firstSeenAt ?? inp.generatedAt,
      jsonLd: [breadcrumbLd(siteUrl, locationCrumbs(slug, place)), jobListLd(siteUrl, `Jobs in ${place}`, list.map(asWeb), name)],
      body: `${crumbs(locationCrumbs(slug, place))}<h1 class="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Jobs in ${esc(place)}</h1>
<p class="mt-2 max-w-3xl text-slate-700">${esc(locationIntro(place))}</p>
<p class="mt-3 text-sm"><a class="link" href="/jobs/?location=${encodeURIComponent(place)}">Filter ${esc(place)} jobs</a></p>
<h2 class="mt-6 text-xl font-bold">Open vacancies in ${esc(place)}</h2><div class="mt-3">${jobList(list, name)}</div>
${placeFields.length ? `<section class="mt-8"><h2 class="text-xl font-bold">${esc(place)} jobs by field</h2><ul class="mt-2 flex flex-wrap gap-2">${placeFields.map((f) => `<li><a class="pill pill-off" href="${fieldPath(f)}">${esc(FIELD_LABELS[f])}</a></li>`).join("")}</ul></section>` : ""}
<section class="mt-8"><h2 class="text-xl font-bold">Employers hiring in ${esc(place)}</h2><p class="mt-2">${placeCos
        .slice(0, 20)
        .map((s) => `<a class="link" href="${companyPath(s)}">${esc(name(s))}</a>`)
        .join(" · ")}</p></section>`,
    });
  }

  // Jobs
  for (const j of newest) {
    const co = name(j.company);
    const path = jobPath(j, co);
    const about = cleanSnippet(j.title, j.snippet) || j.snippet;
    const similar = newest.filter((x) => x.id !== j.id && x.fields.some((f) => j.fields.includes(f) && f !== "other")).slice(0, 5);
    const more = (byCompany.get(j.company) ?? []).filter((x) => x.id !== j.id).slice(0, 5);
    const facts: [string, string][] = [
      ["Company", co],
      ["Location", j.location || "Sri Lanka"],
      ["Experience level", j.seniority === "unspecified" ? "Not stated" : SENIORITY_LABELS[j.seniority]],
      ["Work mode", j.workMode === "unspecified" ? "Not stated" : WORK_MODE_LABELS[j.workMode]],
      ["Job type", j.type === "unspecified" ? "Not stated" : JOB_TYPE_LABELS[j.type]],
      ["Field", j.fields.map((f) => FIELD_LABELS[f]).join(", ")],
      ["Industry", INDUSTRY_LABELS[j.industry as IndustrySlug] ?? j.industry],
      ["Posted", j.postedAt ? fmtDate(j.postedAt) : `Found ${fmtDate(j.firstSeenAt)}`],
    ];
    const jobCrumbs: [string, string][] = [
      ["Home", "/"],
      ["Jobs", "/jobs/"],
      [j.title, path],
    ];
    pages.push({
      ...JOB_META(j, co),
      path,
      og: {
        eyebrow: `Now hiring · ${FIELD_LABELS[j.fields[0] ?? "other"]}`,
        title: j.title,
        subtitle: `${co} · ${placeOf(j.location)}`,
        badge: { text: initials(co), hue: hue(j.company) },
        chips: [
          j.seniority !== "unspecified" ? SENIORITY_LABELS[j.seniority] : "",
          j.workMode !== "unspecified" ? WORK_MODE_LABELS[j.workMode] : "",
          j.type !== "unspecified" ? JOB_TYPE_LABELS[j.type] : "",
        ].filter(Boolean),
      },
      priority: 0.7,
      lastmod: j.firstSeenAt,
      jsonLd: [jobPostingLd(siteUrl, asWeb(j), { name: co, website: website(j.company) }), breadcrumbLd(siteUrl, jobCrumbs)],
      body: `${crumbs(jobCrumbs)}<article class="card mt-3 p-6"><h1 class="text-3xl font-bold">${esc(j.title)}</h1>
<p class="mt-1 text-lg"><a class="link" href="${companyPath(j.company)}">${esc(co)}</a> · ${esc(j.location || "Sri Lanka")}</p>
<p class="mt-4"><a class="btn-primary" href="${esc(j.url)}" rel="noopener" target="_blank">Apply on ${esc(co)}'s website</a></p>
${about ? `<h2 class="mt-6 text-lg font-semibold">About the role</h2><p class="mt-2">${esc(about)}</p>` : ""}
<h2 class="mt-6 text-lg font-semibold">Job details</h2><dl class="mt-2 grid gap-2 sm:grid-cols-2">${facts
        .map(([k, v]) => `<div><dt class="text-xs font-semibold uppercase text-slate-600">${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
        .join("")}</dl>
${browseMore(j)}
<p class="mt-4 text-sm text-slate-600">Rekiya found this vacancy on ${esc(co)}'s careers page and checked it was still open on ${updated}. Genuine employers never charge you to apply.</p></article>
${more.length ? `<section class="mt-8"><h2 class="text-xl font-bold">More jobs at ${esc(co)}</h2>${jobList(more, name)}</section>` : ""}
${similar.length ? `<section class="mt-8"><h2 class="text-xl font-bold">Similar jobs in Sri Lanka</h2>${jobList(similar, name)}</section>` : ""}`,
    });
  }

  // Companies directory + company pages
  const all = [
    ...inp.companies.map((c) => ({ slug: c.slug, name: c.name, industry: c.industry as IndustrySlug })),
    ...inp.groups.map((g) => ({ slug: g.slug, name: g.name, industry: "diversified" as IndustrySlug })),
  ];
  const byInd = new Map<string, typeof all>();
  for (const c of inp.companies)
    byInd.set(c.industry, [...(byInd.get(c.industry) ?? []), { slug: c.slug, name: c.name, industry: c.industry as IndustrySlug }]);
  pages.push({
    ...COMPANIES_META(inp.companies.length),
    path: "/companies/",
    priority: 0.6,
    lastmod: inp.generatedAt,
    jsonLd: [
      breadcrumbLd(siteUrl, [
        ["Home", "/"],
        ["Companies", "/companies/"],
      ]),
    ],
    body: `<h1 class="text-3xl font-bold">Companies hiring in Sri Lanka</h1><p class="mt-2">${inp.companies.length} employers — every CSE-listed company plus leading tech firms. ${hiring} have open jobs right now.</p>
${[...byInd.entries()]
  .sort((a, b) => (INDUSTRY_LABELS[a[0] as IndustrySlug] ?? a[0]).localeCompare(INDUSTRY_LABELS[b[0] as IndustrySlug] ?? b[0]))
  .map(
    ([ind, cs]) =>
      `<section class="mt-6"><h2 class="text-xl font-bold">${esc(INDUSTRY_LABELS[ind as IndustrySlug] ?? ind)}</h2><ul class="mt-2 grid gap-1 sm:grid-cols-3">${cs
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => {
          const n = jobsFor(c.slug).length;
          return `<li><a class="link" href="${companyPath(c.slug)}">${esc(c.name)}</a>${n ? ` — ${n} open` : ""}</li>`;
        })
        .join("")}</ul></section>`,
  )
  .join("\n")}`,
  });
  for (const c of all) {
    const list = jobsFor(c.slug);
    const co = companyBySlug.get(c.slug);
    const members = inp.companies.filter((m) => m.parentGroup === c.slug);
    pages.push({
      ...COMPANY_META(c.name, list.length),
      path: companyPath(c.slug),
      og: {
        eyebrow: "Careers in Sri Lanka",
        title: `${c.name}`,
        subtitle: `${list.length} open ${list.length === 1 ? "job" : "jobs"} · checked every 3 hours`,
        badge: { text: initials(c.name), hue: hue(c.slug) },
        chips: [...new Set(list.flatMap((j) => j.fields).map((f) => FIELD_LABELS[f]))].slice(0, 3),
      },
      // Thin pages (no open jobs) stay out of the index until they have some.
      noindex: list.length === 0,
      priority: 0.5,
      lastmod: list[0]?.firstSeenAt ?? inp.generatedAt,
      jsonLd: [breadcrumbLd(siteUrl, companyCrumbs(c.slug, c.name)), jobListLd(siteUrl, `Jobs at ${c.name}`, list.map(asWeb), name)],
      body: `${crumbs(companyCrumbs(c.slug, c.name))}<h1 class="mt-3 text-3xl font-bold">${esc(c.name)} jobs &amp; careers</h1>
<p class="mt-2">${esc(INDUSTRY_LABELS[c.industry] ?? c.industry)}${co?.cseSymbol ? ` · Listed on the Colombo Stock Exchange (${esc(co.cseSymbol)})` : ""}. ${list.length} open job${list.length === 1 ? "" : "s"}, checked ${updated}.</p>
${co?.careersUrl ? `<p class="mt-2"><a class="link" rel="noopener" href="${esc(co.careersUrl)}">${esc(c.name)} careers page</a></p>` : ""}
${members.length ? `<p class="mt-2">Group companies: ${members.map((m) => `<a class="link" href="${companyPath(m.slug)}">${esc(m.name)}</a>`).join(", ")}</p>` : ""}
${history(c.slug, c.name)}
${list.length ? `<h2 class="mt-6 text-xl font-bold">Open vacancies at ${esc(c.name)}</h2>` : ""}${jobList(list, name)}`,
    });
  }

  // Insights
  const count = <K extends string>(get: (j: Job) => K) => {
    const m = new Map<K, number>();
    for (const j of open) m.set(get(j), (m.get(get(j)) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const fieldsCount = FIELD_SLUGS.map((f) => [f, fieldJobs(f).length] as const)
    .filter(([, n]) => n)
    .sort((a, b) => b[1] - a[1]);
  const fieldsCountTop = fieldsCount.slice(0, 3).map(([f]) => FIELD_LABELS[f]);
  const table = (caption: string, rows: [string, string, number][]) =>
    `<table class="mt-4 w-full max-w-xl text-sm"><caption class="text-left text-lg font-semibold">${esc(caption)}</caption><tbody>${rows
      .map(
        ([l, h, n]) =>
          `<tr><td class="py-1">${h ? `<a class="link" href="${h}">${esc(l)}</a>` : esc(l)}</td><td class="text-right">${n}</td></tr>`,
      )
      .join("")}</tbody></table>`;
  pages.push({
    ...INSIGHTS_META,
    path: "/insights/",
    og: {
      eyebrow: "Job market insights",
      title: "Who's hiring in Sri Lanka right now",
      subtitle: `${open.length.toLocaleString("en")} open jobs · ${hiring} employers`,
      chips: fieldsCountTop,
    },
    priority: 0.6,
    lastmod: inp.generatedAt,
    body: `<h1 class="text-3xl font-bold">Sri Lanka job market insights</h1><p class="mt-2">${open.length} open jobs at ${hiring} employers on ${updated}.</p>
${table(
  "Jobs by field",
  fieldsCount.map(([f, n]) => [FIELD_LABELS[f], fieldPath(f), n]),
)}${table(
      "Jobs by experience level",
      count((j) => j.seniority)
        .filter(([s]) => s !== "unspecified")
        .map(([s, n]) => [SENIORITY_LABELS[s], "", n]),
    )}${table(
      "Top hiring companies",
      topCo.map(([s, js]) => [name(s), companyPath(s), js.length]),
    )}`,
  });

  // Trust pages: how it works (sources, freshness, removal), privacy, terms.
  for (const pg of POLICY_PAGES) {
    const c: [string, string][] = [
      ["Home", "/"],
      [pg.h1, pg.path],
    ];
    const para = (b: string) => esc(b).replace(/https:\/\/[^\s<]+?(?=[.,]?(\s|$))/g, (u) => `<a class="link" href="${u}">${u}</a>`);
    pages.push({
      title: pg.title,
      description: pg.description,
      path: pg.path,
      priority: pg.path === "/how-it-works/" ? 0.5 : 0.2,
      lastmod: inp.generatedAt.slice(0, 10),
      jsonLd: [breadcrumbLd(siteUrl, c)],
      body: `<article class="mx-auto max-w-3xl">${crumbs(c)}<h1 class="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">${esc(pg.h1)}</h1><p class="mt-3 text-lg text-slate-700">${esc(pg.intro)}</p>${pg.sections
        .map((s) => {
          const items = s.body.filter((b) => b.startsWith("• "));
          return `<section class="mt-8"><h2 class="text-xl font-semibold">${esc(s.heading)}</h2>${s.body
            .filter((b) => !b.startsWith("• "))
            .map((b) => `<p class="mt-2">${para(b)}</p>`)
            .join(
              "",
            )}${items.length ? `<ul class="mt-2 list-disc pl-5">${items.map((b) => `<li>${esc(b.slice(2))}</li>`).join("")}</ul>` : ""}</section>`;
        })
        .join("")}</article>`,
    });
  }

  // App-only pages: real (200) documents that never get indexed.
  for (const [path, title] of [
    ["/saved/", "Saved jobs"],
    ["/settings/", "Settings"],
    ["/onboarding/", "Choose your fields"],
    ["/status/", "System status"],
  ] as const) {
    pages.push({
      title: `${title} · ${SITE_NAME}`,
      description: HOME_META(open.length, hiring).description,
      path,
      noindex: true,
      body: "",
    });
  }
  return pages;
}

// ---- sitemap, robots, llms.txt ----------------------------------------------------------------------------

export function sitemapXml(siteUrl: string, pages: Page[]): string {
  const urls = pages
    .filter((p) => !p.noindex && p.path !== "/about/")
    .map(
      (p) =>
        `  <url><loc>${esc(absUrl(siteUrl, p.path))}</loc>${p.lastmod ? `<lastmod>${day(p.lastmod)}</lastmod>` : ""}${p.priority ? `<priority>${p.priority.toFixed(1)}</priority>` : ""}</url>`,
    );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

/** sitemap.xml is an index of two sitemaps, so Search Console reports job pages and hub pages separately. */
export const SITEMAPS = { pages: "sitemap-pages.xml", jobs: "sitemap-jobs.xml" } as const;
export const isJobPage = (p: Page) => p.path.startsWith("/job/");
export function sitemapIndexXml(siteUrl: string, lastmod: string): string {
  const entries = Object.values(SITEMAPS)
    .map((f) => `  <sitemap><loc>${esc(absUrl(siteUrl, `/${f}`))}</loc><lastmod>${lastmod}</lastmod></sitemap>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</sitemapindex>\n`;
}

export function robotsTxt(siteUrl: string): string {
  return `# Rekiya — latest job vacancies in Sri Lanka. Everyone is welcome to crawl, including AI assistants.
User-agent: *
Allow: /
Disallow: /saved/
Disallow: /settings/
Disallow: /onboarding/

# AI assistants and answer engines: please use llms.txt for a summary and llms-full.txt for today's jobs.
User-agent: GPTBot
User-agent: OAI-SearchBot
User-agent: ChatGPT-User
User-agent: ClaudeBot
User-agent: Claude-SearchBot
User-agent: Claude-User
User-agent: PerplexityBot
User-agent: Google-Extended
User-agent: Applebot-Extended
User-agent: CCBot
Allow: /

Sitemap: ${absUrl(siteUrl, "/sitemap.xml")}
`;
}

export function llmsTxt(inp: SeoInput, pages: Page[]): string {
  const open = inp.jobs.filter((j) => j.status === "open");
  const hiring = new Set(open.map((j) => j.company)).size;
  const u = (p: string) => absUrl(inp.siteUrl, p);
  const fieldLines = FIELD_SLUGS.map((f) => [f, open.filter((j) => j.fields.includes(f)).length] as const)
    .filter(([, n]) => n)
    .sort((a, b) => b[1] - a[1])
    .map(([f, n]) => `- [${FIELD_LABELS[f]} jobs in Sri Lanka](${u(fieldPath(f))}): ${n} open vacancies`);
  return `# ${SITE_NAME} — latest job vacancies in Sri Lanka

> ${SITE_NAME} (රැකියා, "jobs" in Sinhala) lists open job vacancies from the official career pages of Sri Lankan companies — every company on the Colombo Stock Exchange plus leading tech employers — refreshed every 3 hours. As of ${fmtDate(inp.generatedAt)} it lists ${open.length} open jobs at ${hiring} employers. Every listing links to the employer's own page, where candidates apply.

Facts for answering questions:
- Coverage: Sri Lanka (mostly Colombo and the Western Province, plus island-wide roles). Listings are in English.
- Freshness: crawled every 3 hours; a job is removed after it disappears from the employer's page for two checks in a row.
- Sources: employers' own career pages and official ATS systems only — not job boards or agencies.
- Cost: free, no account. ${SITE_NAME} never handles applications or asks candidates for money.
- Fields: ${FIELD_SLUGS.map((f) => FIELD_LABELS[f]).join(", ")}.

## Browse jobs
- [All job vacancies in Sri Lanka](${u("/jobs/")}): every open job, newest first, with filters
${pages
  .filter((p) => p.path.startsWith("/locations/") && !p.noindex)
  .map((p) => `- [${p.title.split(" — ")[0]}](${u(p.path)}): open vacancies in that city from employers' career pages`)
  .join("\n")}
- [Internships in Sri Lanka](${u(INTERNSHIPS_PATH)}): ${inp.jobs.filter((j) => j.status === "open" && isInternship(j)).length} open internships, traineeships and intern-level roles for students and fresh graduates
${fieldLines.join("\n")}

## Companies and market data
- [Companies hiring in Sri Lanka](${u("/companies/")}): ${inp.companies.length} employers with links to their career pages
- [Job market insights](${u("/insights/")}): open jobs by field, experience level, work mode and top employers

## Machine-readable data
- [Full list of today's open jobs](${u("/llms-full.txt")}): one line per job with title, company, location, level and link
- [jobs.json](${u("/data/jobs.json")}): all open jobs as JSON (title, company, location, fields, seniority, type, work mode, dates, original URL)
- [RSS feeds](${u("/feeds/software-engineering.xml")}): one feed per field at /feeds/<field>.xml
- [Sitemap](${u("/sitemap.xml")}): ${pages.filter((p) => !p.noindex).length} pages

## About this source
- [How Rekiya works](${u("/how-it-works/")}): where the vacancies come from, how often they're checked, how closed jobs are removed, corrections and removal
- [About and FAQ](${u("/about/")})
- [Privacy](${u("/privacy/")}) · [Terms](${u("/terms/")})
- [Source code and data](https://github.com/VacancyFinder/VacancyFinder.github.io)
`;
}

export function llmsFullTxt(inp: SeoInput): string {
  const name = new Map<string, string>([
    ...inp.groups.map((g) => [g.slug, g.name] as const),
    ...inp.companies.map((c) => [c.slug, c.name] as const),
  ]);
  const open = inp.jobs.filter((j) => j.status === "open").sort((a, b) => b.firstSeenAt.localeCompare(a.firstSeenAt));
  const lines = FIELD_SLUGS.flatMap((f) => {
    const list = open.filter((j) => j.fields[0] === f);
    if (!list.length) return [];
    return [
      "",
      `## ${FIELD_LABELS[f]} (${list.length})`,
      ...list.map((j) => {
        const co = name.get(j.company) ?? j.company;
        const bits = [
          co,
          j.location,
          j.seniority !== "unspecified" ? SENIORITY_LABELS[j.seniority] : "",
          `posted ${day(j.postedAt ?? j.firstSeenAt)}`,
        ].filter(Boolean);
        return `- [${j.title}](${absUrl(inp.siteUrl, jobPath(j, co))}) — ${bits.join(" · ")}`;
      }),
    ];
  });
  return `# ${SITE_NAME} — all open job vacancies in Sri Lanka (${fmtDate(inp.generatedAt)})\n\n> ${open.length} open jobs from Sri Lankan companies' own career pages, grouped by main field. Each link opens the job page, which links to the employer's listing.\n${lines.join("\n")}\n`;
}

// ---- entry point -----------------------------------------------------------------------------------------

export async function generateSeo(inp: SeoInput): Promise<{ pages: number; indexed: number; images: number }> {
  const template = readFileSync(resolve(inp.outDir, "index.html"), "utf8");
  const pages = buildPages(inp);
  for (const p of pages) {
    const file = p.path === "/" ? resolve(inp.outDir, "index.html") : resolve(inp.outDir, `.${p.path}`, "index.html");
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, renderDocument(template, inp.siteUrl, p, inp.verify));
  }
  // GitHub Pages serves 404.html for unknown paths: the app shell, never indexed.
  writeFileSync(
    resolve(inp.outDir, "404.html"),
    renderDocument(
      template,
      inp.siteUrl,
      { title: `Page not found · ${SITE_NAME}`, description: "", path: "/404", noindex: true, body: "" },
      inp.verify,
    ),
  );
  writeFileSync(
    resolve(inp.outDir, SITEMAPS.pages),
    sitemapXml(
      inp.siteUrl,
      pages.filter((p) => !isJobPage(p)),
    ),
  );
  writeFileSync(resolve(inp.outDir, SITEMAPS.jobs), sitemapXml(inp.siteUrl, pages.filter(isJobPage)));
  writeFileSync(resolve(inp.outDir, "sitemap.xml"), sitemapIndexXml(inp.siteUrl, day(inp.generatedAt)));
  writeFileSync(resolve(inp.outDir, "robots.txt"), robotsTxt(inp.siteUrl));
  writeFileSync(resolve(inp.outDir, "llms.txt"), llmsTxt(inp, pages));
  writeFileSync(resolve(inp.outDir, "llms-full.txt"), llmsFullTxt(inp));

  if (inp.indexNowFile) {
    // New jobs from the last day plus the hub pages that list them.
    const since = Date.parse(inp.generatedAt) - 26 * 3600_000;
    const fresh = pages.filter((p) => !p.noindex && p.path.startsWith("/job/") && p.lastmod && Date.parse(p.lastmod) >= since);
    const hubs = pages.filter((p) => !p.noindex && (p.path === "/" || p.path === "/jobs/" || p.path.match(/^\/jobs\/[a-z-]+\/$/)));
    mkdirSync(dirname(inp.indexNowFile), { recursive: true });
    writeFileSync(inp.indexNowFile, JSON.stringify([...hubs, ...fresh].map((p) => absUrl(inp.siteUrl, p.path)).slice(0, 10000)));
  }
  if (inp.googleIndexingFile) {
    const changesFile = resolve(inp.outDir, "data/changes", `${day(inp.generatedAt)}.json`);
    const entries: ChangeEntry[] = existsSync(changesFile) ? JSON.parse(readFileSync(changesFile, "utf8")) : [];
    const names = new Map<string, string>([
      ...inp.groups.map((g) => [g.slug, g.name] as const),
      ...inp.companies.map((c) => [c.slug, c.name] as const),
    ]);
    const live = new Set(pages.filter((p) => isJobPage(p) && !p.noindex).map((p) => absUrl(inp.siteUrl, p.path)));
    const urls = googleIndexingUrls(inp.siteUrl, entries.at(-1), inp.generatedAt, (s) => names.get(s) ?? s, live);
    mkdirSync(dirname(inp.googleIndexingFile), { recursive: true });
    writeFileSync(inp.googleIndexingFile, JSON.stringify(urls));
  }
  // Link-preview images for every shareable page (≈0.1 s each).
  let images = 0;
  const host = hostOf(inp.siteUrl);
  for (const p of pages) {
    if (!p.og || p.noindex) continue;
    const file = resolve(inp.outDir, `.${ogImagePath(p.path)}`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, await renderOgPng({ ...p.og, host }));
    images++;
  }
  return { pages: pages.length, indexed: pages.filter((p) => !p.noindex).length, images };
}
