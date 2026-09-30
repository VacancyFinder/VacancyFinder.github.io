import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  loadHidden,
  loadHiddenCompanies,
  loadPrefs,
  loadRecent,
  loadSaved,
  loadSearches,
  loadTheme,
  RECENT_MAX,
  savePrefs,
  storeHidden,
  storeHiddenCompanies,
  storeRecent,
  storeSaved,
  storeSearches,
  storeTheme,
  visitThreshold,
  type AppStatus,
  type HiddenJob,
  type Prefs,
  type RecentJob,
  type SavedJob,
  type SavedSearch,
  type Theme,
} from "./storage";
import type { Job } from "./types";

type JobRef = Pick<Job, "id" | "title" | "company" | "url">;

interface AppState {
  prefs: Prefs;
  setPrefs: (p: Prefs) => void;

  saved: Record<string, SavedJob>;
  toggleSave: (job: JobRef) => void;
  setStatus: (job: JobRef, status: AppStatus) => void;
  setNotes: (id: string, notes: string) => void;
  removeSaved: (id: string) => void;
  restoreSaved: (s: SavedJob) => void;

  hidden: Record<string, HiddenJob>;
  hiddenCompanies: string[];
  hideJob: (job: JobRef) => void;
  unhideJob: (id: string) => void;
  toggleHiddenCompany: (slug: string) => void;
  isHidden: (job: Pick<Job, "id" | "company">) => boolean;

  searches: SavedSearch[];
  addSearch: (name: string, params: string) => SavedSearch;
  removeSearch: (id: string) => void;
  restoreSearch: (s: SavedSearch) => void;
  markSearchSeen: (id: string) => void;

  recent: RecentJob[];
  addRecent: (job: Pick<Job, "id" | "title" | "company">) => void;
  clearRecent: () => void;

  theme: Theme;
  setTheme: (t: Theme) => void;
  /** Jobs first seen after this instant are "NEW" (null on the first visit). */
  since: string | null;
  isNew: (job: Job) => boolean;
}

const Ctx = createContext<AppState | null>(null);

function applyTheme(t: Theme) {
  const dark = t === "dark" || (t === "system" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", !!dark);
}

/** useState whose every change is written through to storage. */
function usePersisted<T>(load: () => T, store: (v: T) => void) {
  const [v, setV] = useState<T>(load);
  const update = useCallback(
    (fn: (prev: T) => T) =>
      setV((prev) => {
        const next = fn(prev);
        store(next);
        return next;
      }),
    [store],
  );
  return [v, update] as const;
}

const newSaved = (job: JobRef, status: AppStatus = "saved"): SavedJob => {
  const at = new Date().toISOString();
  return { id: job.id, title: job.title, company: job.company, url: job.url, savedAt: at, status, notes: "", updatedAt: at };
};

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefsState] = useState<Prefs>(loadPrefs);
  const [saved, updateSaved] = usePersisted(loadSaved, storeSaved);
  const [hidden, updateHidden] = usePersisted(loadHidden, storeHidden);
  const [hiddenCompanies, updateHiddenCompanies] = usePersisted(loadHiddenCompanies, storeHiddenCompanies);
  const [searches, updateSearches] = usePersisted(loadSearches, storeSearches);
  const [recent, updateRecent] = usePersisted(loadRecent, storeRecent);
  const [theme, setThemeState] = useState<Theme>(loadTheme);
  const [since] = useState<string | null>(() => visitThreshold());

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => applyTheme("system");
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, [theme]);

  const setPrefs = useCallback((p: Prefs) => {
    setPrefsState(p);
    savePrefs(p);
  }, []);
  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    storeTheme(t);
  }, []);

  const value = useMemo<AppState>(() => {
    const hiddenCo = new Set(hiddenCompanies);
    const without = <V,>(o: Record<string, V>, id: string): Record<string, V> => {
      const { [id]: _removed, ...rest } = o;
      return rest;
    };
    return {
      prefs,
      setPrefs,

      saved,
      toggleSave: (job) => updateSaved((s) => (s[job.id] ? without(s, job.id) : { ...s, [job.id]: newSaved(job) })),
      setStatus: (job, status) =>
        updateSaved((s) => ({
          ...s,
          [job.id]: { ...(s[job.id] ?? newSaved(job)), status, updatedAt: new Date().toISOString() },
        })),
      setNotes: (id, notes) =>
        updateSaved((s) => (s[id] ? { ...s, [id]: { ...s[id]!, notes: notes.slice(0, 2000), updatedAt: new Date().toISOString() } } : s)),
      removeSaved: (id) => updateSaved((s) => without(s, id)),
      restoreSaved: (item) => updateSaved((s) => ({ ...s, [item.id]: item })),

      hidden,
      hiddenCompanies,
      hideJob: (job) =>
        updateHidden((h) => ({
          ...h,
          [job.id]: { id: job.id, title: job.title, company: job.company, hiddenAt: new Date().toISOString() },
        })),
      unhideJob: (id) => updateHidden((h) => without(h, id)),
      toggleHiddenCompany: (slug) => updateHiddenCompanies((h) => (h.includes(slug) ? h.filter((x) => x !== slug) : [...h, slug])),
      isHidden: (job) => !!hidden[job.id] || hiddenCo.has(job.company),

      searches,
      addSearch: (name, params) => {
        const now = new Date().toISOString();
        const s: SavedSearch = {
          id: `s${Date.now().toString(36)}`,
          name: name.trim().slice(0, 80) || "My search",
          params,
          createdAt: now,
          seenAt: now,
        };
        updateSearches((list) => [s, ...list.filter((x) => x.params !== params)]);
        return s;
      },
      removeSearch: (id) => updateSearches((list) => list.filter((s) => s.id !== id)),
      restoreSearch: (s) => updateSearches((list) => [s, ...list.filter((x) => x.id !== s.id)]),
      markSearchSeen: (id) => updateSearches((list) => list.map((s) => (s.id === id ? { ...s, seenAt: new Date().toISOString() } : s))),

      recent,
      addRecent: (job) =>
        updateRecent((r) =>
          [{ id: job.id, title: job.title, company: job.company, at: new Date().toISOString() }, ...r.filter((x) => x.id !== job.id)].slice(
            0,
            RECENT_MAX,
          ),
        ),
      clearRecent: () => updateRecent(() => []),

      theme,
      setTheme,
      since,
      isNew: (job) => since !== null && job.firstSeenAt > since,
    };
  }, [
    prefs,
    setPrefs,
    saved,
    updateSaved,
    hidden,
    updateHidden,
    hiddenCompanies,
    updateHiddenCompanies,
    searches,
    updateSearches,
    recent,
    updateRecent,
    theme,
    setTheme,
    since,
  ]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside AppStateProvider");
  return v;
}
