import type { CacheValidators, PoliteFetcher } from "../http/fetcher.js";

/** A listing as read from a source, before normalisation and classification. */
export interface RawJob {
  title: string;
  /** Absolute URL of the original listing (where "Apply" goes). */
  url: string;
  location?: string | null;
  /** HTML or text; only a ≤300-char snippet is ever stored. */
  description?: string | null;
  postedAt?: string | number | null;
  /** Free text such as "Full-time", "Contract". */
  employmentType?: string | null;
  /** Free text such as "Remote", "Hybrid". */
  workplace?: string | null;
  department?: string | null;
}

export interface AdapterContext {
  fetcher: PoliteFetcher;
  /** The careers page URL for this target. */
  url: string;
  config: Record<string, unknown>;
  /** Validators from the last successful run, for If-None-Match / If-Modified-Since. */
  validators?: CacheValidators;
  log: (msg: string) => void;
  /** The crawl's clock (ms) for closing-date checks, so a run — and its tests — use one consistent "now". */
  now?: number;
}

export interface AdapterResult {
  jobs: RawJob[];
  /** The source answered 304 Not Modified: keep the previous jobs as they are. */
  notModified?: boolean;
  validators?: CacheValidators;
}

export type AdapterFn = (ctx: AdapterContext) => Promise<AdapterResult>;

export class AdapterConfigError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "AdapterConfigError";
  }
}

export function requireString(config: Record<string, unknown>, key: string): string {
  const v = config[key];
  if (typeof v !== "string" || !v.trim()) throw new AdapterConfigError(`adapterConfig.${key} is required`);
  return v.trim();
}

export function optString(config: Record<string, unknown>, key: string): string | undefined {
  const v = config[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export function absUrl(href: string | null | undefined, base: string): string | null {
  if (!href) return null;
  try {
    const u = new URL(href, base);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}
