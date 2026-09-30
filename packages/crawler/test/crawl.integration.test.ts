/**
 * End-to-end: `runCrawl` over a copy of /data, with the network replaced by the Milestone-1 fixtures.
 * Proves a local crawl produces schema-valid /data and that the run-to-run lifecycle holds.
 */
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Job, Meta } from "@rekiya/shared";
import type { FetchRequest, FetchResult, PoliteFetcher } from "../src/http/fetcher.js";
import { runCrawl } from "../src/pipeline/run.js";
import { validateDataDir } from "../src/pipeline/validate.js";

const ROOT = resolve(__dirname, "../../..");
const FIX = resolve(__dirname, "../fixtures");

/** URL prefix → fixture file. Unlisted URLs 404, like a real missing page. */
const ROUTES: Record<string, string> = {
  "https://wso2.com/careers": "wso2.html",
  "https://www.creativesoftware.com/careers": "creative-software.html",
  "https://www.cdb.lk/": "cdb.html",
  "https://pickme.lk/": "pickme.html",
  "https://zone24x7.com/": "zone24x7.html",
  "https://www.vallibelone.com/": "vallibel-one.html",
  "https://vallibelone.com/": "vallibel-one.html",
  "https://abansfinance.lk/": "abans-finance.html",
  "https://careers.zyner.io/": "zyner.html",
  "https://www.slt.lk/": "slt.html",
  "https://rootcode.ai/api/jobs": "rootcode.json",
  "https://apisv1.zillione.com/api/careers": "zillione.json",
};

function fakeFetcher(opts: { down?: RegExp } = {}): PoliteFetcher {
  const get = async (url: string, req: FetchRequest = {}): Promise<FetchResult> => {
    if (opts.down?.test(url)) throw new Error("connect ETIMEDOUT");
    if (url.includes("myworkdayjobs.com/wday/cxs/lseg/Careers/jobs")) {
      const offset = (JSON.parse(req.body ?? "{}") as { offset?: number }).offset ?? 0;
      const text = offset === 0 ? readFileSync(resolve(FIX, "workday-lseg.json"), "utf8") : JSON.stringify({ total: 28, jobPostings: [] });
      return { status: 200, url, headers: {}, text, notModified: false, validators: {} };
    }
    if (url.includes("myworkdayjobs.com/wday/cxs/")) throw new Error("HTTP 404 (detail not in fixtures)");
    const key = Object.keys(ROUTES).find((k) => url.startsWith(k));
    if (!key) throw new Error(`HTTP 404 for ${url}`);
    return { status: 200, url, headers: {}, text: readFileSync(resolve(FIX, ROUTES[key]!), "utf8"), notModified: false, validators: {} };
  };
  return { get, requests: 0 } as unknown as PoliteFetcher;
}

