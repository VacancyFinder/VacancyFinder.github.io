import { FIELD_LABELS, type FieldSlug, type Job } from "@rekiya/shared";

export const SITE_URL = "https://vacancyfinder.github.io/";
const MAX_ITEMS = 50;

const esc = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

/** RSS 2.0 feed of the newest open jobs in one field. */
export function fieldFeed(field: FieldSlug, jobs: Job[], companyName: (slug: string) => string, builtAt: string): string {
  const items = [...jobs]
    .filter((j) => j.status === "open")
    .sort((a, b) => b.firstSeenAt.localeCompare(a.firstSeenAt))
    .slice(0, MAX_ITEMS)
    .map((j) => {
      const company = companyName(j.company);
      const desc = [company, j.location, j.snippet].filter(Boolean).join(" — ");
      return [
        "    <item>",
        `      <title>${esc(`${j.title} — ${company}`)}</title>`,
        `      <link>${esc(j.url)}</link>`,
        `      <guid isPermaLink="false">${j.id}</guid>`,
        `      <pubDate>${new Date(j.firstSeenAt).toUTCString()}</pubDate>`,
        `      <description>${esc(desc)}</description>`,
        "    </item>",
      ].join("\n");
    });
  const label = FIELD_LABELS[field];
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${esc(`Rekiya — ${label} jobs in Sri Lanka`)}</title>`,
    `    <link>${SITE_URL}#/jobs?fields=${field}</link>`,
    `    <atom:link href="${SITE_URL}feeds/${field}.xml" rel="self" type="application/rss+xml"/>`,
    `    <description>${esc(`New ${label} vacancies from Sri Lankan company career pages.`)}</description>`,
    "    <language>en</language>",
    `    <lastBuildDate>${new Date(builtAt).toUTCString()}</lastBuildDate>`,
    ...items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}
