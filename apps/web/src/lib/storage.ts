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

export const KEYS = {
  prefs: "rekiya.prefs.v1",
  saved: "rekiya.saved.v1",
  lastVisit: "rekiya.lastVisit.v1",
  theme: "rekiya.theme.v1",
  hidden: "rekiya.hidden.v1",
  hiddenCompanies: "rekiya.hiddenCompanies.v1",
  searches: "rekiya.searches.v1",
  recent: "rekiya.recent.v1",
} as const;
const K = KEYS;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);

// ---- preferences -----------------------------------------------------------------------------------------

export interface Prefs {
  fields: FieldSlug[];
  seniority: Seniority[];
  onboarded: boolean;
}

export const DEFAULT_PREFS: Prefs = { fields: [], seniority: [], onboarded: false };

export const loadPrefs = (): Prefs => ({ ...DEFAULT_PREFS, ...read<Partial<Prefs>>(K.prefs, {}) });
export const savePrefs = (p: Prefs) => write(K.prefs, p);

// ---- saved jobs / application tracker ------------------------------------------------------------------

export const APP_STATUSES = ["saved", "applied", "interviewing", "offer", "rejected"] as const;
export type AppStatus = (typeof APP_STATUSES)[number];
export const APP_STATUS_LABELS: Record<AppStatus, string> = {
  saved: "Saved",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Not selected",
};

export interface SavedJob {
  id: string;
  title: string;
  company: string;
  url: string;
  savedAt: string;
  status: AppStatus;
  notes: string;
  updatedAt: string;
}

/** Accepts the v1 shape ({ applied: boolean }) and anything half-written; drops what can't be used. */
export function normalizeSaved(raw: unknown): Record<string, SavedJob> {
  const out: Record<string, SavedJob> = {};
  if (!isObj(raw)) return out;
  for (const [id, v] of Object.entries(raw)) {
    if (!isObj(v) || !str(v.title)) continue;
    const status = (APP_STATUSES as readonly string[]).includes(str(v.status))
      ? (v.status as AppStatus)
      : v.applied === true
        ? "applied"
        : "saved";
    const savedAt = str(v.savedAt, new Date(0).toISOString());
    out[id] = {
      id,
      title: str(v.title),
      company: str(v.company),
      url: str(v.url),
      savedAt,
      status,
      notes: str(v.notes).slice(0, 2000),
      updatedAt: str(v.updatedAt, savedAt),
    };
  }
  return out;
}

export const loadSaved = (): Record<string, SavedJob> => normalizeSaved(read(K.saved, {}));
export const storeSaved = (s: Record<string, SavedJob>) => write(K.saved, s);

// ---- hidden jobs and companies ---------------------------------------------------------------------------

export interface HiddenJob {
  id: string;
  title: string;
  company: string;
  hiddenAt: string;
}
export const loadHidden = (): Record<string, HiddenJob> => {
  const raw = read<unknown>(K.hidden, {});
  return isObj(raw) ? (raw as Record<string, HiddenJob>) : {};
};
export const storeHidden = (h: Record<string, HiddenJob>) => write(K.hidden, h);
export const loadHiddenCompanies = (): string[] => {
  const raw = read<unknown>(K.hiddenCompanies, []);
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
};
export const storeHiddenCompanies = (h: string[]) => write(K.hiddenCompanies, h);

// ---- saved searches -----------------------------------------------------------------------------------

export interface SavedSearch {
  id: string;
  name: string;
  /** Serialized feed filters (URLSearchParams string). */
  params: string;
  createdAt: string;
  /** Jobs first seen after this instant count as new for this search. */
  seenAt: string;
}
export const loadSearches = (): SavedSearch[] => {
  const raw = read<unknown>(K.searches, []);
  return Array.isArray(raw)
    ? raw.filter((s): s is SavedSearch => isObj(s) && typeof s.id === "string" && typeof s.params === "string")
    : [];
};
export const storeSearches = (s: SavedSearch[]) => write(K.searches, s);

// ---- recently viewed ------------------------------------------------------------------------------------

export interface RecentJob {
  id: string;
  title: string;
  company: string;
  at: string;
}
export const RECENT_MAX = 20;
export const loadRecent = (): RecentJob[] => {
  const raw = read<unknown>(K.recent, []);
  return Array.isArray(raw) ? raw.filter((r): r is RecentJob => isObj(r) && typeof r.id === "string").slice(0, RECENT_MAX) : [];
};
export const storeRecent = (r: RecentJob[]) => write(K.recent, r.slice(0, RECENT_MAX));

// ---- theme ---------------------------------------------------------------------------------------------

export type Theme = "system" | "light" | "dark";
export const loadTheme = (): Theme => read<Theme>(K.theme, "system");
export const storeTheme = (t: Theme) => write(K.theme, t);

// ---- backup ---------------------------------------------------------------------------------------------

const BACKUP_KEYS = [K.prefs, K.saved, K.theme, K.hidden, K.hiddenCompanies, K.searches, K.recent] as const;

export interface Backup {
  app: "rekiya";
  version: 1;
  exportedAt: string;
  data: Record<string, unknown>;
}

export function exportBackup(now = new Date()): Backup {
  const data: Record<string, unknown> = {};
  for (const k of BACKUP_KEYS) {
    const v = read<unknown>(k, undefined);
    if (v !== undefined) data[k] = v;
  }
  return { app: "rekiya", version: 1, exportedAt: now.toISOString(), data };
}

/** Restores a backup file. Returns the number of sections restored; throws on a file that isn't a Rekiya backup. */
export function importBackup(raw: unknown): number {
  if (!isObj(raw) || raw.app !== "rekiya" || !isObj(raw.data)) throw new Error("This file isn't a Rekiya backup.");
  let n = 0;
  for (const k of BACKUP_KEYS) {
    if (k in raw.data) {
      write(k, k === K.saved ? normalizeSaved(raw.data[k]) : raw.data[k]);
      n++;
    }
  }
  return n;
}

/** Everything Rekiya keeps on this device. */
export function clearAll(): void {
  try {
    for (const k of Object.values(K)) localStorage.removeItem(k);
    sessionStorage.removeItem(K.lastVisit);
  } catch {
    // nothing stored
  }
}

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
