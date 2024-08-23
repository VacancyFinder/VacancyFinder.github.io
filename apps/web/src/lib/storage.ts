import type { FieldSlug, Seniority } from "@rekiya/shared/constants";

/** localStorage can be missing or throw (private mode, blocked storage); never let that break the app. */
function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable: preferences just won't persist
  }
}

const K = {
  prefs: "rekiya.prefs.v1",
  saved: "rekiya.saved.v1",
  lastVisit: "rekiya.lastVisit.v1",
  theme: "rekiya.theme.v1",
} as const;

export interface Prefs {
  fields: FieldSlug[];
  seniority: Seniority[];
  onboarded: boolean;
}

export const DEFAULT_PREFS: Prefs = { fields: [], seniority: [], onboarded: false };

export const loadPrefs = (): Prefs => ({ ...DEFAULT_PREFS, ...read<Partial<Prefs>>(K.prefs, {}) });
export const savePrefs = (p: Prefs) => write(K.prefs, p);

export interface SavedJob {
  id: string;
  title: string;
  company: string;
  url: string;
  savedAt: string;
  applied: boolean;
}

export const loadSaved = (): Record<string, SavedJob> => read(K.saved, {});
export const storeSaved = (s: Record<string, SavedJob>) => write(K.saved, s);

export type Theme = "system" | "light" | "dark";
export const loadTheme = (): Theme => read<Theme>(K.theme, "system");
export const storeTheme = (t: Theme) => write(K.theme, t);

/**
 * "NEW" means first seen since the previous visit. The threshold is fixed for the whole session
 * (sessionStorage), while localStorage records this visit for next time.
 */
export function visitThreshold(now = new Date()): string | null {
  try {
    const cached = sessionStorage.getItem(K.lastVisit);
    if (cached !== null) return cached || null;
    const prev = read<string | null>(K.lastVisit, null);
    sessionStorage.setItem(K.lastVisit, prev ?? "");
    write(K.lastVisit, now.toISOString());
    return prev;
  } catch {
    return null;
  }
}
