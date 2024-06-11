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
