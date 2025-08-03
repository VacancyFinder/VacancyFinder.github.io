/** "today", "yesterday", "3 days ago", "2 weeks ago", "4 months ago". */
export function relativeDays(iso: string, now = new Date()): string {
  const then = new Date(iso);
  const days = Math.floor(
    (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(then.getFullYear(), then.getMonth(), then.getDate())) /
      86_400_000,
  );
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 730) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

/** "3 h ago" style for data freshness. */
export function relativeTime(iso: string, now = Date.now()): string {
  const mins = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

const STOP = new Set(["plc", "ltd", "limited", "pvt", "the", "and", "&", "of", "co", "company", "(pvt)", "group"]);

/** Two-letter badge text: "John Keells Holdings PLC" → "JK", "99x" → "99". */
export function initials(name: string): string {
  const words = name
    .replace(/\(.*?\)/g, " ")
    .split(/[\s.-]+/)
    .filter((w) => w && !STOP.has(w.toLowerCase()));
  if (words.length === 0) return name.slice(0, 2).toUpperCase();
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

/** Stable hue for a badge, so each company keeps its colour. */
export function hue(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) % 360;
  return h;
}

export const STALE_AFTER_MS = 12 * 3600 * 1000;
export const isStale = (generatedAt: string, now = Date.now()) => now - Date.parse(generatedAt) > STALE_AFTER_MS;

/** Only ever link http(s). */
export function safeHref(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** "30 Sep 2026" — unambiguous in Sri Lanka, where both d/m and m/d are seen. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Many career pages start the description with the job title again; drop that echo so the card
 * doesn't show the title twice. Returns "" when nothing useful is left.
 */
export function cleanSnippet(title: string, snippet: string): string {
  let s = snippet.trim();
  const t = norm(title);
  if (t && norm(s).startsWith(t)) {
    // Consume snippet characters until they spell the title, then drop them and any separator.
    let i = 0;
    while (i < s.length && norm(s.slice(0, i)).length < t.length) i++;
    if (norm(s.slice(0, i)) === t) s = s.slice(i).replace(/^[\s:–—\-|,.)]+/, "");
  }
  return s.length >= 20 ? s : "";
}

/** RFC 4180 CSV (quotes doubled, fields with commas/quotes/newlines quoted). */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    // Guard against spreadsheet formula injection from scraped text.
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

/** Offer a file to the user (no server involved). */
export function downloadFile(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Absolute link to an in-app route, for sharing. */
export function appUrl(path: string): string {
  return `${window.location.origin}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * When the next 3-hourly sync should land, in Sri Lanka time: "around 6:17 pm", or "any minute now"
 * once it's due (GitHub's scheduler can run late).
 */
export function nextSyncLabel(generatedAt: string, everyMs: number, now = Date.now()): string {
  const next = Date.parse(generatedAt) + everyMs;
  if (Number.isNaN(next) || next - now <= 5 * 60_000) return "any minute now";
  const t = new Date(next).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Colombo" });
  return `around ${t.replace(/\s?([ap])m$/i, " $1m").toLowerCase()}`;
}
