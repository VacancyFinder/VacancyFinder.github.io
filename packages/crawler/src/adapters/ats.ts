/**
 * Adapters for ATS vendors' official public job APIs. Each needs one adapterConfig key naming the
 * account, e.g. { "site": "wso2" } for Lever.
 */
import { requireString, type AdapterFn, type RawJob } from "./types.js";

const asArray = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);
const s = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

async function getJson(ctx: Parameters<AdapterFn>[0], url: string, init: { method?: "POST"; body?: string } = {}) {
  const r = await ctx.fetcher.get(url, {
    ...init,
    validators: init.method ? undefined : ctx.validators,
    headers: { accept: "application/json", ...(init.body ? { "content-type": "application/json" } : {}) },
  });
  if (r.notModified) return { notModified: true as const, validators: r.validators, data: null };
  return { notModified: false as const, validators: r.validators, data: JSON.parse(r.text) as unknown };
}

/** Lever: GET api.lever.co/v0/postings/{site}?mode=json */
export const lever: AdapterFn = async (ctx) => {
  const site = requireString(ctx.config, "site");
  const r = await getJson(ctx, `https://api.lever.co/v0/postings/${encodeURIComponent(site)}?mode=json`);
  if (r.notModified) return { jobs: [], notModified: true, validators: r.validators };
  const jobs: RawJob[] = asArray(r.data).map((p) => {
    const cat = (p.categories ?? {}) as Record<string, unknown>;
    const locs = asArray(cat.allLocations as unknown).length ? (cat.allLocations as string[]).join(" / ") : s(cat.location);
    return {
      title: String(p.text ?? ""),
      url: String(p.hostedUrl ?? p.applyUrl ?? ""),
      location: locs,
      description: s(p.descriptionPlain) ?? s(p.description),
      postedAt: typeof p.createdAt === "number" ? p.createdAt : null,
      employmentType: s(cat.commitment),
      workplace: s(p.workplaceType),
      department: s(cat.team) ?? s(cat.department),
    };
  });
  return { jobs, validators: r.validators };
};

/** Greenhouse: GET boards-api.greenhouse.io/v1/boards/{board}/jobs?content=true */
export const greenhouse: AdapterFn = async (ctx) => {
  const board = requireString(ctx.config, "board");
  const r = await getJson(ctx, `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs?content=true`);
  if (r.notModified) return { jobs: [], notModified: true, validators: r.validators };
  const jobs: RawJob[] = asArray((r.data as Record<string, unknown>)?.jobs).map((j) => ({
    title: String(j.title ?? ""),
    url: String(j.absolute_url ?? ""),
    location: s((j.location as Record<string, unknown> | undefined)?.name),
    description: s(j.content),
    postedAt: s(j.first_published) ?? s(j.updated_at),
    department: s(asArray(j.departments)[0]?.name),
  }));
  return { jobs, validators: r.validators };
};

/** Workable: GET apply.workable.com/api/v1/widget/accounts/{account}?details=true */
export const workable: AdapterFn = async (ctx) => {
  const account = requireString(ctx.config, "account");
  const r = await getJson(ctx, `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(account)}?details=true`);
  if (r.notModified) return { jobs: [], notModified: true, validators: r.validators };
  const jobs: RawJob[] = asArray((r.data as Record<string, unknown>)?.jobs).map((j) => {
    const locs = asArray(j.locations).map((l) => [l.city, l.region, l.country].filter(Boolean).join(", "));
    return {
      title: String(j.title ?? ""),
      url: String(j.url ?? j.shortlink ?? j.application_url ?? ""),
      location: locs.length ? locs.join(" / ") : [j.city, j.state, j.country].filter(Boolean).join(", "),
      description: s(j.description),
      postedAt: s(j.published_on) ?? s(j.created_at),
      employmentType: s(j.employment_type),
      workplace: j.telecommuting === true ? "Remote" : s(j.workplace_type),
      department: s(j.department),
    };
  });
  return { jobs, validators: r.validators };
};

