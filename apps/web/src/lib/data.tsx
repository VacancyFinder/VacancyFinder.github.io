import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { FieldSlug } from "@rekiya/shared/constants";
import type { Directory, DirectoryCompany, Employer, Job, Meta } from "./types";

const BASE = `${import.meta.env.BASE_URL}data/`;

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** The crawler syncs every 3 hours; the open app checks for a new sync this often (and when the tab regains focus). */
export const SYNC_EVERY_MS = 3 * 3600_000;
const CHECK_EVERY_MS = 5 * 60_000;

const shardCache = new Map<string, Promise<Job[]>>();
function loadShard(name: string): Promise<Job[]> {
  let p = shardCache.get(name);
  if (!p) {
    p = getJson<Job[]>(name === "all" ? "jobs.json" : `fields/${name}.json`).then((jobs) => jobs.filter((j) => j.status === "open"));
    p.catch(() => shardCache.delete(name));
    shardCache.set(name, p);
  }
  return p;
}

export interface DataState {
  meta: Meta | null;
  directory: Directory | null;
  error: string | null;
  employer: (slug: string) => Employer;
  companyBySlug: Map<string, DirectoryCompany>;
  isCse: (slug: string) => boolean;
  companyMatches: (jobCompany: string, filterCompany: string) => boolean;
  /** Bumped whenever a newer sync is loaded; job lists reload when it changes. */
  version: number;
  /** Set when the app picked up a newer sync while open (for the "Jobs updated" notice). */
  lastUpdate: { at: string; open: number; previousOpen: number } | null;
  /** Check for a newer sync now. */
  checkForUpdates: () => void;
}

const Ctx = createContext<DataState | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [directory, setDirectory] = useState<Directory | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [version, setVersion] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<DataState["lastUpdate"]>(null);
  const metaRef = useRef<Meta | null>(null);

  useEffect(() => {
    Promise.all([getJson<Meta>("meta.json"), getJson<Directory>("directory.json")])
      .then(([m, d]) => {
        metaRef.current = m;
        setMeta(m);
        setDirectory(d);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  // Live updates: when a newer sync has been deployed, reload the data in place (no page refresh needed).
  const checkForUpdates = useCallback(() => {
    const current = metaRef.current;
    if (!current || (typeof navigator !== "undefined" && navigator.onLine === false)) return;
    getJson<Meta>("meta.json")
      .then(async (m) => {
        if (Date.parse(m.generatedAt) <= Date.parse(current.generatedAt)) return;
        const d = await getJson<Directory>("directory.json");
        shardCache.clear();
        metaRef.current = m;
        setMeta(m);
        setDirectory(d);
        setVersion((v) => v + 1);
        setLastUpdate({ at: m.generatedAt, open: m.totals.open, previousOpen: current.totals.open });
      })
      .catch(() => {
        // offline or mid-deploy: try again next time
      });
  }, []);

  useEffect(() => {
    const timer = setInterval(checkForUpdates, CHECK_EVERY_MS);
    const onVisible = () => document.visibilityState === "visible" && checkForUpdates();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", checkForUpdates);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", checkForUpdates);
    };
  }, [checkForUpdates]);

  const value = useMemo<DataState>(() => {
    const companyBySlug = new Map((directory?.companies ?? []).map((c) => [c.slug, c]));
    const groupName = new Map((directory?.groups ?? []).map((g) => [g.slug, g.name]));
    const cseGroups = new Set((directory?.companies ?? []).filter((c) => c.cseSymbol && c.parentGroup).map((c) => c.parentGroup!));
    return {
      meta,
      directory,
      error,
      version,
      lastUpdate,
      checkForUpdates,
      companyBySlug,
      employer: (slug) => {
        const c = companyBySlug.get(slug);
        if (c) return { slug, name: c.name, cseSymbol: c.cseSymbol, isGroup: false };
        return { slug, name: groupName.get(slug) ?? slug, cseSymbol: null, isGroup: true };
      },
      isCse: (slug) => !!companyBySlug.get(slug)?.cseSymbol || cseGroups.has(slug),
      companyMatches: (jobCompany, filter) =>
        jobCompany === filter ||
        companyBySlug.get(jobCompany)?.parentGroup === filter || // filter is a group: include its members
        companyBySlug.get(filter)?.parentGroup === jobCompany, // filter is a member: include its group's page
    };
  }, [meta, directory, error, version, lastUpdate, checkForUpdates]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): DataState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useData outside DataProvider");
  return v;
}

/** Open jobs for these fields (loads only those shards), or every open job for "all". */
export function useJobs(fields: FieldSlug[] | "all"): { jobs: Job[] | null; error: string | null } {
  const { version } = useData();
  const key = `${version}:${fields === "all" ? "all" : [...fields].sort().join(",")}`;
  const [state, setState] = useState<{ key: string; jobs: Job[] | null; error: string | null }>({ key, jobs: null, error: null });
  useEffect(() => {
    let alive = true;
    const names = fields === "all" || fields.length === 0 ? ["all"] : fields;
    Promise.all(names.map(loadShard))
      .then((lists) => {
        const seen = new Set<string>();
        const merged: Job[] = [];
        for (const l of lists) {
          for (const j of l) {
            if (seen.has(j.id)) continue;
            seen.add(j.id);
            merged.push(j);
          }
        }
        if (alive) setState({ key, jobs: merged, error: null });
      })
      .catch((e: Error) => alive && setState({ key, jobs: null, error: e.message }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures `fields`
  }, [key]);
  if (state.key === key) return { jobs: state.jobs, error: state.error };
  // A live update (same view, newer sync) keeps showing the current jobs until the new ones arrive.
  const sameView = state.key.slice(state.key.indexOf(":")) === key.slice(key.indexOf(":"));
  return sameView && state.jobs ? { jobs: state.jobs, error: null } : { jobs: null, error: null };
}
