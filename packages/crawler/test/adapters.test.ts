/**
 * Adapter fixture tests: each adapter runs against a saved copy of the real page/API response
 * (packages/crawler/fixtures, captured by the Milestone-1 probe), using the adapterConfig that is
 * actually in data/companies.json — so a config that stops matching its page fails here.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { CompaniesFile, type Company } from "@rekiya/shared";
import { applyCommonConfig } from "../src/adapters/common.js";
import { resolveAdapter } from "../src/adapters/index.js";
import type { RawJob } from "../src/adapters/types.js";
import type { FetchRequest, FetchResult, PoliteFetcher } from "../src/http/fetcher.js";
import { normalizeJob } from "../src/pipeline/normalize.js";

const ROOT = resolve(__dirname, "../../..");
const FIX = resolve(__dirname, "../fixtures");
const companies = CompaniesFile.parse(JSON.parse(readFileSync(resolve(ROOT, "data/companies.json"), "utf8")));
const company = (slug: string): Company => {
  const c = companies.find((x) => x.slug === slug);
  if (!c) throw new Error(`no company ${slug}`);
  return c;
};

type Route = string | ((req: FetchRequest) => string);

/** Serves fixtures by URL (prefix match); a route may also build the body from the request. */
function fakeFetcher(routes: Record<string, Route>): PoliteFetcher {
  const get = async (url: string, req: FetchRequest = {}): Promise<FetchResult> => {
    const key = Object.keys(routes).find((k) => url.startsWith(k));
    if (!key) throw new Error(`unexpected request ${url}`);
    const r = routes[key]!;
    const text = typeof r === "function" ? r(req) : readFileSync(resolve(FIX, r), "utf8");
    return { status: 200, url, headers: {}, text, notModified: false, validators: {} };
  };
  return { get } as unknown as PoliteFetcher;
}

async function crawl(slug: string, routes: Record<string, Route>): Promise<{ raw: RawJob[]; jobs: ReturnType<typeof summarize> }> {
  const c = company(slug);
  const fn = resolveAdapter(c.adapter, c.adapterConfig);
  const url = typeof c.adapterConfig.url === "string" ? c.adapterConfig.url : c.careersUrl!;
  const res = await fn({ fetcher: fakeFetcher(routes), url, config: c.adapterConfig, log: () => {} });
  res.jobs = applyCommonConfig(res.jobs, c.adapterConfig);
  const filter = typeof c.adapterConfig.locationFilter === "string" ? new RegExp(c.adapterConfig.locationFilter, "i") : undefined;
  const norm = res.jobs
    .map((r) =>
      normalizeJob(r, {
        attribution: { companies: [c], parentGroup: null, extra: [] },
        source: c.adapter,
        now: "2026-09-30T00:00:00.000Z",
        locationFilter: filter,
        overrides: null,
      }),
    )
    .filter((r) => r.job)
    .map((r) => r.job!);
  return { raw: res.jobs, jobs: summarize(norm) };
}

const summarize = (jobs: NonNullable<ReturnType<typeof normalizeJob>["job"]>[]) =>
  jobs.map((j) => `${j.title} | ${j.location} | ${j.seniority} | ${j.type} | ${j.workMode} | ${j.fields.join(",")} | ${j.url}`);

