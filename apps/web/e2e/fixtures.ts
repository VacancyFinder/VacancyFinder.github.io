import { createHash } from "node:crypto";
import type { Page } from "@playwright/test";
import type { Directory, Job, Meta } from "../src/lib/types";

const now = Date.now();
const iso = (hoursAgo: number) => new Date(now - hoursAgo * 3600_000).toISOString();

let n = 0;
function job(p: Partial<Job> & Pick<Job, "title" | "company" | "fields">): Job {
  n++;
  return {
    // Real ids are sha1 hashes; so are these (job URLs use the first 12 hex chars).
    id: createHash("sha1").update(`job-${n}`).digest("hex"),
    industry: "technology",
    seniority: "unspecified",
    type: "full-time",
    workMode: "onsite",
    location: "Colombo",
    snippet: "Join our team to build great products for customers in Sri Lanka and abroad.",
    url: `https://careers.example.lk/jobs/${n}`,
    source: "lever",
    postedAt: null,
    firstSeenAt: iso(24 * n),
    lastSeenAt: iso(1),
    status: "open",
    missedRuns: 0,
    closedAt: null,
    ...p,
  };
}

export const JOBS: Job[] = [
  job({ title: "Senior React Developer", company: "wso2", fields: ["software-engineering"], seniority: "senior", workMode: "hybrid" }),
  job({ title: "QA Automation Intern", company: "99x", fields: ["qa-testing"], seniority: "intern", type: "internship" }),
  job({ title: "Data Scientist", company: "keells", industry: "diversified", fields: ["data-ai-ml"], location: "Colombo · Kandy" }),
  job({ title: "DevSecOps Engineer", company: "wso2", fields: ["cloud-devops", "cybersecurity"], workMode: "remote" }),
  job({
    title: "Branch Manager",
    company: "sampath-bank",
    industry: "banking",
    fields: ["banking-insurance"],
    seniority: "manager",
    location: "Kandy",
  }),
  job({ title: "UI/UX Designer", company: "99x", fields: ["ui-ux-design"] }),
  job({ title: "Old Closed Role", company: "wso2", fields: ["software-engineering"], status: "closed", closedAt: iso(5) }),
];

export const DIRECTORY: Directory = {
  groups: [{ slug: "keells", name: "John Keells Group" }],
  companies: [
    {
      slug: "wso2",
      name: "WSO2",
      industry: "technology",
      cseSymbol: null,
      parentGroup: null,
      sourceLists: ["tech"],
      status: "ready",
      active: true,
      website: "https://wso2.com",
      careersUrl: "https://wso2.com/careers/",
      health: { ok: true, lastSuccessAt: iso(1), consecutiveFailures: 0 },
    },
    {
      slug: "99x",
      name: "99x",
      industry: "technology",
      cseSymbol: null,
      parentGroup: null,
      sourceLists: ["tech"],
      status: "ready",
      active: true,
      website: "https://99x.io",
      careersUrl: "https://99x.io/careers",
      health: { ok: true, lastSuccessAt: iso(1), consecutiveFailures: 0 },
    },
    {
      slug: "john-keells-holdings",
      name: "John Keells Holdings PLC",
      industry: "diversified",
      cseSymbol: "JKH.N0000",
      parentGroup: "keells",
      sourceLists: ["cse"],
      status: "ready",
      active: true,
      website: "https://keells.com",
      careersUrl: "https://keells.com/careers",
      health: { ok: true, lastSuccessAt: iso(1), consecutiveFailures: 0 },
    },
    {
      slug: "sampath-bank",
      name: "Sampath Bank PLC",
      industry: "banking",
      cseSymbol: "SAMP.N0000",
      parentGroup: null,
      sourceLists: ["cse"],
      status: "ready",
      active: true,
      website: "https://www.sampath.lk",
      careersUrl: "https://www.sampath.lk/careers",
      health: { ok: false, lastSuccessAt: iso(30), consecutiveFailures: 3 },
    },
    {
      slug: "acme-plantations",
      name: "Acme Plantations PLC",
      industry: "plantations-agriculture",
      cseSymbol: "ACME.N0000",
      parentGroup: null,
      sourceLists: ["cse"],
      status: "needs-research",
      active: true,
      website: null,
      careersUrl: null,
      health: null,
    },
  ],
};

export function meta(generatedHoursAgo = 1): Meta {
  const open = JOBS.filter((j) => j.status === "open");
  const count = (key: (j: Job) => string[]) => {
    const m: Record<string, number> = {};
    for (const j of open) for (const k of key(j)) m[k] = (m[k] ?? 0) + 1;
    return m;
  };
  return {
    generatedAt: iso(generatedHoursAgo),
    runDurationMs: 60_000,
    totals: { open: open.length, companiesWithJobs: 4, targets: 4, targetsOk: 3 },
    byField: count((j) => j.fields),
    byCompany: count((j) => [j.company]),
    bySeniority: count((j) => [j.seniority]),
    byIndustry: count((j) => [j.industry]),
  };
}

/** Serve fixture data instead of the build's /data. */
export async function mockData(page: Page, opts: { generatedHoursAgo?: number } = {}): Promise<void> {
  await page.route("**/data/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    const json = (body: unknown) => route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
    if (path.endsWith("/meta.json")) return json(meta(opts.generatedHoursAgo));
    if (path.endsWith("/directory.json")) return json(DIRECTORY);
    if (path.endsWith("/jobs.json")) return json(JOBS);
    const m = path.match(/\/fields\/([a-z-]+)\.json$/);
    if (m) return json(JOBS.filter((j) => j.status === "open" && j.fields.includes(m[1] as Job["fields"][number])));
    return route.fulfill({ status: 404, body: "" });
  });
}
