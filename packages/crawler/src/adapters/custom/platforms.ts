/**
 * Adapters for hosted recruiting platforms that Sri Lankan employers use for their own careers pages.
 * Each reads the JSON the platform's public careers page itself loads (captured by the Milestone-1 probe).
 */
import { requireString, type AdapterContext, type AdapterFn, type RawJob } from "../types.js";

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);

async function json(ctx: AdapterContext, url: string, init: { method?: "POST"; body?: string } = {}): Promise<unknown> {
  const r = await ctx.fetcher.get(url, {
    ...init,
    headers: { accept: "application/json", ...(init.body ? { "content-type": "application/json" } : {}) },
  });
  return JSON.parse(r.text) as unknown;
}

/** "/Date(1790792999000)/" → ms */
const msDate = (v: unknown): number | null => {
  const m = typeof v === "string" ? v.match(/\/Date\((-?\d+)\)\//) : null;
  return m ? Number(m[1]) : null;
};

// ---- PeoplesHR JobPortal (e.g. unionbank.peopleshr.com/JobPortal, careerscargills.peopleshr.com) --------
export function parsePeoplesHr(body: unknown, portal: string, now = Date.now()): RawJob[] {
  const base = portal.replace(/\/+$/, "");
  return arr((body as Record<string, unknown>)?.Vacancys)
    .filter((v) => str(v.Vacancy))
    .filter((v) => {
      const close = msDate(v.CloseDate);
      return close === null || close >= now;
    })
    .map((v) => ({
      title: str(v.Vacancy)!,
      // The portal has no per-vacancy URL; the advert id keeps each listing distinct.
      url: `${base}/#job-${String(v.AdvId ?? v.ReqId ?? "")}`,
      location: str(v.Location),
      department: str(v.BizUnit),
      employmentType: str(v.EmployeementType),
      description: str(v.AdvertismentDesc),
      postedAt: msDate(v.OpenDate),
    }));
}

export const peopleshr: AdapterFn = async (ctx) => {
  const portal = requireString(ctx.config, "portal");
  const body = await json(ctx, `${portal.replace(/\/+$/, "")}/Home/GetVacanciesToApply`);
  return { jobs: parsePeoplesHr(body, portal, ctx.now) };
};

// ---- SimplifiedHR career page (Browns: simplifiedhr.brownsgroup.com) -----------------------------------
export function parseSimplifiedHr(body: unknown, host: string): RawJob[] {
  const value = ((body as Record<string, unknown>)?.data as Record<string, unknown> | undefined)?.value as
    Record<string, unknown> | undefined;
  const list = arr(value?.entitys);
  return list
    .filter((j) => str(j.jobName))
    .map((j) => ({
      title: str(j.jobName)!,
      url: `https://${host}/CareerPageweb/ApplyForJob?id=${encodeURIComponent(String(j.encryptId ?? ""))}`,
      location: str(j.location),
      department: str(j.department),
    }));
}

export const simplifiedhr: AdapterFn = async (ctx) => {
  const host = requireString(ctx.config, "host");
  const body = await json(ctx, `https://${host}/api/CareerPageWeb/GetActiveJobs`);
  return { jobs: parseSimplifiedHr(body, host) };
};

// ---- Oracle Recruiting Cloud "Candidate Experience" (Hayleys, Pearson) ---------------------------------
export function parseOracleHcm(body: unknown, host: string, site: string): { jobs: RawJob[]; total: number } {
  const item = arr((body as Record<string, unknown>)?.items)[0] ?? {};
  const jobs = arr(item.requisitionList).map((r) => ({
    title: String(r.Title ?? ""),
    url: `https://${host}/hcmUI/CandidateExperience/en/sites/${site}/job/${String(r.Id ?? "")}`,
    location: [str(r.PrimaryLocation), ...arr(r.secondaryLocations).map((l) => str(l.Name))].filter(Boolean).join(" / ") || null,
    description: str(r.ShortDescriptionStr) ?? str(r.ExternalResponsibilitiesStr),
    postedAt: str(r.PostedDate),
    workplace: str(r.WorkplaceType),
    employmentType: str(r.JobSchedule) ?? str(r.ContractType),
    department: str(r.Organization) ?? str(r.JobFamily),
  }));
  return { jobs, total: typeof item.TotalJobsCount === "number" ? item.TotalJobsCount : jobs.length };
}

export const oracleHcm: AdapterFn = async (ctx) => {
  const host = requireString(ctx.config, "host");
  const site = requireString(ctx.config, "siteNumber");
  const location = typeof ctx.config.location === "string" ? `,location=${encodeURIComponent(ctx.config.location)}` : "";
  const jobs: RawJob[] = [];
  for (let offset = 0; offset < 500; offset += 25) {
    const url =
      `https://${host}/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true` +
      `&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=${site},limit=25,offset=${offset}${location},sortBy=POSTING_DATES_DESC`;
    const { jobs: page, total } = parseOracleHcm(await json(ctx, url), host, site);
    jobs.push(...page);
    if (page.length < 25 || jobs.length >= total) break;
  }
  return { jobs };
};

// ---- Rooster integration API (a company's own careers page embeds its Rooster jobs, e.g. Surge Global) ---
const ROOSTER_QUERY =
  "query FetchCompanyJobs($id: Int!) { fetchOneCompanyPublic(id: $id) { name activeJobs { id title department location jobType } } }";

export function parseRooster(body: unknown): RawJob[] {
  const company = ((body as Record<string, unknown>)?.data as Record<string, unknown> | undefined)?.fetchOneCompanyPublic as
    Record<string, unknown> | undefined;
  return arr(company?.activeJobs)
    .filter((j) => str(j.title))
    .map((j) => ({
      title: str(j.title)!,
      url: `https://boards.rooster.jobs/jobs/${String(j.id)}`,
      location: str(j.location),
      department: str(j.department),
      employmentType: str(j.jobType),
    }));
}

export const rooster: AdapterFn = async (ctx) => {
  const id = Number(ctx.config.companyId);
  if (!Number.isInteger(id)) throw new Error("adapterConfig.companyId is required");
  const body = await json(ctx, "https://api.rooster.jobs/integration/graphql", {
    method: "POST",
    body: JSON.stringify({ query: ROOSTER_QUERY, variables: { id } }),
  });
  return { jobs: parseRooster(body) };
};

// ---- Flat Rock Technology (WordPress feed behind flatrocktech.com/careers) ------------------------------
export function parseFlatRock(body: unknown): RawJob[] {
  return arr(body)
    .filter((j) => str(j.name) && str(j.slug))
    .map((j) => ({
      title: str(j.name)!,
      url: `https://flatrocktech.com/careers/${str(j.slug)}`,
      location: (Array.isArray(j.locations) ? (j.locations as string[]) : []).join(" / ") || null,
      department: str(j.department) ?? str(j.occupation_category),
      employmentType: str(j.schedule),
      description: [str(j.main_responsibilities), str(j.requirements)].filter(Boolean).join(" "),
      postedAt: str(j.created_at),
    }));
}

export const flatrock: AdapterFn = async (ctx) => ({
  jobs: parseFlatRock(await json(ctx, "https://admin.flatrocktech.com/wp-admin/admin-ajax.php?action=frt_jobs")),
});

// ---- Fortude (careers.fortude.co list endpoint; applications on its TalentRecruit ATS) -----------------
export function parseFortude(body: unknown): { jobs: RawJob[]; total: number } {
  const b = (body ?? {}) as Record<string, unknown>;
  const jobs = arr(b.joblist)
    .filter((j) => str(j.title))
    .map((j) => ({
      title: str(j.title)!,
      url: str(j.applyurl) ?? `https://careers.fortude.co/#job-${String(j.jobid)}`,
      location: str(j.joblocation) ?? str(j.city),
      department: str(j.name),
      description: str(j.description),
      postedAt: str(j.publishedtime) ?? str(j.createdtime),
      workplace: j.isremotejob === 1 || j.isremotejob === "1" ? "Remote" : null,
    }));
  const total = (b.noOfTotalRecords as { totalCount?: number } | undefined)?.totalCount ?? jobs.length;
  return { jobs, total };
}

export const fortude: AdapterFn = async (ctx) => {
  const jobs: RawJob[] = [];
  for (let offset = 0; offset < 200; offset += 10) {
    const { jobs: page, total } = parseFortude(
      await json(
        ctx,
        `https://careers.fortude.co/get-job-list.php?limit=10&offset=${offset}&search_keyword=&joblocation=&jobnatureid=&isremotejob=&jobtypeid=`,
      ),
    );
    jobs.push(...page);
    if (page.length < 10 || jobs.length >= total) break;
  }
  return { jobs };
};

// ---- BambooHR careers site (VitalHub: vitalhub.bamboohr.com/careers) -------------------------------------
export function parseBambooHr(body: unknown, subdomain: string): RawJob[] {
  return arr((body as Record<string, unknown>)?.result)
    .filter((j) => str(j.jobOpeningName))
    .map((j) => {
      const loc = (j.location ?? {}) as Record<string, unknown>;
      const ats = (j.atsLocation ?? {}) as Record<string, unknown>;
      const place = [str(loc.city) ?? str(ats.city), str(loc.state) ?? str(ats.state), str(ats.country)].filter(Boolean).join(", ");
      return {
        title: str(j.jobOpeningName)!,
        url: `https://${subdomain}.bamboohr.com/careers/${String(j.id ?? "")}`,
        location: place || null,
        department: str(j.departmentLabel),
        employmentType: str(j.employmentStatusLabel),
        workplace: j.isRemote === true ? "Remote" : null,
      };
    });
}

export const bambooHr: AdapterFn = async (ctx) => {
  const subdomain = requireString(ctx.config, "subdomain"); // {subdomain}.bamboohr.com
  return { jobs: parseBambooHr(await json(ctx, `https://${subdomain}.bamboohr.com/careers/list`), subdomain) };
};

// ---- Manatal career page (careers-page.com/{slug}: Creately, Axiata Digital Labs, MillenniumIT ESP) -----
export function parseManatal(body: unknown, slug: string): RawJob[] {
  return arr((body as Record<string, unknown>)?.results)
    .filter((j) => str(j.position_name) && str(j.hash))
    .map((j) => ({
      title: str(j.position_name)!,
      url: `https://www.careers-page.com/${slug}/job/${str(j.hash)!}`,
      location: str(j.location_display) ?? ([str(j.city), str(j.country)].filter(Boolean).join(", ") || null),
      description: str(j.description),
    }));
}

export const manatal: AdapterFn = async (ctx) => {
  const slug = requireString(ctx.config, "slug"); // careers-page.com/{slug}
  const jobs: RawJob[] = [];
  let url: string | null = `https://www.careers-page.com/api/v1.0/c/${encodeURIComponent(slug)}/jobs/`;
  for (let page = 0; url && page < 10; page++) {
    const body = (await json(ctx, url)) as Record<string, unknown>;
    jobs.push(...parseManatal(body, slug));
    url = str(body.next);
  }
  return { jobs };
};
