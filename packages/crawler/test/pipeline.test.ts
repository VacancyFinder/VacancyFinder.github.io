import { describe, expect, it } from "vitest";
import type { Company, Job } from "@rekiya/shared";
import { Job as JobSchema } from "@rekiya/shared";
import { diffJobs, isSuspect, type TargetOutcome } from "../src/pipeline/diff.js";
import { applyOverrides, attribute, canonicalListingUrl, groupIndustry, jobId, normalizeJob } from "../src/pipeline/normalize.js";

const company = (slug: string, name: string, industry: Company["industry"] = "technology"): Company => ({
  slug,
  name,
  website: null,
  careersUrl: null,
  adapter: "none",
  adapterConfig: {},
  industry,
  cseSymbol: null,
  parentGroup: null,
  sourceLists: ["tech"],
  status: "ready",
  active: true,
});

const T0 = "2026-09-01T00:00:00.000Z";
const T1 = "2026-09-01T03:00:00.000Z";
const T2 = "2026-09-01T06:00:00.000Z";

function job(id: string, over: Partial<Job> = {}): Job {
  return {
    id: id.padEnd(40, "0"),
    title: `Job ${id}`,
    company: "acme",
    industry: "technology",
    fields: ["software-engineering"],
    seniority: "unspecified",
    type: "unspecified",
    workMode: "unspecified",
    location: "Colombo",
    snippet: "",
    url: `https://acme.lk/jobs/${id}`,
    source: "lever",
    postedAt: null,
    firstSeenAt: T0,
    lastSeenAt: T0,
    status: "open",
    missedRuns: 0,
    closedAt: null,
    ...over,
  };
}

const ok = (): TargetOutcome => "ok";

describe("diff (spec §9)", () => {
  it("adds new jobs with firstSeenAt = now", () => {
    const r = diffJobs({ previous: [], current: [job("a", { firstSeenAt: T1 })], outcomeOf: ok, now: T1 });
    expect(r.added).toHaveLength(1);
    expect(r.jobs[0]).toMatchObject({ firstSeenAt: T1, lastSeenAt: T1, status: "open", missedRuns: 0 });
  });

  it("updates lastSeenAt and mutable fields, keeps firstSeenAt", () => {
    const prev = [job("a", { missedRuns: 1 })];
    const r = diffJobs({ previous: prev, current: [job("a", { title: "Renamed", firstSeenAt: T1 })], outcomeOf: ok, now: T1 });
    expect(r.added).toHaveLength(0);
    expect(r.jobs[0]).toMatchObject({ title: "Renamed", firstSeenAt: T0, lastSeenAt: T1, missedRuns: 0 });
  });

  it("closes a job only after it is missing for 2 successful runs", () => {
    const r1 = diffJobs({ previous: [job("a")], current: [], outcomeOf: ok, now: T1 });
    expect(r1.jobs[0]).toMatchObject({ status: "open", missedRuns: 1 });
    expect(r1.closed).toHaveLength(0);
    const r2 = diffJobs({ previous: r1.jobs, current: [], outcomeOf: ok, now: T2 });
    expect(r2.jobs[0]).toMatchObject({ status: "closed", missedRuns: 2, closedAt: T2 });
    expect(r2.closed).toHaveLength(1);
  });

  it("never touches a failed company's jobs", () => {
    const prev = [job("a", { missedRuns: 1 })];
    const r = diffJobs({ previous: prev, current: [], outcomeOf: () => "failed", now: T1 });
    expect(r.jobs).toEqual(prev);
    expect(r.closed).toHaveLength(0);
  });

  it("keeps a suspect company's jobs (0 results after >= 3)", () => {
    expect(isSuspect(3, 0)).toBe(true);
    expect(isSuspect(2, 0)).toBe(false);
    expect(isSuspect(5, 1)).toBe(false);
    const prev = [job("a"), job("b"), job("c")];
    const r = diffJobs({ previous: prev, current: [], outcomeOf: () => "suspect", now: T1 });
    expect(r.jobs.every((j) => j.status === "open" && j.missedRuns === 0)).toBe(true);
  });

  it("treats 304 Not Modified as still open", () => {
    const r = diffJobs({ previous: [job("a", { missedRuns: 1 })], current: [], outcomeOf: () => "not-modified", now: T1 });
    expect(r.jobs[0]).toMatchObject({ status: "open", missedRuns: 0, lastSeenAt: T1 });
  });

  it("reopens a closed job that reappears", () => {
    const prev = [job("a", { status: "closed", closedAt: T0, missedRuns: 2 })];
    const r = diffJobs({ previous: prev, current: [job("a")], outcomeOf: ok, now: T1 });
    expect(r.jobs[0]).toMatchObject({ status: "open", closedAt: null, missedRuns: 0 });
    expect(r.added).toHaveLength(1);
  });

  it("archives jobs closed more than 30 days ago", () => {
    const old = job("a", { status: "closed", closedAt: "2026-07-01T00:00:00.000Z" });
    const recent = job("b", { status: "closed", closedAt: "2026-08-20T00:00:00.000Z" });
    const r = diffJobs({ previous: [old, recent], current: [], outcomeOf: ok, now: T1 });
    expect(r.archived.map((j) => j.id)).toEqual([old.id]);
    expect(r.jobs.map((j) => j.id)).toEqual([recent.id]);
  });

  it("closes jobs of a company that is no longer crawled", () => {
    const r = diffJobs({ previous: [job("a")], current: [], outcomeOf: () => undefined, now: T1 });
    expect(r.jobs[0]!.status).toBe("closed");
  });

  it("sorts open jobs newest first, closed last", () => {
    const r = diffJobs({
      previous: [job("a", { firstSeenAt: T0 }), job("z", { status: "closed", closedAt: T0 })],
      current: [job("a"), job("b")],
      outcomeOf: ok,
      now: T1,
    });
    expect(r.jobs.map((j) => j.id[0])).toEqual(["b", "a", "z"]);
  });
});

