import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { FIELD_SLUGS, type ChangesRun, type HealthFile, type Job, type Meta } from "@rekiya/shared";

export function readJsonOr<T>(path: string, fallback: T): T {
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : fallback;
}

/** Write only when content differs, so unchanged files keep their git state. */
export function writeIfChanged(path: string, content: string): boolean {
  if (existsSync(path) && readFileSync(path, "utf8") === content) return false;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  return true;
}

const compact = (v: unknown) => JSON.stringify(v) + "\n";
const pretty = (v: unknown) => JSON.stringify(v, null, 2) + "\n";

export interface WriteInput {
  dataDir: string;
  jobs: Job[];
  archived: Job[];
  change: ChangesRun | null;
  meta: Meta;
  health: HealthFile;
  httpCache: Record<string, unknown>;
}

/** Returns the paths whose content changed. */
export function writeData(i: WriteInput): string[] {
  const changed: string[] = [];
  const w = (rel: string, content: string) => {
    if (writeIfChanged(resolve(i.dataDir, rel), content)) changed.push(rel);
  };

  // jobs.json: open jobs plus those closed in the last 30 days (needed to reopen / archive them).
  w("jobs.json", compact(i.jobs));

  // Field shards: open jobs only, so the web app loads just what a user follows.
  const open = i.jobs.filter((j) => j.status === "open");
  const shardDir = resolve(i.dataDir, "fields");
  for (const f of FIELD_SLUGS) w(`fields/${f}.json`, compact(open.filter((j) => j.fields.includes(f))));
  if (existsSync(shardDir)) {
    for (const file of readdirSync(shardDir)) {
      if (!FIELD_SLUGS.includes(file.replace(/\.json$/, "") as (typeof FIELD_SLUGS)[number])) rmSync(resolve(shardDir, file));
    }
  }

  if (i.change && (i.change.added.length || i.change.closed.length)) {
    const rel = `changes/${i.change.at.slice(0, 10)}.json`;
    const list = readJsonOr<ChangesRun[]>(resolve(i.dataDir, rel), []);
    list.push(i.change);
    w(rel, pretty(list));
  }

  if (i.archived.length) {
    const byMonth = new Map<string, Job[]>();
    for (const j of i.archived) {
      const m = (j.closedAt ?? j.lastSeenAt).slice(0, 7);
      byMonth.set(m, [...(byMonth.get(m) ?? []), j]);
    }
    for (const [m, list] of byMonth) {
      const rel = `archive/${m}.json`;
      const prev = readJsonOr<Job[]>(resolve(i.dataDir, rel), []);
      const ids = new Set(prev.map((j) => j.id));
      w(rel, compact([...prev, ...list.filter((j) => !ids.has(j.id))]));
    }
  }

  w("meta.json", pretty(i.meta));
  w("health.json", pretty(i.health));
  w("http-cache.json", pretty(i.httpCache));
  return changed;
}
