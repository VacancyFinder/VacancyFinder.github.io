import type { Job } from "@rekiya/shared";

export const CLOSE_AFTER_MISSED_RUNS = 2;
export const ARCHIVE_AFTER_DAYS = 30;
export const SUSPECT_MIN_PREVIOUS = 3;

/** How a target's crawl ended this run. */
export type TargetOutcome = "ok" | "failed" | "not-modified" | "suspect" | "skipped";

export interface DiffInput {
  previous: Job[];
  /** Jobs seen this run from targets whose outcome is "ok". */
  current: Job[];
  /** Outcome for each company/group slug (from the target that crawls it). */
  outcomeOf: (companySlug: string) => TargetOutcome | undefined;
  now: string;
}

export interface DiffResult {
  jobs: Job[];
  added: Job[];
  closed: Job[];
  /** Closed more than 30 days ago: move to archive/. */
  archived: Job[];
  updated: number;
}

/** Fields refreshed from the latest crawl; identity and history fields are kept. */
const MUTABLE: (keyof Job)[] = [
  "title",
  "industry",
  "fields",
  "seniority",
  "type",
  "workMode",
  "location",
  "snippet",
  "url",
  "source",
  "postedAt",
];

export function diffJobs({ previous, current, outcomeOf, now }: DiffInput): DiffResult {
  const cur = new Map(current.map((j) => [j.id, j]));
  const seen = new Set<string>();
  const out: Job[] = [];
  const added: Job[] = [];
  const closed: Job[] = [];
  const archived: Job[] = [];
  let updated = 0;
  const cutoff = Date.parse(now) - ARCHIVE_AFTER_DAYS * 86_400_000;

  for (const prev of previous) {
    const c = cur.get(prev.id);
    if (c) {
      seen.add(prev.id);
      const next: Job = { ...prev, lastSeenAt: now, missedRuns: 0, status: "open", closedAt: null };
      for (const k of MUTABLE) (next as Record<string, unknown>)[k] = c[k];
      if (prev.status === "closed") added.push(next); // reappeared
      out.push(next);
      updated++;
      continue;
    }
    if (prev.status === "closed") {
      if (prev.closedAt && Date.parse(prev.closedAt) < cutoff) archived.push(prev);
      else out.push(prev);
      continue;
    }
    const outcome = outcomeOf(prev.company);
    if (outcome === "failed" || outcome === "suspect") {
      out.push(prev); // never overwrite good data with a failed crawl
      continue;
    }
    if (outcome === "not-modified") {
      out.push({ ...prev, lastSeenAt: now, missedRuns: 0 });
      continue;
    }
    // Crawled successfully without this job, or no longer crawled at all.
    const missedRuns = prev.missedRuns + 1;
    if (missedRuns >= CLOSE_AFTER_MISSED_RUNS || outcome === undefined || outcome === "skipped") {
      const c2: Job = { ...prev, missedRuns, status: "closed", closedAt: now };
      closed.push(c2);
      out.push(c2);
    } else {
      out.push({ ...prev, missedRuns });
    }
  }

  for (const j of current) {
    if (seen.has(j.id)) continue;
    seen.add(j.id);
    const fresh: Job = { ...j, firstSeenAt: now, lastSeenAt: now, status: "open", missedRuns: 0, closedAt: null };
    added.push(fresh);
    out.push(fresh);
  }

  out.sort((a, b) =>
    a.status === b.status ? b.firstSeenAt.localeCompare(a.firstSeenAt) || a.id.localeCompare(b.id) : a.status === "open" ? -1 : 1,
  );
  return { jobs: out, added, closed, archived, updated };
}

/** A company that had >= 3 open jobs and now returns 0 is treated as a failed crawl, not mass closure. */
export function isSuspect(previousOpen: number, currentCount: number): boolean {
  return previousOpen >= SUSPECT_MIN_PREVIOUS && currentCount === 0;
}