/** SmartRecruiters: GET api.smartrecruiters.com/v1/companies/{company}/postings (paged, 100 per page). */
export const smartrecruiters: AdapterFn = async (ctx) => {
  const company = requireString(ctx.config, "company");
  const jobs: RawJob[] = [];
  for (let offset = 0; offset < 1000; offset += 100) {
    const r = await getJson(ctx, `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(company)}/postings?limit=100&offset=${offset}`);
    const d = (r.data ?? {}) as Record<string, unknown>;
    const page = asArray(d.content);
    for (const p of page) {
      const loc = (p.location ?? {}) as Record<string, unknown>;
      jobs.push({
        title: String(p.name ?? ""),
        url: `https://jobs.smartrecruiters.com/${encodeURIComponent(company)}/${String(p.id ?? "")}`,
        location: s(loc.fullLocation) ?? [loc.city, loc.region, loc.country].filter(Boolean).join(", "),
        description: null,
        postedAt: s(p.releasedDate),
        employmentType: s((p.typeOfEmployment as Record<string, unknown> | undefined)?.label),
        workplace: loc.remote === true ? "Remote" : loc.hybrid === true ? "Hybrid" : null,
        department: s((p.department as Record<string, unknown> | undefined)?.label),
      });
    }
    const total = typeof d.totalFound === "number" ? d.totalFound : 0;
    if (page.length < 100 || jobs.length >= total) break;
  }
  return { jobs };
};

/** Teamtailor: public RSS feed at {sub}.teamtailor.com/jobs.rss (or a custom careers domain). */
export const teamtailor: AdapterFn = async (ctx) => {
  const feed = typeof ctx.config.feedUrl === "string" ? ctx.config.feedUrl : `https://${requireString(ctx.config, "subdomain")}.teamtailor.com/jobs.rss`;
  const r = await ctx.fetcher.get(feed, { validators: ctx.validators, headers: { accept: "application/rss+xml, application/xml" } });
  if (r.notModified) return { jobs: [], notModified: true, validators: r.validators };
  const tag = (item: string, name: string) => {
    const m = item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
    return m ? m[1]!.replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, "$1").trim() : null;
  };
  const jobs: RawJob[] = (r.text.match(/<item>[\s\S]*?<\/item>/gi) ?? []).map((item) => {
    const locations = [...item.matchAll(/<tt:location>[\s\S]*?<tt:city>([\s\S]*?)<\/tt:city>[\s\S]*?(?:<tt:country>([\s\S]*?)<\/tt:country>)?[\s\S]*?<\/tt:location>/gi)]
      .map((m) => [m[1], m[2]].filter(Boolean).join(", "))
      .join(" / ");
    return {
      title: tag(item, "title") ?? "",
      url: tag(item, "link") ?? "",
      location: locations || null,
      description: tag(item, "description"),
      postedAt: tag(item, "pubDate"),
      workplace: tag(item, "remoteStatus") ?? tag(item, "tt:remoteStatus"),
      department: tag(item, "tt:department"),
    };
  });
  return { jobs, validators: r.validators };
};

/** Workday career sites: POST {host}/wday/cxs/{tenant}/{site}/jobs (the JSON the site itself uses). */
export const workday: AdapterFn = async (ctx) => {
  const host = requireString(ctx.config, "host"); // e.g. lseg.wd3.myworkdayjobs.com
  const tenant = requireString(ctx.config, "tenant");
  const site = requireString(ctx.config, "site");
  const searchText = typeof ctx.config.searchText === "string" ? ctx.config.searchText : "";
  const facets = (ctx.config.appliedFacets ?? {}) as Record<string, unknown>;
  const base = `https://${host}`;
  const jobs: RawJob[] = [];
  for (let offset = 0; offset < 500; offset += 20) {
    const r = await getJson(ctx, `${base}/wday/cxs/${tenant}/${site}/jobs`, {
      method: "POST",
      body: JSON.stringify({ appliedFacets: facets, limit: 20, offset, searchText }),
    });
    const d = (r.data ?? {}) as Record<string, unknown>;
    const page = asArray(d.jobPostings);
    for (const p of page) {
      jobs.push({
        title: String(p.title ?? ""),
        url: `${base}/en-US/${site}${String(p.externalPath ?? "")}`,
        location: s(p.locationsText),
        postedAt: null,
        employmentType: s(p.timeType),
      });
    }
    const total = typeof d.total === "number" ? d.total : 0;
    if (page.length < 20 || offset + 20 >= total) break;
  }
  return { jobs };
};
