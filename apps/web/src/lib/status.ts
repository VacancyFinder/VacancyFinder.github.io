/**
 * System status: is the website up, is the job data fresh, is the 3-hour sync running, can the career pages be
 * read, and is the website serving the latest data? Pure functions so the status page and tests share them.
 */

/** Written to /build.json by every build (see build/data-plugin.ts). */
export interface BuildInfo {
  id: string;
  builtAt: string;
  commit: string | null;
  runUrl: string | null;
  event: string | null;
  /** ok = this build carries a fresh crawl · failed = the crawl failed, previous data kept · skipped = rebuild only. */
  sync: "ok" | "failed" | "skipped" | "local";
  dataGeneratedAt: string;
  /** GitHub Pages source: "workflow" (correct) or "legacy" (branch builds race the deploys). */
  pagesSource: string | null;
}

/** The fields we use from GitHub's workflow-runs API. */
export interface WorkflowRun {
  id: number;
  status: string; // queued | in_progress | completed | …
  conclusion: string | null; // success | failure | cancelled | skipped | …
  event: string;
  created_at: string;
  run_started_at?: string;
  updated_at: string;
  html_url: string;
}

export interface TargetHealth {
  target: string;
  url: string;
  lastError: string | null;
  consecutiveFailures: number;
  lastSuccessAt: string | null;
  suspect?: boolean;
}

export type Level = "ok" | "warn" | "down" | "unknown";

export interface Component {
  key: "website" | "freshness" | "automation" | "sources" | "publishing";
  name: string;
  level: Level;
  summary: string;
  detail?: string;
}

