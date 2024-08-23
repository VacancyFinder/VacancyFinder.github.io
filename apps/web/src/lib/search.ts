import MiniSearch from "minisearch";
import type { Job } from "./types";

export interface SearchDoc {
  id: string;
  title: string;
  company: string;
  location: string;
  snippet: string;
}

/** Typo-tolerant search over title, company, location and snippet. Title matters most. */
export function buildIndex(jobs: Job[], companyName: (slug: string) => string): MiniSearch<SearchDoc> {
  const ms = new MiniSearch<SearchDoc>({
    fields: ["title", "company", "location", "snippet"],
    storeFields: [],
    searchOptions: {
      boost: { title: 3, company: 2, location: 1.2 },
      fuzzy: 0.2,
      prefix: true,
      combineWith: "AND",
    },
  });
  ms.addAll(jobs.map((j) => ({ id: j.id, title: j.title, company: companyName(j.company), location: j.location, snippet: j.snippet })));
  return ms;
}

/** Ids ranked by relevance; null when the query is empty (no search). */
export function searchIds(ms: MiniSearch<SearchDoc>, q: string): string[] | null {
  const query = q.trim();
  if (!query) return null;
  return ms.search(query).map((r) => String(r.id));
}
