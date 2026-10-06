/**
 * Clean, crawlable URLs — shared by the app (links, canonical tags) and the build (prerendered pages,
 * sitemap). No DOM or Vite-only APIs here: the build imports this file in Node.
 */
import { FIELD_LABELS, FIELD_SLUGS, type FieldSlug } from "@rekiya/shared/constants";

/** Canonical origin. A custom domain is set at build time with SITE_URL. */
export const DEFAULT_SITE_URL = "https://vacancyfinder.github.io";

export const SITE_NAME = "Rekiya";
export const SITE_TAGLINE = "Latest job vacancies in Sri Lanka";

/** "Senior Engineer – Data (Colombo)" → "senior-engineer-data-colombo" (ASCII, ≤ 70 chars, whole words). */
export function slugify(s: string, max = 70): string {
  const slug = s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length <= max) return slug;
  const cut = slug.slice(0, max);
  return cut.slice(0, cut.lastIndexOf("-") > 20 ? cut.lastIndexOf("-") : max).replace(/-+$/, "");
}

/** Short id in job URLs: 12 hex chars of the sha1 id (48 bits — no collisions at this scale). */
export const JOB_KEY_LEN = 12;

/** /job/senior-react-developer-at-wso2-3f2a9c1b7d4e/ */
export function jobPath(job: { id: string; title: string }, companyName: string): string {
  const words = slugify(`${job.title} at ${companyName}`);
  return `/job/${words ? `${words}-` : ""}${job.id.slice(0, JOB_KEY_LEN)}/`;
}

/** The id prefix (or a full legacy 40-char id) from the :key segment of a job URL. */
export function jobKeyFromParam(param: string): string {
  const p = param.toLowerCase();
  if (/^[0-9a-f]{40}$/.test(p)) return p;
  const m = p.match(/([0-9a-f]{12})$/);
  return m ? m[1]! : p;
}

export const matchesJobKey = (id: string, key: string) => (key.length === 40 ? id === key : id.startsWith(key));

export const fieldPath = (f: FieldSlug) => `/jobs/${f}/`;
export const companyPath = (slug: string) => `/companies/${slug}/`;
export const INTERNSHIPS_PATH = "/internships/";
/** Internships, traineeships and intern-level roles: what someone searching "internships in Sri Lanka" wants. */
export const isInternship = (j: { type: string; seniority: string }) =>
  j.type === "internship" || j.seniority === "intern" || j.seniority === "trainee";
export const isFieldSlug = (s: string | undefined): s is FieldSlug => !!s && (FIELD_SLUGS as readonly string[]).includes(s);

/** Absolute canonical URL for a path. */
export const absUrl = (siteUrl: string, path: string) => `${siteUrl.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;

// ---- page copy shared by the prerenderer and the app's <head> --------------------------------------------

export interface PageMeta {
  title: string;
  description: string;
}

const clip = (s: string, n = 158) => (s.length <= n ? s : `${s.slice(0, n - 1).replace(/\s+\S*$/, "")}…`);

export const HOME_META = (open: number, companies: number): PageMeta => ({
  title: `Jobs in Sri Lanka — ${open ? `${open.toLocaleString("en")} ` : ""}Latest Vacancies Updated Every 3 Hours | ${SITE_NAME}`,
  description: clip(
    `Search ${open ? `${open.toLocaleString("en")} ` : ""}open job vacancies in Sri Lanka from ${companies || "leading"} employers' career pages — IT, banking, finance, marketing, engineering & more. Updated every 3 hours.`,
  ),
});

export const JOBS_META = (open: number): PageMeta => ({
  title: `All Job Vacancies in Sri Lanka (${open.toLocaleString("en")} open) | ${SITE_NAME}`,
  description: clip(
    `Browse ${open.toLocaleString("en")} open jobs in Sri Lanka, newest first. Filter by field, experience level, remote or hybrid, internship and company. Apply directly on each employer's website.`,
  ),
});

export const FIELD_META = (f: FieldSlug, n: number): PageMeta => ({
  title: `${FIELD_LABELS[f]} Jobs in Sri Lanka (${n} open) | ${SITE_NAME}`,
  description: clip(
    `${n} open ${FIELD_LABELS[f]} vacancies in Sri Lanka from company career pages — updated every 3 hours. See entry-level to senior roles and apply on the employer's own site.`,
  ),
});

/** "Colombo · Kandy" → "Colombo · Kandy"; "Sri Lanka" alone adds nothing after "Sri Lanka". */
export const placeText = (location: string) =>
  location
    .split(" · ")
    .filter((l) => l && !/^sri lanka$/i.test(l.trim()))
    .join(", ");

export const JOB_META = (j: { title: string; location: string; snippet: string }, company: string): PageMeta => {
  const place = placeText(j.location);
  return {
    title: `${j.title} — ${company}, ${place ? place.split(", ")[0] : "Sri Lanka"} | ${SITE_NAME}`,
    description: clip(
      `${j.title} job at ${company}${place ? ` in ${place}` : ""}, Sri Lanka. ${j.snippet || "See the role and apply on the company's own careers page."}`
        .replace(/\s+/g, " ")
        .trim(),
    ),
  };
};

export const COMPANY_META = (name: string, n: number): PageMeta => ({
  title: `${name} Jobs & Careers in Sri Lanka${n ? ` (${n} open)` : ""} | ${SITE_NAME}`,
  description: clip(
    n
      ? `${n} open job vacancies at ${name}, taken from its official careers page and updated every 3 hours. See the roles and apply on ${name}'s own site.`
      : `Careers at ${name}, Sri Lanka. Rekiya checks its official careers page every 3 hours — see new vacancies as soon as they're posted.`,
  ),
});

export const COMPANIES_META = (n: number): PageMeta => ({
  title: `Companies Hiring in Sri Lanka — ${n} Employers | ${SITE_NAME}`,
  description: clip(
    `Directory of ${n} Sri Lankan employers — every CSE-listed company plus leading tech firms — with links to their career pages and current open jobs.`,
  ),
});

export const INTERNSHIPS_META = (n: number): PageMeta => ({
  title: `Internships in Sri Lanka ${new Date().getFullYear()} — ${n ? `${n} ` : ""}Open Internships & Trainee Jobs | ${SITE_NAME}`,
  description: clip(
    `${n ? `${n} ` : ""}internships and trainee jobs in Sri Lanka from company career pages — IT, software, finance, marketing, engineering & more. Updated every 3 hours.`,
  ),
});

export const INSIGHTS_META: PageMeta = {
  title: `Sri Lanka Job Market Insights — Who's Hiring Now | ${SITE_NAME}`,
  description:
    "Live statistics on job vacancies in Sri Lanka: the most in-demand fields, experience levels, remote and hybrid work, internships and the top hiring companies.",
};