describe("html adapter on real careers pages", () => {
  it("WSO2: keeps only Sri Lanka roles", async () => {
    const { raw, jobs } = await crawl("wso2", { "https://wso2.com/careers": "wso2.html" });
    expect(raw.length).toBeGreaterThan(20);
    expect(jobs.length).toBeGreaterThan(3);
    expect(jobs.every((j) => j.includes("| Sri Lanka |"))).toBe(true);
    expect(jobs).toMatchSnapshot();
  });

  it("Creative Software", async () => {
    const { jobs } = await crawl("creative-software", { "https://www.creativesoftware.com/careers": "creative-software.html" });
    expect(jobs).toHaveLength(9);
    expect(jobs).toMatchSnapshot();
  });

  it("CDB", async () => {
    const { jobs } = await crawl("citizens-development-business-finance", { "https://www.cdb.lk/": "cdb.html" });
    expect(jobs).toHaveLength(13);
    expect(jobs).toMatchSnapshot();
  });

  it("PickMe", async () => {
    const { jobs } = await crawl("digital-mobility-solutions-lanka-pickme", { "https://pickme.lk/": "pickme.html" });
    expect(jobs).toHaveLength(12);
    expect(jobs).toMatchSnapshot();
  });

  it("Zone24x7", async () => {
    const { jobs } = await crawl("zone24x7", { "https://zone24x7.com/": "zone24x7.html" });
    expect(jobs).toEqual([expect.stringMatching(/^Senior DevOps Engineer \| Colombo \|.*cloud-devops/)]);
  });

  it("Vallibel One", async () => {
    const { jobs } = await crawl("vallibel-one", { "https://www.vallibelone.com/": "vallibel-one.html" });
    expect(jobs).toMatchSnapshot();
  });

  it("Abans Finance: grouped by department, anchors keep same-titled roles apart", async () => {
    const { raw, jobs } = await crawl("abans-finance", { "https://abansfinance.lk/": "abans-finance.html" });
    expect(raw).toHaveLength(6);
    expect(new Set(raw.map((r) => r.url)).size).toBe(6);
    expect(raw[0]).toMatchObject({ department: "Gold Loan" });
    expect(raw.every((r) => (r.description ?? "").length > 50)).toBe(true);
    expect(jobs).toMatchSnapshot();
  });

  it("Zyner", async () => {
    const { jobs } = await crawl("zyner-io", { "https://careers.zyner.io/": "zyner.html" });
    expect(jobs).toHaveLength(3);
    expect(jobs.every((j) => j.includes("| intern |") && j.includes("| remote |"))).toBe(true);
  });

  it("SLT: ALL-CAPS headings become readable titles", async () => {
    const { jobs } = await crawl("sri-lanka-telecom", { "https://www.slt.lk/": "slt.html" });
    expect(jobs[0]).toMatch(/^Manager-Internal Audit \| Colombo \| manager \|/);
  });
});

describe("custom adapters on real API responses", () => {
  it("Rootcode: drops roles outside Sri Lanka", async () => {
    const { raw, jobs } = await crawl("rootcode", { "https://rootcode.ai/api/jobs": "rootcode.json" });
    expect(raw).toHaveLength(10);
    expect(jobs).toHaveLength(8);
    expect(jobs.some((j) => /Estonia|Tallinn/.test(j))).toBe(false);
    expect(jobs).toMatchSnapshot();
  });

  it("ZILLIONe", async () => {
    const { jobs } = await crawl("zillione", { "https://apisv1.zillione.com/api/careers": "zillione.json" });
    expect(jobs).toHaveLength(3);
    expect(jobs.find((j) => j.startsWith("Intern – Quality Assurance"))).toMatch(/\| intern \| internship \|.*qa-testing/);
  });

  it("LSEG Workday: country facet, multi-location jobs resolved from the path", async () => {
    const c = company("lseg");
    const fn = resolveAdapter(c.adapter, { ...c.adapterConfig, fetchDetails: false });
    const res = await fn({
      fetcher: fakeFetcher({
        // Page 1 is the captured response (20 of 28); page 2 returns the remaining 8 as empty stubs.
        "https://lseg.wd3.myworkdayjobs.com/wday/cxs/lseg/Careers/jobs": (req) => {
          const offset = (JSON.parse(req.body ?? "{}") as { offset?: number }).offset ?? 0;
          if (offset === 0) return readFileSync(resolve(FIX, "workday-lseg.json"), "utf8");
          return JSON.stringify({ total: 28, jobPostings: [] });
        },
      }),
      url: c.careersUrl!,
      config: { ...c.adapterConfig, fetchDetails: false },
      log: () => {},
    });
    expect(res.jobs.length).toBe(20);
    expect(res.jobs.every((j) => j.url.startsWith("https://lseg.wd3.myworkdayjobs.com/en-US/Careers/job/"))).toBe(true);
    expect(res.jobs.filter((j) => j.location === "Colombo, Sri Lanka").length).toBeGreaterThan(10);
  });
});