describe("listing ids", () => {
  it("canonicalises host, trailing slash, hash and tracking params", () => {
    expect(canonicalListingUrl("https://WWW.Acme.lk/jobs/1/?utm_source=x&lever-source=li#apply")).toBe("https://acme.lk/jobs/1");
    expect(canonicalListingUrl("http://acme.lk/job?id=7&ref=home")).toBe("https://acme.lk/job?id=7");
    expect(canonicalListingUrl("https://acme.lk/careers#job-software-engineer")).toBe("https://acme.lk/careers#job-software-engineer");
  });
  it("is sha1 of company + canonical url and stable across trivial URL changes", () => {
    expect(jobId("acme", "https://acme.lk/jobs/1")).toMatch(/^[0-9a-f]{40}$/);
    expect(jobId("acme", "https://www.acme.lk/jobs/1/?utm_medium=x")).toBe(jobId("acme", "https://acme.lk/jobs/1"));
    expect(jobId("acme", "https://acme.lk/job?id=1")).not.toBe(jobId("acme", "https://acme.lk/job?id=2"));
    expect(jobId("a", "https://acme.lk/jobs/1")).not.toBe(jobId("b", "https://acme.lk/jobs/1"));
  });
});

describe("attribution to group or subsidiary", () => {
  const jkh = company("john-keells-holdings", "John Keells Holdings PLC", "diversified");
  const ccs = company("ceylon-cold-stores", "Ceylon Cold Stores PLC", "food-beverage-tobacco");
  const kfp = company("keells-food-products", "Keells Food Products PLC", "food-beverage-tobacco");
  const oct = company("octave", "Octave");
  const a = { companies: [jkh, ccs, kfp], parentGroup: "keells", extra: [{ company: oct, pattern: /\boctave\b/i }] };
  const raw = (title: string, department?: string) => ({ title, url: "https://keells.com/j/1", department });

  it("attributes to the group by default", () => expect(attribute(raw("Accountant"), a)).toEqual({ slug: "keells", group: true }));
  it("attributes to a subsidiary named in the listing", () => {
    expect(attribute(raw("Sales Executive - Ceylon Cold Stores"), a)).toBe(ccs);
    expect(attribute(raw("Chef", "Keells Food Products"), a)).toBe(kfp);
  });
  it("uses extra attribution patterns", () => expect(attribute(raw("Data Engineer - Octave"), a)).toBe(oct));
  it("stays with the group when two subsidiaries are named", () => {
    expect(attribute(raw("Ceylon Cold Stores / Keells Food Products Merchandiser"), a)).toEqual({ slug: "keells", group: true });
  });
  it("gives single-company targets to that company", () => {
    expect(attribute(raw("Anything"), { companies: [ccs], parentGroup: null, extra: [] })).toBe(ccs);
  });
  it("derives a group industry", () => {
    expect(groupIndustry([ccs, kfp])).toBe("food-beverage-tobacco");
    expect(groupIndustry([ccs, jkh])).toBe("diversified");
  });
});

describe("normalizeJob", () => {
  const acme = company("acme", "Acme");
  const ctx = { attribution: { companies: [acme], parentGroup: null, extra: [] }, source: "lever", now: T1, overrides: null };

  it("produces a schema-valid, classified job", () => {
    const r = normalizeJob(
      {
        title: "  Senior&nbsp;Software Engineer – Java ",
        url: "https://jobs.lever.co/acme/123",
        location: "Colombo 03, Sri Lanka",
        description: `<p>${"Build services. ".repeat(40)}</p>`,
        employmentType: "Full-time",
        workplace: "hybrid",
        postedAt: 1788220800000,
      },
      ctx,
    );
    expect(r.job).toBeDefined();
    const j = r.job!;
    expect(() => JobSchema.parse(j)).not.toThrow();
    expect(j).toMatchObject({
      title: "Senior Software Engineer – Java",
      company: "acme",
      seniority: "senior",
      type: "full-time",
      workMode: "hybrid",
      location: "Colombo",
      postedAt: "2026-09-01",
      status: "open",
    });
    expect(j.fields).toContain("software-engineering");
    expect(j.snippet.length).toBeLessThanOrEqual(300);
  });

  it("drops listings without a title or with a bad URL", () => {
    expect(normalizeJob({ title: "   ", url: "https://a.lk/x" }, ctx).dropped).toBeTruthy();
    expect(normalizeJob({ title: "Engineer", url: "not a url" }, ctx).dropped).toBeTruthy();
  });

  it("applies a location filter for global ATS accounts", () => {
    const f = { ...ctx, locationFilter: /sri lanka|colombo/i };
    expect(normalizeJob({ title: "Engineer", url: "https://a.lk/1", location: "London, UK" }, f).dropped).toBe("outside location filter");
    expect(normalizeJob({ title: "Engineer", url: "https://a.lk/1", location: "Colombo, Sri Lanka" }, f).job).toBeDefined();
  });

  it("marks interns as internships", () => {
    expect(normalizeJob({ title: "Software Engineering Intern", url: "https://a.lk/1" }, ctx).job?.type).toBe("internship");
  });
});

describe("overrides", () => {
  it("applies title patterns, then per-id fixes", () => {
    const j = job("a", { title: "SAP ABAP Consultant" });
    const out = applyOverrides(j, {
      titlePatterns: [{ match: "\\bSAP\\b", set: { fields: ["software-engineering"] } }],
      jobs: { [j.id]: { seniority: "senior" } },
    });
    expect(out.fields).toEqual(["software-engineering"]);
    expect(out.seniority).toBe("senior");
  });
});
