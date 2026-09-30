import { FIELD_SLUGS, type FieldSlug } from "@rekiya/shared";
import taxonomyJson from "./taxonomy.json" with { type: "json" };

export interface Taxonomy {
  titleWeight: number;
  descriptionWeight: number;
  threshold: number;
  fields: Record<string, { terms: string[]; exclude: string[] }>;
}

interface CompiledField {
  field: FieldSlug;
  terms: RegExp[];
  exclude: RegExp[];
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\/&#-]/g, (c) => (c === "*" ? "*" : `\\${c}`));

/** Whole-word, case-insensitive; trailing * = any word ending. Works for terms with symbols (c#, .net, ui/ux). */
export function termRegex(term: string): RegExp {
  const t = term.trim().toLowerCase();
  const wild = t.endsWith("*");
  const body = escape(wild ? t.slice(0, -1) : t).replace(/\\?\*/g, "");
  const tail = wild ? "[\\w-]*" : "";
  return new RegExp(`(?<![\\w.#+])${body}${tail}(?![\\w#+])`, "i");
}

export function compileTaxonomy(tax: Taxonomy): CompiledField[] {
  const out: CompiledField[] = [];
  for (const [field, def] of Object.entries(tax.fields)) {
    if (!(FIELD_SLUGS as readonly string[]).includes(field)) throw new Error(`taxonomy: unknown field "${field}"`);
    out.push({ field: field as FieldSlug, terms: def.terms.map(termRegex), exclude: def.exclude.map(termRegex) });
  }
  return out;
}

const DEFAULT = compileTaxonomy(taxonomyJson as Taxonomy);
const DEFAULT_TAX = taxonomyJson as Taxonomy;

function strip(text: string, exclude: RegExp[]): string {
  let t = text;
  for (const re of exclude) t = t.replace(new RegExp(re.source, "gi"), " ");
  return t;
}

export function scoreFields(title: string, description = "", tax: Taxonomy = DEFAULT_TAX, compiled = DEFAULT): Map<FieldSlug, number> {
  const scores = new Map<FieldSlug, number>();
  for (const f of compiled) {
    const t = strip(title, f.exclude);
    const d = strip(description, f.exclude);
    let s = 0;
    for (const re of f.terms) {
      if (re.test(t)) s += tax.titleWeight;
      else if (re.test(d)) s += tax.descriptionWeight;
    }
    if (s > 0) scores.set(f.field, s);
  }
  return scores;
}

/** Every field scoring >= threshold, best first; ["other"] when none does. */
export function classifyFields(title: string, description = ""): FieldSlug[] {
  const scores = scoreFields(title, description);
  const hits = [...scores.entries()].filter(([, s]) => s >= DEFAULT_TAX.threshold).sort((a, b) => b[1] - a[1]);
  return hits.length ? hits.map(([f]) => f) : ["other"];
}
