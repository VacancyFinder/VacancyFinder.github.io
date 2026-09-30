import { decodeHTML } from "entities";
import { SNIPPET_MAX, type JobType, type WorkMode } from "@rekiya/shared";

/** Decode entities, drop tags, collapse whitespace. */
export function cleanText(raw: string | null | undefined): string {
  if (!raw) return "";
  return decodeHTML(
    String(raw)
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>|<\/(p|div|li|h\d)>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[\u00a0\u200b\u2028\u2029]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Title: clean text, strip trailing reference codes and "Apply now" noise. */
export function cleanTitle(raw: string): string {
  return cleanText(raw)
    .replace(/\s*[-–|]\s*apply\s+now\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** ≤ 300 chars, cut on a word boundary with an ellipsis. */
export function snippet(raw: string | null | undefined, max = SNIPPET_MAX): string {
  const t = cleanText(raw);
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.-]+$/, "")}…`;
}

const CITIES = [
  "Colombo", "Kandy", "Galle", "Jaffna", "Negombo", "Kurunegala", "Matara", "Anuradhapura", "Ratnapura", "Badulla",
  "Trincomalee", "Batticaloa", "Nuwara Eliya", "Kalutara", "Gampaha", "Kegalle", "Hambantota", "Vavuniya", "Polonnaruwa",
  "Matale", "Puttalam", "Ampara", "Mannar", "Monaragala", "Kilinochchi", "Mullaitivu", "Dehiwala", "Mount Lavinia",
  "Moratuwa", "Sri Jayawardenepura Kotte", "Kotte", "Rajagiriya", "Nugegoda", "Maharagama", "Malabe", "Kaduwela",
  "Biyagama", "Katunayake", "Wattala", "Ja-Ela", "Kelaniya", "Panadura", "Horana", "Homagama", "Kiribathgoda",
  "Kadawatha", "Battaramulla", "Pannipitiya", "Avissawella", "Chilaw", "Dambulla", "Sigiriya", "Bentota",
  "Hikkaduwa", "Ella", "Weligama", "Koggala", "Pasikudah", "Kalpitiya", "Habarana", "Yala", "Tangalle", "Beruwala",
  "Wadduwa", "Ahungalla", "Seeduwa", "Ekala", "Pallekele", "Mirigama", "Minuwangoda", "Veyangoda",
];
const CITY_RE = new RegExp(`\\b(${CITIES.map((c) => c.replace(/[-]/g, "[- ]?")).join("|")})\\b`, "gi");
const canonicalCity = (m: string) => CITIES.find((c) => c.toLowerCase().replace(/-/g, "") === m.toLowerCase().replace(/[- ]/g, "")) ?? m;

/**
 * "Colombo 03" → "Colombo"; "Colombo, Western Province, Sri Lanka" → "Colombo";
 * several cities → "Colombo · Kandy"; nothing recognisable → cleaned input (or "Sri Lanka").
 */
export function normalizeLocation(raw: string | null | undefined): string {
  const t = cleanText(raw);
  if (!t) return "";
  const found: string[] = [];
  for (const m of t.matchAll(CITY_RE)) {
    const c = canonicalCity(m[1]!);
    if (!found.includes(c)) found.push(c);
  }
  if (found.length) return found.slice(0, 4).join(" · ");
  if (/^remote$/i.test(t)) return "Remote";
  if (/sri\s*lanka|^lk$/i.test(t)) return "Sri Lanka";
  return t
    .replace(/\b\d{3,6}\b/g, "")
    .replace(/\s*,\s*,+/g, ",")
    .replace(/^[\s,·-]+|[\s,·-]+$/g, "")
    .slice(0, 120);
}

export function detectWorkMode(...texts: (string | null | undefined)[]): WorkMode {
  const t = texts.filter(Boolean).join(" ");
  if (/\bhybrid\b/i.test(t)) return "hybrid";
  if (/\bremote\b|work\s+from\s+home|\bwfh\b|\bfully\s+distributed\b/i.test(t)) return "remote";
  if (/\bon[- ]?site\b|\bin[- ]office\b|\boffice[- ]based\b|\bwork\s+from\s+(?:the\s+)?office\b/i.test(t)) return "onsite";
  return "unspecified";
}

export function detectJobType(...texts: (string | null | undefined)[]): JobType {
  const t = texts.filter(Boolean).join(" ");
  if (/\bintern(?:ship)?s?\b/i.test(t)) return "internship";
  if (/\bpart[- ]?time\b/i.test(t)) return "part-time";
  if (/\bcontract(?:or|ual)?\b|\bfixed[- ]term\b|\btemporary\b|\bfreelance\b|\bconsultan(?:t|cy)\s+basis\b/i.test(t)) return "contract";
  if (/\bfull[- ]?time\b|\bpermanent\b/i.test(t)) return "full-time";
  return "unspecified";
}

/** Parse a date-ish string to YYYY-MM-DD, or null. Never guesses from relative text. */
export function isoDate(raw: string | number | null | undefined): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const d = typeof raw === "number" ? new Date(raw) : new Date(String(raw).trim());
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  if (y < 2000 || y > 2100) return null;
  return d.toISOString().slice(0, 10);
}
