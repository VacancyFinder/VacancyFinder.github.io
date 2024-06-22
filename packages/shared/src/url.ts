/** Placeholder text used in the CSE source file instead of a URL. Never fetch it. */
export const CAREER_PAGE_PLACEHOLDER = "Check official website / job portals";

/** True only for absolute http(s) URLs that parse. */
export function isHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Registrable-ish domain for matching: lowercase host without leading "www.". */
export function domainOf(value: string | null | undefined): string | null {
  if (!value || !value.trim()) return null;
  const raw = value.trim();
  try {
    const u = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`);
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Hosts that serve many unrelated companies (job boards, ATS vendors, social sites).
 * Sharing one of these says nothing about ownership, so they are never used to
 * match companies across lists or to derive parent groups.
 */
export const SHARED_HOSTS = [
  "lever.co",
  "greenhouse.io",
  "workable.com",
  "smartrecruiters.com",
  "teamtailor.com",
  "myworkdayjobs.com",
  "bamboohr.com",
  "recruitee.com",
  "ashbyhq.com",
  "zohorecruit.com",
  "linkedin.com",
  "facebook.com",
  "google.com",
  "topjobs.lk",
  "xpress.jobs",
] as const;

/** True if `domain` (as returned by domainOf) is, or is under, a shared host. */
export function isSharedHost(domain: string | null | undefined): boolean {
  if (!domain) return false;
  return SHARED_HOSTS.some((h) => domain === h || domain.endsWith(`.${h}`));
}

/** domainOf, but null for shared hosts: safe to use as an ownership signal. */
export function ownerDomainOf(value: string | null | undefined): string | null {
  const d = domainOf(value);
  return d && !isSharedHost(d) ? d : null;
}

/**
 * Canonical form of a careers PAGE URL (used to dedupe crawl targets).
 * Lowercase host without www, https, no hash, no trailing slash.
 * Query is kept: some career pages use it to select content.
 * (Job-listing URL canonicalisation is per-adapter and lives in the crawler.)
 */
export function canonicalCareersUrl(value: string): string {
  const u = new URL(value.trim());
  u.protocol = "https:";
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
  u.hash = "";
  let path = u.pathname.replace(/\/+$/, "");
  if (path === "") path = "/";
  return `https://${u.hostname}${path}${u.search}`;
}
