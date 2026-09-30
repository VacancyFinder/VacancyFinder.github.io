import type { PoliteFetcher } from "../http/fetcher.js";
import type { AtsHit } from "./signals.js";

export interface AtsCheck {
  ats: string;
  id: string;
  api: string;
  ok: boolean;
  jobs: number | null;
  sriLankaJobs: number | null;
  error?: string;
  /** Raw API response, saved as a fixture. */
  body?: string;
}

const LK = /sri\s*lanka|colombo|kandy|galle|jaffna|negombo|kurunegala|\blk\b/i;

function countLk(items: unknown[], pick: (x: Record<string, unknown>) => string): number {
  return items.filter((x) => LK.test(pick(x as Record<string, unknown>))).length;
}

const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : JSON.stringify(v));

/** Official public job APIs per ATS. Only these are used to verify an ATS account. */
export function atsApi(hit: AtsHit): { url: string; method?: "POST"; body?: string } | null {
  const id = hit.id.split("/")[0]!;
  switch (hit.ats) {
    case "lever":
      return { url: `https://api.lever.co/v0/postings/${id}?mode=json` };
    case "greenhouse":
      return { url: `https://boards-api.greenhouse.io/v1/boards/${id}/jobs` };
    case "workable":
      return { url: `https://apply.workable.com/api/v1/widget/accounts/${id}` };
    case "smartrecruiters":
      return { url: `https://api.smartrecruiters.com/v1/companies/${id}/postings?limit=100` };
    case "teamtailor":
      return { url: `https://${id}.teamtailor.com/jobs.rss` };
    case "recruitee":
      return { url: `https://${id}.recruitee.com/api/offers/` };
    case "ashby":
      return { url: `https://api.ashbyhq.com/posting-api/job-board/${id}` };
    case "workday": {
      const [tenant, wd, site] = hit.id.split("/");
      if (!tenant || !wd || !site) return null;
      return {
        url: `https://${tenant}.${wd}.myworkdayjobs.com/wday/cxs/${tenant}/${site}/jobs`,
        method: "POST",
        body: JSON.stringify({ appliedFacets: {}, limit: 20, offset: 0, searchText: "Sri Lanka" }),
      };
    }
    default:
      return null;
  }
}

export async function checkAts(fetcher: PoliteFetcher, hit: AtsHit): Promise<AtsCheck | null> {
  const api = atsApi(hit);
  if (!api) return null;
  const base: AtsCheck = { ats: hit.ats, id: hit.id, api: api.url, ok: false, jobs: null, sriLankaJobs: null };
  try {
    const r = await fetcher.get(api.url, {
      method: api.method,
      body: api.body,
      headers: api.body ? { "content-type": "application/json", accept: "application/json" } : { accept: "application/json, application/rss+xml, */*" },
    });
    const out: AtsCheck = { ...base, ok: true, body: r.text };
    if (hit.ats === "teamtailor") {
      const items = r.text.match(/<item>[\s\S]*?<\/item>/g) ?? [];
      out.jobs = items.length;
      out.sriLankaJobs = items.filter((i) => LK.test(i)).length;
      return out;
    }
    const j = JSON.parse(r.text) as unknown;
    const o = (j ?? {}) as Record<string, unknown>;
    let items: unknown[] = [];
    let pick: (x: Record<string, unknown>) => string = (x) => str(x);
    switch (hit.ats) {
      case "lever":
        items = Array.isArray(j) ? j : [];
        pick = (x) => str(x.categories);
        break;
      case "greenhouse":
        items = (o.jobs as unknown[]) ?? [];
        pick = (x) => str(x.location);
        break;
      case "workable":
        items = (o.jobs as unknown[]) ?? [];
        pick = (x) => `${str(x.country)} ${str(x.city)} ${str(x.locations)}`;
        break;
      case "smartrecruiters":
        items = (o.content as unknown[]) ?? [];
        pick = (x) => str(x.location);
        out.jobs = typeof o.totalFound === "number" ? o.totalFound : items.length;
        break;
      case "recruitee":
        items = (o.offers as unknown[]) ?? [];
        pick = (x) => `${str(x.location)} ${str(x.country)}`;
        break;
      case "ashby":
        items = (o.jobs as unknown[]) ?? [];
        pick = (x) => str(x.location);
        break;
      case "workday":
        items = (o.jobPostings as unknown[]) ?? [];
        pick = (x) => str(x.locationsText);
        out.jobs = typeof o.total === "number" ? o.total : items.length;
        break;
    }
    out.jobs ??= items.length;
    out.sriLankaJobs = countLk(items, pick);
    return out;
  } catch (err) {
    return { ...base, error: (err as Error).message };
  }
}