describe("round-2 sources (portals and platforms)", () => {
  // Some listings close on the probe date; pin the clock so the tests don't expire.
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-09-30T08:00:00Z") });
  });
  afterAll(() => {
    vi.useRealTimers();
  });
  const emptyPage = () => "<html><body></body></html>";

  it("John Keells SuccessFactors: rows, pagination, Octave/Cinnamon credit", async () => {
    const { raw, jobs } = await crawl("john-keells-holdings", {
      "https://careers.keells.com/search/?q=&sortColumn=referencedate&sortDirection=desc&startrow=": emptyPage,
      "https://careers.keells.com/search/": "keells-successfactors.html",
    });
    expect(raw).toHaveLength(10);
    expect(raw.every((r) => r.url.startsWith("https://careers.keells.com/") && /\/job\//.test(r.url))).toBe(true);
    expect(jobs[0]).toMatch(/^Team Lead - Financial Services \| Colombo \| lead \|/);
  });

  it("Dialog MiHCM portal: 31 roles, descriptions from the hidden field", async () => {
    const { raw, jobs } = await crawl("dialog-axiata", { "https://hcmcloud.dialog.lk/": "dialog-mihcm.html" });
    expect(raw.length).toBe(31);
    expect(raw[0]!.title).toBe("~Co-ordinator - VAS operations");
    expect(jobs[0]).toMatch(/^Co-ordinator - VAS operations \| Colombo \|/);
    expect(raw.filter((r) => (r.description ?? "").length > 100).length).toBeGreaterThan(25);
    expect(new Set(raw.map((r) => r.url)).size).toBe(31);
  });

  it("NDB MiHCM portal: month/day/year closing dates", async () => {
    const { raw } = await crawl("national-development-bank", { "https://app.mihcm.com/": "ndb-mihcm.html" });
    expect(raw.length).toBe(14);
    expect(raw.map((r) => r.title)).toContain("Pawning Officer");
  });

  it("DIMO: listings past their closing date are dropped", async () => {
    const { raw } = await crawl("diesel-and-motor-engineering", {
      "https://www.dimolanka.com/careers-and-people/vacancies/page/": emptyPage,
      "https://www.dimolanka.com/": "dimo.html",
    });
    expect(raw).toEqual([]);
  });

  it("Lanka IOC: strips the 'We are hiring!' prefix", async () => {
    const { jobs } = await crawl("lanka-ioc", { "https://www.lankaioc.com/": "lanka-ioc.html" });
    expect(jobs.map((j) => j.split(" | ")[0])).toEqual(["Internship – Finance Department", "Internship – Lubricant Department"]);
    expect(jobs.every((j) => j.includes("| intern | internship |"))).toBe(true);
  });

  it("Cargills: sections only (no menus/footers), Cargills Bank credited", async () => {
    const c = company("cargills-ceylon");
    const { raw } = await crawl("cargills-ceylon", { "https://www.cargillsceylon.com/": "cargills.html" });
    expect(raw.map((r) => r.title)).toEqual([
      "Key Account Executive",
      "Junior Executives/Trainee Executives - Cargills Bank",
      "Customer Service Assistant - Cargills Online",
      "Trainee Customer Service Assistant - Cargills FoodCity",
    ]);
    expect(c.adapterConfig.attributeTo).toEqual([{ company: "cargills-bank", pattern: "\\bcargills bank\\b" }]);
  });

  it("99x (Sri Lanka filter)", async () => {
    const { jobs } = await crawl("99x", { "https://99x.io/": "99x.html" });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatch(/^Senior Manager - Sales & Business Development \(Nordics\) \| Sri Lanka \| manager \|.*sales-marketing/);
  });

  it("Browns SimplifiedHR", async () => {
    const { jobs } = await crawl("brown-and-company", { "https://simplifiedhr.brownsgroup.com/api/": "simplifiedhr-browns.json" });
    expect(jobs).toHaveLength(8);
    expect(jobs.find((j) => j.startsWith("Associate UI/UX Engineer"))).toMatch(/\| junior \|.*ui-ux-design/);
    expect(jobs.find((j) => j.startsWith("Data Governance Officer"))).toBeDefined(); // &nbsp; cleaned
  });

  it("Union Bank PeoplesHR: open vacancies with stable anchors", async () => {
    const { jobs } = await crawl("union-bank-of-colombo", { "https://unionbank.peopleshr.com/": "peopleshr-unionb.json" });
    expect(jobs).toEqual([
      expect.stringMatching(/^Junior Executive I - Card Underwriting \| Colombo \| junior \| full-time \|.*banking-insurance.*#job-37$/),
      expect.stringMatching(/^Collection Advisor \| Colombo \|.*#job-39$/),
    ]);
  });

  it("Pearson Oracle Recruiting Cloud", async () => {
    const { jobs } = await crawl("pearson", { "https://hccz.fa.em3.oraclecloud.com/": "oracle-pearson.json" });
    expect(jobs).toHaveLength(3);
    expect(jobs[0]).toMatch(/^Manager, Program Management \| Sri Lanka \| manager \| unspecified \| hybrid \|.*\/sites\/CX_2\/job\/26069$/);
  });

  it("Surge Global via Rooster's integration API", async () => {
    const { jobs } = await crawl("surge-global", { "https://api.rooster.jobs/": "rooster-surge.json" });
    expect(jobs).toHaveLength(5);
    expect(jobs.find((j) => j.startsWith("Go to Market"))).toMatch(/\| intern \| internship \|/);
  });

  it("Flat Rock: only Colombo roles", async () => {
    const { raw, jobs } = await crawl("flat-rock-technology", { "https://admin.flatrocktech.com/": "flatrock.json" });
    expect(raw).toHaveLength(26);
    expect(jobs).toHaveLength(8);
    expect(jobs.every((j) => j.includes("| Colombo |"))).toBe(true);
  });

  it("Fortude: paginated list endpoint", async () => {
    const { jobs } = await crawl("fortude", {
      "https://careers.fortude.co/get-job-list.php?limit=10&offset=0": "fortude.json",
      "https://careers.fortude.co/get-job-list.php?limit=10&offset=10": () =>
        JSON.stringify({ joblist: [], noOfTotalRecords: { totalCount: 10 } }),
    });
    expect(jobs).toHaveLength(10);
    expect(jobs.every((j) => j.includes("fortude.talentrecruit.com"))).toBe(true);
  });

  it("Ascentic Teamtailor RSS: talent pools are not vacancies", async () => {
    const { raw } = await crawl("ascentic", { "https://career.ascentic.se/jobs.rss": "teamtailor-ascentic.xml" });
    expect(raw).toEqual([]);
  });

  it("Sysco LABS Workday: Sri Lanka location facet, public URLs", async () => {
    const c = company("sysco-labs");
    const fn = resolveAdapter(c.adapter, c.adapterConfig);
    const res = await fn({
      fetcher: fakeFetcher({
        "https://wd5.myworkdaysite.com/wday/cxs/sysco/syscocareers/jobs": (req) => {
          const b = JSON.parse(req.body ?? "{}") as { offset?: number; appliedFacets?: unknown };
          expect(b.appliedFacets).toEqual({ locations: ["b014cc62fe6601b8d666502cd5287f36"] });
          return b.offset === 0 ? readFileSync(resolve(FIX, "workday-sysco.json"), "utf8") : JSON.stringify({ total: 20, jobPostings: [] });
        },
      }),
      url: c.careersUrl!,
      config: c.adapterConfig,
      log: () => {},
    });
    expect(res.jobs).toHaveLength(20);
    expect(res.jobs[0]!.url).toMatch(/^https:\/\/wd5\.myworkdaysite\.com\/recruiting\/sysco\/syscocareers\/job\//);
  });
});
