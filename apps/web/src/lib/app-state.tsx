import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  loadPrefs,
  loadSaved,
  loadTheme,
  savePrefs,
  storeSaved,
  storeTheme,
  visitThreshold,
  type Prefs,
  type SavedJob,
  type Theme,
} from "./storage";
import type { Job } from "./types";

interface AppState {
  prefs: Prefs;
  setPrefs: (p: Prefs) => void;
  saved: Record<string, SavedJob>;
  toggleSave: (job: Job) => void;
  toggleApplied: (job: Job | SavedJob) => void;
  removeSaved: (id: string) => void;
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

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefsState] = useState<Prefs>(loadPrefs);
  const [saved, setSaved] = useState<Record<string, SavedJob>>(loadSaved);
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
  const update = useCallback((fn: (s: Record<string, SavedJob>) => Record<string, SavedJob>) => {
    setSaved((prev) => {
      const next = fn(prev);
      storeSaved(next);
      return next;
    });
  }, []);

  const value = useMemo<AppState>(
    () => ({
      prefs,
      setPrefs,
      saved,
      toggleSave: (job) =>
        update((s) => {
          if (s[job.id]) {
            const { [job.id]: _removed, ...rest } = s;
            return rest;
          }
          return {
            ...s,
            [job.id]: {
              id: job.id,
              title: job.title,
              company: job.company,
              url: job.url,
              savedAt: new Date().toISOString(),
              applied: false,
            },
          };
        }),
      toggleApplied: (job) =>
        update((s) => {
          const cur = s[job.id] ?? {
            id: job.id,
            title: job.title,
            company: job.company,
            url: job.url,
            savedAt: new Date().toISOString(),
            applied: false,
          };
          return { ...s, [job.id]: { ...cur, applied: !cur.applied } };
        }),
      removeSaved: (id) =>
        update((s) => {
          const { [id]: _removed, ...rest } = s;
          return rest;
        }),
      theme,
      setTheme,
      since,
      isNew: (job) => since !== null && job.firstSeenAt > since,
    }),
    [prefs, setPrefs, saved, update, theme, setTheme, since],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside AppStateProvider");
  return v;
}
