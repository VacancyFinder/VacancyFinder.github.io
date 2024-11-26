/**
 * pnpm crawl — crawl every ready target, classify, diff against data/jobs.json and write /data.
 *   --only a,b   crawl only these target ids (others keep their jobs untouched)
 *   --fast       no politeness delay (local fixtures / tests only)
 */
import { appendFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pLimit from "p-limit";
import { z } from "zod";
import {
  CompaniesFile,
  CrawlTarget,
  Group,
  HealthFile,
  JobsFile,
  Overrides,
  type ChangesRun,
  type Company,
  type HealthEntry,
  type Job,
  type Meta,
} from "@rekiya/shared";
import { applyCommonConfig } from "../adapters/common.js";
import { resolveAdapter } from "../adapters/index.js";
import type { CacheValidators } from "../http/fetcher.js";
import { PoliteFetcher, RobotsDisallowedError } from "../http/fetcher.js";
import { diffJobs, isSuspect, type TargetOutcome } from "./diff.js";
import { normalizeJob, type Attribution } from "./normalize.js";
import { readJsonOr, writeData, writeIfChanged } from "./write.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const DATA_DIR = resolve(ROOT, "data");
const CACHE_PATH = resolve(ROOT, ".cache/http-cache.json");
const TARGET_TIMEOUT_MS = 6 * 60_000;
const CRAWLABLE = new Set(["ready"]);

export interface TargetRun {
  target: CrawlTarget;
  outcome: TargetOutcome;
  jobs: Job[];
  error: string | null;
  dropped: number;
  validators?: CacheValidators;
}

function args() {
  const a = process.argv.slice(2);
  const i = a.indexOf("--only");
  return { only: i >= 0 ? (a[i + 1] ?? "").split(",").filter(Boolean) : [], fast: a.includes("--fast") };
}

async function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} timed out after ${ms / 1000}s`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export interface CrawlOptions {
  dataDir?: string;
  cachePath?: string;
  /** Injected for tests; defaults to a polite fetcher. */
  fetcher?: PoliteFetcher;
  now?: string;
  only?: string[];
  fast?: boolean;
  quiet?: boolean;
}

export interface CrawlSummary {
  added: number;
  closed: number;
  open: number;
  dataChanged: boolean;
  message: string;
  runs: TargetRun[];
}

export async function main(): Promise<void> {
  const { only, fast } = args();
  const r = await runCrawl({ only, fast });
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `changed=${r.dataChanged}\nmessage=${r.message}\nadded=${r.added}\n`);
  }
}

export async function runCrawl(opts: CrawlOptions = {}): Promise<CrawlSummary> {
  const started = Date.now();
  const now = opts.now ?? new Date().toISOString();
  const DATA = opts.dataDir ?? DATA_DIR;
  const CACHE = opts.cachePath ?? CACHE_PATH;
  const only = opts.only ?? [];
  const fast = opts.fast ?? false;
  const console = opts.quiet ? { log: () => {} } : globalThis.console;

  const companies = CompaniesFile.parse(readJsonOr(resolve(DATA, "companies.json"), []));
  const groups = z.array(Group).parse(readJsonOr(resolve(DATA, "groups.json"), []));
  const targets = z.array(CrawlTarget).parse(readJsonOr(resolve(DATA, "crawl-targets.json"), []));
  const previous = JobsFile.parse(readJsonOr(resolve(DATA, "jobs.json"), []));
  const prevHealth = HealthFile.parse(readJsonOr(resolve(DATA, "health.json"), {}));
  const overrides = Overrides.parse(readJsonOr(resolve(DATA, "overrides.json"), { jobs: {}, titlePatterns: [] }));
  const httpCache = readJsonOr<Record<string, CacheValidators>>(CACHE, {});
  const bySlug = new Map(companies.map((c) => [c.slug, c]));
  void groups;

  const fetcher = opts.fetcher ?? new PoliteFetcher(fast ? { minDelayMs: 0, maxDelayMs: 0 } : { log: (m) => console.log(`  · ${m}`) });
  const outcomeBySlug = new Map<string, TargetOutcome>();
  // A company can be named by several targets (e.g. its own inactive page plus a group page that credits it).
  // An actual crawl outcome always wins over "skipped", so an inactive target can't close jobs another target found.
  const setOutcome = (slugs: string[], o: TargetOutcome) => {
    for (const s of slugs) {
      const prev = outcomeBySlug.get(s);
      if (o === "skipped" && prev && prev !== "skipped") continue;
      if (prev && prev !== "skipped" && prev !== "ok" && o === "ok") continue; // keep failed/suspect: be conservative
      outcomeBySlug.set(s, o);
    }
  };

  const limit = pLimit(6);
  const runs: TargetRun[] = await Promise.all(
    targets.map((target) =>
      limit(async (): Promise<TargetRun> => {
        const members = target.companySlugs.map((s) => bySlug.get(s)).filter((c): c is Company => !!c);
        const cfgOwner = members.find((m) => m.adapter !== "none") ?? members[0];
        const config = cfgOwner?.adapterConfig ?? {};
        const extra = (Array.isArray(config.attributeTo) ? (config.attributeTo as { company: string; pattern: string }[]) : [])
          .map((e) => ({ company: bySlug.get(e.company), pattern: new RegExp(e.pattern, "i") }))
          .filter((e): e is { company: Company; pattern: RegExp } => !!e.company);
        const slugs = [...target.companySlugs, ...(target.parentGroup ? [target.parentGroup] : []), ...extra.map((e) => e.company.slug)];
        const run: TargetRun = { target, outcome: "skipped", jobs: [], error: null, dropped: 0 };

        const crawlable = target.adapter !== "none" && members.some((m) => m.active && CRAWLABLE.has(m.status));
        if (!crawlable || (only.length && !only.includes(target.id))) {
          // Not crawled this run: leave its jobs exactly as they are.
          setOutcome(slugs, only.length && crawlable ? "not-modified" : "skipped");
          run.outcome = only.length && crawlable ? "not-modified" : "skipped";
          return run;
        }
        const attribution: Attribution = { companies: members, parentGroup: target.parentGroup, extra };
        try {
          const fn = resolveAdapter(target.adapter, config);
          const res = await withTimeout(
            fn({
              fetcher,
              url: String(config.url ?? members.find((m) => m.careersUrl)?.careersUrl ?? target.canonicalUrl),
              config,
              validators: httpCache[target.id],
              log: (m) => console.log(`  [${target.id}] ${m}`),
            }),
            TARGET_TIMEOUT_MS,
            target.id,
          );
          run.validators = res.validators;
          if (res.notModified) {
            run.outcome = "not-modified";
          } else {
            const locationFilter = typeof config.locationFilter === "string" ? new RegExp(config.locationFilter, "i") : undefined;
            res.jobs = applyCommonConfig(res.jobs, config);
            const seen = new Set<string>();
            for (const raw of res.jobs) {
              const r = normalizeJob(raw, {
                attribution,
                source: target.adapter === "custom" ? `custom:${String(config.kind)}` : target.adapter,
                now,
                locationFilter,
                overrides,
              });
              if (!r.job) {
                run.dropped++;
                if (r.dropped !== "outside location filter") console.log(`  [${target.id}] dropped "${raw.title}": ${r.dropped}`);
                continue;
              }
              if (seen.has(r.job.id)) continue;
              seen.add(r.job.id);
              run.jobs.push(r.job);
            }
            const prevOpen = previous.filter((j) => j.status === "open" && slugs.includes(j.company)).length;
            run.outcome = isSuspect(prevOpen, run.jobs.length) ? "suspect" : "ok";
            if (run.outcome === "suspect") run.error = `returned 0 jobs but had ${prevOpen} open; kept previous jobs`;
          }
        } catch (err) {
          run.outcome = "failed";
          run.error = err instanceof RobotsDisallowedError ? `robots.txt: ${err.message}` : (err as Error).message;
        }
        setOutcome(slugs, run.outcome);
        console.log(
          `${run.outcome === "ok" || run.outcome === "not-modified" ? "✓" : "✗"} ${target.id}: ${run.outcome}, ${run.jobs.length} jobs${run.error ? ` — ${run.error}` : ""}`,
        );
        return run;
      }),
    ),
  );

  const current = runs.filter((r) => r.outcome === "ok").flatMap((r) => r.jobs);
  const diff = diffJobs({ previous, current, outcomeOf: (s) => outcomeBySlug.get(s), now });

  // Health, per target.
  const health: Record<string, HealthEntry> = {};
  for (const r of runs) {
    const prev = prevHealth[r.target.id];
    const crawled = r.outcome !== "skipped";
    const ok = r.outcome === "ok" || r.outcome === "not-modified";
    const openHere = diff.jobs.filter(
      (j) => j.status === "open" && (r.target.companySlugs.includes(j.company) || j.company === r.target.parentGroup),
    ).length;
    health[r.target.id] = {
      target: r.target.id,
      url: r.target.canonicalUrl,
      adapter: r.target.adapter,
      companies: r.target.companySlugs,
      lastRunAt: crawled ? now : (prev?.lastRunAt ?? null),
      lastSuccessAt: ok ? now : (prev?.lastSuccessAt ?? null),
      lastError: crawled ? r.error : (prev?.lastError ?? null),
      consecutiveFailures: !crawled ? (prev?.consecutiveFailures ?? 0) : ok ? 0 : (prev?.consecutiveFailures ?? 0) + 1,
      jobCount: openHere,
      suspect: r.outcome === "suspect",
    };
    if (ok && r.validators && (r.validators.etag || r.validators.lastModified)) httpCache[r.target.id] = r.validators;
  }

  const open = diff.jobs.filter((j) => j.status === "open");
  const count = (key: (j: Job) => string | string[]) => {
    const m: Record<string, number> = {};
    for (const j of open) for (const k of ([] as string[]).concat(key(j))) m[k] = (m[k] ?? 0) + 1;
    return Object.fromEntries(Object.entries(m).sort(([a], [b]) => a.localeCompare(b)));
  };
  const crawledRuns = runs.filter((r) => r.outcome !== "skipped");
  const meta: Meta = {
    generatedAt: now,
    runDurationMs: Date.now() - started,
    totals: {
      open: open.length,
      companiesWithJobs: new Set(open.map((j) => j.company)).size,
      targets: crawledRuns.length,
      targetsOk: crawledRuns.filter((r) => r.outcome === "ok" || r.outcome === "not-modified").length,
    },
    byField: count((j) => j.fields),
    byCompany: count((j) => j.company),
    bySeniority: count((j) => j.seniority),
    byIndustry: count((j) => j.industry),
  };

  const brief = (j: Job) => ({ id: j.id, title: j.title, company: j.company, url: j.url });
  const change: ChangesRun = { at: now, added: diff.added.map(brief), closed: diff.closed.map(brief) };

  const healthState = (h: HealthFile) =>
    JSON.stringify(Object.values(h).map((e) => [e.target, e.consecutiveFailures, e.lastError, e.jobCount, e.suspect]));
  const changed = writeData({ dataDir: DATA, jobs: diff.jobs, archived: diff.archived, change, meta, health, httpCache: {} });
  writeIfChanged(CACHE, JSON.stringify(httpCache, null, 2) + "\n");
  const dataChanged =
    changed.some((p) => !["meta.json", "health.json", "http-cache.json"].includes(p)) || healthState(health) !== healthState(prevHealth);

  const stamp = now.slice(0, 16).replace("T", " ");
  const message = `data: +${diff.added.length} added, -${diff.closed.length} closed (${stamp} UTC)`;
  console.log(`\n${message}`);
  console.log(
    `open ${open.length} · targets ok ${meta.totals.targetsOk}/${meta.totals.targets} · ${fetcher.requests} requests · ${Math.round(meta.runDurationMs / 1000)}s`,
  );
  console.log(dataChanged ? "data changed" : "no data change");
  return { added: diff.added.length, closed: diff.closed.length, open: open.length, dataChanged, message, runs };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