let dir: string;
const read = <T>(rel: string): T => JSON.parse(readFileSync(join(dir, rel), "utf8")) as T;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "rekiya-crawl-"));
  for (const f of ["companies.json", "groups.json", "crawl-targets.json"]) cpSync(resolve(ROOT, "data", f), join(dir, f));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("local crawl over fixtures", () => {
  const T1 = "2026-09-30T00:00:00.000Z";
  const T2 = "2026-09-30T03:00:00.000Z";
  const T3 = "2026-09-30T06:00:00.000Z";
  const opts = () => ({ dataDir: dir, cachePath: join(dir, ".cache.json"), quiet: true });

  it("first run writes schema-valid /data for every ready company", async () => {
    const r = await runCrawl({ ...opts(), now: T1, fetcher: fakeFetcher() });
    expect(validateDataDir(dir)).toEqual([]);
    const jobs = read<Job[]>("jobs.json");
    expect(jobs.length).toBe(r.open);
    expect(r.added).toBe(jobs.length);
    expect(r.runs.filter((x) => x.outcome === "failed").map((x) => x.target.id)).toEqual([]);
    // Every ready company contributed jobs.
    const companies = new Set(jobs.map((j) => j.company));
    for (const slug of ["wso2", "creative-software", "rootcode", "zillione", "lseg", "digital-mobility-solutions-lanka-pickme", "citizens-development-business-finance"]) {
      expect(companies.has(slug), slug).toBe(true);
    }
    expect(jobs.every((j) => j.firstSeenAt === T1 && j.status === "open")).toBe(true);
    // Field shards contain exactly the open jobs of that field.
    const se = read<Job[]>("fields/software-engineering.json");
    expect(se.length).toBe(jobs.filter((j) => j.fields.includes("software-engineering")).length);
    const meta = read<Meta>("meta.json");
    expect(meta.totals.open).toBe(jobs.length);
    expect(meta.totals.targetsOk).toBe(meta.totals.targets);
    expect(existsSync(join(dir, "changes/2026-09-30.json"))).toBe(true);
  });

  it("re-running with the same pages changes no job data", async () => {
    const before = readFileSync(join(dir, "jobs.json"), "utf8");
    const r = await runCrawl({ ...opts(), now: T1, fetcher: fakeFetcher() });
    expect(r.added).toBe(0);
    expect(r.closed).toBe(0);
    expect(readFileSync(join(dir, "jobs.json"), "utf8")).toBe(before);
  });

  it("a site that is down keeps its jobs and counts a failure", async () => {
    const before = read<Job[]>("jobs.json").filter((j) => j.company === "wso2");
    const r = await runCrawl({ ...opts(), now: T2, fetcher: fakeFetcher({ down: /wso2\.com/ }) });
    expect(r.closed).toBe(0);
    expect(read<Job[]>("jobs.json").filter((j) => j.company === "wso2")).toEqual(before);
    const health = read<Record<string, { consecutiveFailures: number; lastError: string | null }>>("health.json");
    const wso2 = Object.values(health).find((h) => h.lastError?.includes("ETIMEDOUT"));
    expect(wso2?.consecutiveFailures).toBe(1);
    expect(validateDataDir(dir)).toEqual([]);
  });

  it("a site that suddenly lists nothing is 'suspect', not a mass closure", async () => {
    const r = await runCrawl({
      ...opts(),
      now: T2,
      fetcher: (() => {
        const f = fakeFetcher();
        const get = f.get.bind(f);
        return { get: async (u: string, q?: FetchRequest) => (u.startsWith("https://www.cdb.lk/") ? { ...(await get(u, q)), text: "<html></html>" } : get(u, q)) } as unknown as PoliteFetcher;
      })(),
    });
    expect(r.runs.find((x) => x.target.companySlugs.includes("citizens-development-business-finance"))?.outcome).toBe("suspect");
    expect(read<Job[]>("jobs.json").filter((j) => j.company === "citizens-development-business-finance" && j.status === "open").length).toBe(13);
  });

  it("a listing that disappears closes after two successful runs", async () => {
    // Zone24x7 has one role; serve a page without it (but keep other sites) twice.
    const without = (): PoliteFetcher => {
      const f = fakeFetcher();
      const get = f.get.bind(f);
      return {
        get: async (u: string, q?: FetchRequest) => (u.startsWith("https://zone24x7.com/") ? { ...(await get(u, q)), text: "<html><body></body></html>" } : get(u, q)),
      } as unknown as PoliteFetcher;
    };
    await runCrawl({ ...opts(), now: T2, fetcher: without() });
    let z = read<Job[]>("jobs.json").find((j) => j.company === "zone24x7")!;
    expect(z).toMatchObject({ status: "open", missedRuns: 1 });
    const r = await runCrawl({ ...opts(), now: T3, fetcher: without() });
    z = read<Job[]>("jobs.json").find((j) => j.company === "zone24x7")!;
    expect(z).toMatchObject({ status: "closed", missedRuns: 2, closedAt: T3 });
    expect(r.closed).toBe(1);
    expect(read<Job[]>("fields/cloud-devops.json").some((j) => j.id === z.id)).toBe(false);
    expect(validateDataDir(dir)).toEqual([]);
  });
});