export interface StatusInput {
  now: number;
  syncEveryMs: number;
  build: BuildInfo | null;
  meta: { generatedAt: string; totals: { targets: number; targetsOk: number } } | null;
  health: Record<string, TargetHealth> | null;
  /** Latest crawl-and-deploy runs, newest first; null when GitHub couldn't be reached. */
  runs: WorkflowRun[] | null;
  /** generatedAt of the data committed to the repository; null when unknown. */
  repoGeneratedAt: string | null;
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const RANK: Record<Level, number> = { unknown: 0, ok: 1, warn: 2, down: 3 };

/** "45 min", "3 h 5 min", "2 days". */
export function duration(ms: number): string {
  const m = Math.max(0, Math.round(ms / MIN));
  if (m < 60) return `${m} min`;
  if (m < 48 * 60) return m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} h`;
  return `${Math.round(m / 1440)} days`;
}

/** Wall-clock time in Sri Lanka: "2:43 pm". */
export const colomboTime = (iso: string | number) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Colombo" }).toLowerCase();

export const runDurationMs = (r: WorkflowRun) => Date.parse(r.updated_at) - Date.parse(r.run_started_at ?? r.created_at);

/**
 * Runs that did something. The backup cron checks twice an hour and finishes in well under two minutes when no
 * sync is due; those checks are noise in the history.
 */
export const meaningfulRuns = (runs: WorkflowRun[]) =>
  runs.filter((r) => r.status !== "completed" || r.conclusion !== "success" || r.event !== "schedule" || runDurationMs(r) > 2 * MIN);

export const isRunning = (r: WorkflowRun) => r.status !== "completed";

export function runLabel(r: WorkflowRun): string {
  if (isRunning(r)) return r.status === "queued" ? "Queued" : "Running";
  switch (r.conclusion) {
    case "success":
      return "Succeeded";
    case "failure":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return r.conclusion ? r.conclusion[0]!.toUpperCase() + r.conclusion.slice(1).replace(/_/g, " ") : "Unknown";
  }
}

export const triggerLabel = (event: string) =>
  ({ schedule: "Schedule", workflow_dispatch: "Timer/manual", push: "Site update" })[event] ?? event;

export function computeStatus(s: StatusInput): { overall: Level; headline: string; components: Component[] } {
  const comps: Component[] = [];

  // 1. Website: this page loaded, so it's up.
  comps.push({
    key: "website",
    name: "Website",
    level: "ok",
    summary: "Online",
    detail: s.build ? `Current version published ${duration(s.now - Date.parse(s.build.builtAt))} ago.` : undefined,
  });

  // 2. Job data freshness.
  const generated = s.meta ? Date.parse(s.meta.generatedAt) : NaN;
  if (!s.meta || !(generated > 0)) {
    comps.push({ key: "freshness", name: "Job data", level: "unknown", summary: "Not collected yet" });
  } else {
    const age = s.now - generated;
    const level: Level = age <= s.syncEveryMs + 45 * MIN ? "ok" : age <= 2 * s.syncEveryMs ? "warn" : "down";
    const next = generated + s.syncEveryMs;
    comps.push({
      key: "freshness",
      name: "Job data",
      level,
      summary: level === "ok" ? "Up to date" : level === "warn" ? "Update is late" : "Out of date",
      detail:
        `Last updated ${duration(age)} ago (${colomboTime(generated)} Sri Lanka time). ` +
        (next > s.now ? `Next update around ${colomboTime(next)}.` : "The next update is due now."),
    });
  }

  // 3. The automatic 3-hour sync (GitHub Actions).
  if (!s.runs) {
    comps.push({ key: "automation", name: "Automatic sync", level: "unknown", summary: "Couldn't reach GitHub to check" });
  } else {
    const runs = meaningfulRuns(s.runs);
    const running = runs.find(isRunning);
    const done = runs.filter((r) => !isRunning(r) && r.conclusion !== "cancelled" && r.conclusion !== "skipped");
    const failedInRow = done.findIndex((r) => r.conclusion !== "failure");
    const fails = failedInRow === -1 ? done.length : failedInRow;
    const last = done[0];
    let level: Level = "ok";
    let summary = "Running every 3 hours";
    if (fails >= 2) {
      level = "down";
      summary = `The last ${fails} sync attempts failed`;
    } else if (fails === 1 || s.build?.sync === "failed") {
      level = "warn";
      summary = "The last sync attempt failed — a retry is scheduled";
    } else if (!last) {
      level = "unknown";
      summary = "No recent runs";
    }
    if (running) summary = level === "ok" ? "Syncing now" : `${summary} · syncing now`;
    comps.push({
      key: "automation",
      name: "Automatic sync",
      level,
      summary,
      detail: last ? `Last run ${duration(s.now - Date.parse(last.updated_at))} ago: ${runLabel(last).toLowerCase()}.` : undefined,
    });
  }

  // 4. Career pages.
  if (s.meta && s.meta.totals.targets > 0) {
    const { targets, targetsOk } = s.meta.totals;
    const ratio = targetsOk / targets;
    const failing = Object.values(s.health ?? {}).filter((h) => h.consecutiveFailures > 0).length;
    comps.push({
      key: "sources",
      name: "Career pages",
      level: ratio >= 0.9 ? "ok" : ratio >= 0.6 ? "warn" : "down",
      summary: `${targetsOk} of ${targets} read successfully`,
      detail: failing ? `${failing} couldn't be read on the last sync; their previous jobs stay listed until they recover.` : undefined,
    });
  } else {
    comps.push({ key: "sources", name: "Career pages", level: "unknown", summary: "No crawl results yet" });
  }

  // 5. Publishing: is the website serving the newest data that was collected?
  const repo = s.repoGeneratedAt ? Date.parse(s.repoGeneratedAt) : NaN;
  if (!(repo > 0) || !(generated > 0)) {
    comps.push({ key: "publishing", name: "Publishing", level: "unknown", summary: "Couldn't compare with the latest data" });
  } else {
    const behind = repo - generated;
    const level: Level = behind <= 20 * MIN ? "ok" : behind <= 2 * HOUR ? "warn" : "down";
    comps.push({
      key: "publishing",
      name: "Publishing",
      level: s.build?.pagesSource === "legacy" && level === "ok" ? "warn" : level,
      summary: level === "ok" ? "Website shows the latest data" : `Website is ${duration(behind)} behind the latest data`,
      detail:
        s.build?.pagesSource === "legacy"
          ? "Site owner: set Settings → Pages → Source to “GitHub Actions” so deployments don't collide."
          : undefined,
    });
  }

  const overall = comps.reduce<Level>((w, c) => (RANK[c.level] > RANK[w] ? c.level : w), "unknown");
  const worst = comps.find((c) => c.level === overall);
  const headline =
    overall === "ok" || overall === "unknown"
      ? "All systems operational"
      : overall === "warn"
        ? `Minor issue: ${worst!.name.toLowerCase()} — ${worst!.summary.toLowerCase()}`
        : `Problem: ${worst!.name.toLowerCase()} — ${worst!.summary.toLowerCase()}`;
  return { overall, headline, components: comps };
}

/** Quick check for the footer without calling GitHub: just how old the data is. */
export function freshnessLevel(generatedAt: string, syncEveryMs: number, now = Date.now()): Level {
  const t = Date.parse(generatedAt);
  if (!(t > 0)) return "unknown";
  const age = now - t;
  return age <= syncEveryMs + 45 * MIN ? "ok" : age <= 2 * syncEveryMs ? "warn" : "down";
}
