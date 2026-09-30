/**
 * Adapter fixture tests: each adapter runs against a saved copy of the real page/API response
 * (packages/crawler/fixtures, captured by the Milestone-1 probe), using the adapterConfig that is
 * actually in data/companies.json — so a config that stops matching its page fails here.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CompaniesFile, type Company } from "@rekiya/shared";
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
  const res = await fn({ fetcher: fakeFetcher(routes), url: c.careersUrl!, config: c.adapterConfig, log: () => {} });
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
