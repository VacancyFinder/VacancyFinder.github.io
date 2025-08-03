import { beforeEach, describe, expect, it } from "vitest";
import {
  activeChips,
  applyFilters,
  describeFilters,
  EMPTY_FILTERS,
  parseFilters,
  QUICK_FILTERS,
  similarJobs,
  sortJobs,
  type Filters,
} from "../src/lib/filters";
import { cleanSnippet, formatDate, nextSyncLabel, toCsv } from "../src/lib/format";
import { clearAll, exportBackup, importBackup, KEYS, loadSaved, normalizeSaved } from "../src/lib/storage";
import type { Job } from "../src/lib/types";

const job = (id: string, over: Partial<Job> = {}): Job => ({
  id,
  title: "Software Engineer",
  company: "acme",
  industry: "technology",
  fields: ["software-engineering"],
  seniority: "unspecified",
  type: "full-time",
  workMode: "onsite",
  location: "Colombo",
  snippet: "",
  url: `https://acme.lk/jobs/${id}`,
  source: "lever",
  postedAt: null,
  firstSeenAt: "2026-09-01T00:00:00.000Z",
  lastSeenAt: "2026-09-01T00:00:00.000Z",
  status: "open",
  missedRuns: 0,
  closedAt: null,
  ...over,
});

const ctx = { isCse: () => false, companyMatches: (a: string, b: string) => a === b, isNew: () => false };

describe("date posted, sorting and hiding", () => {
  const now = Date.parse("2026-09-30T12:00:00Z");
  const jobs = [
    job("old", { postedAt: "2026-08-01T00:00:00Z" }),
    job("week", { postedAt: "2026-09-26T00:00:00Z", company: "zeta" }),
    job("today", { firstSeenAt: "2026-09-30T06:00:00Z", company: "beta" }),
  ];
  const ids = (f: Partial<Filters>, extra = {}) =>
    applyFilters(jobs, { ...EMPTY_FILTERS, ...f }, { ...ctx, now, ...extra }).map((j) => j.id);

  it("uses the company's posted date, else when Rekiya first saw the job", () => {
    expect(ids({ posted: "1" })).toEqual(["today"]);
    expect(ids({ posted: "7" })).toEqual(["week", "today"]);
    expect(ids({ posted: "30" })).toEqual(["week", "today"]);
    expect(ids({})).toHaveLength(3);
  });
  it("drops hidden jobs", () => expect(ids({}, { isHidden: (j: Job) => j.id === "week" })).toEqual(["old", "today"]));
  it("sorts by posted date and by company name", () => {
    expect(sortJobs(jobs, "posted", (s) => s).map((j) => j.id)).toEqual(["today", "week", "old"]);
    expect(sortJobs(jobs, "company", (s) => s).map((j) => j.company)).toEqual(["acme", "beta", "zeta"]);
  });
  it("ignores unknown sort / posted values in the URL", () => {
    expect(parseFilters(new URLSearchParams("sort=price&posted=2"))).toEqual(EMPTY_FILTERS);
  });
});

describe("chips and quick filters", () => {
  it("lists one removable chip per value", () => {
    const f: Filters = {
      ...EMPTY_FILTERS,
      q: "react",
      fields: ["qa-testing", "data-ai-ml"],
      workMode: "remote",
      company: "acme",
      posted: "7",
    };
    const chips = activeChips(f, () => "Acme PLC");
    expect(chips.map((c) => c.label)).toEqual(["“react”", "QA & Testing", "Data & AI / ML", "Remote", "Posted: last 7 days", "Acme PLC"]);
    // Removing one field keeps the other.
    expect(chips[1]!.remove).toEqual({ fields: ["data-ai-ml"] });
  });
  it("quick filters toggle on and off", () => {
    const entry = QUICK_FILTERS.find((q) => q.key === "entry")!;
    const on = { ...EMPTY_FILTERS, ...entry.toggle(EMPTY_FILTERS) };
    expect(entry.isOn(on)).toBe(true);
    expect(on.seniority).toEqual(["intern", "trainee", "junior"]);
    expect({ ...on, ...entry.toggle(on) }.seniority).toEqual([]);
  });
  it("names a saved search from its filters", () => {
    expect(describeFilters({ ...EMPTY_FILTERS, q: "java", type: "internship" }, (s) => s)).toBe("“java” · Internship");
    expect(describeFilters(EMPTY_FILTERS, (s) => s)).toBe("All jobs");
  });
});

describe("similar jobs", () => {
  it("ranks by shared fields, then level, excluding the job itself and closed ones", () => {
    const base = job("x", { fields: ["data-ai-ml", "software-engineering"], seniority: "senior" });
    const all = [
      base,
      job("both", { fields: ["data-ai-ml", "software-engineering"] }),
      job("one-senior", { fields: ["data-ai-ml"], seniority: "senior" }),
      job("one", { fields: ["data-ai-ml"] }),
      job("none", { fields: ["healthcare"] }),
      job("closed", { fields: ["data-ai-ml", "software-engineering"], status: "closed" }),
    ];
    expect(similarJobs(base, all).map((j) => j.id)).toEqual(["both", "one-senior", "one"]);
  });
});

describe("text helpers", () => {
  it("drops a snippet's echo of the title", () => {
    expect(cleanSnippet("Associate Manager – Finance", "Associate Manager – Finance The job holder is responsible for returns")).toBe(
      "The job holder is responsible for returns",
    );
    expect(cleanSnippet("QA Lead", "QA Lead: owns the automation strategy for the platform")).toBe(
      "owns the automation strategy for the platform",
    );
    expect(cleanSnippet("QA Lead", "We need a QA Lead to own automation")).toBe("We need a QA Lead to own automation");
    expect(cleanSnippet("Intern", "Intern.")).toBe("");
  });
  it("writes safe CSV", () => {
    expect(toCsv([["a,b", 'say "hi"', "=HYPERLINK(1)", null]])).toBe('"a,b","say ""hi""",\'=HYPERLINK(1),\r\n');
  });
  it("formats dates day-month-year", () => expect(formatDate("2026-09-30T00:00:00Z")).toMatch(/30 Sept? 2026/));
});

describe("storage", () => {
  beforeEach(() => clearAll());

  it("upgrades v1 saved jobs to tracker statuses", () => {
    const s = normalizeSaved({
      a: { title: "A", company: "x", url: "u", savedAt: "2026-01-01T00:00:00Z", applied: true },
      b: { title: "B", company: "x", url: "u", savedAt: "2026-01-01T00:00:00Z", applied: false },
      c: { title: "C", status: "interviewing", notes: "call Mon" },
      junk: "nope",
    });
    expect(Object.keys(s)).toEqual(["a", "b", "c"]);
    expect(s.a!.status).toBe("applied");
    expect(s.b!.status).toBe("saved");
    expect(s.c).toMatchObject({ status: "interviewing", notes: "call Mon" });
  });

  it("round-trips a backup and rejects foreign files", () => {
    localStorage.setItem(KEYS.saved, JSON.stringify({ a: { title: "A", company: "x", url: "u", applied: true } }));
    localStorage.setItem(KEYS.searches, JSON.stringify([{ id: "s1", name: "QA", params: "fields=qa-testing" }]));
    const b = exportBackup(new Date("2026-09-30T00:00:00Z"));
    clearAll();
    expect(loadSaved()).toEqual({});
    expect(importBackup(JSON.parse(JSON.stringify(b)))).toBe(2);
    expect(loadSaved().a!.status).toBe("applied");
    expect(() => importBackup({ hello: "world" })).toThrow(/isn't a Rekiya backup/);
  });
});

describe("sync schedule label", () => {
  const H = 3600_000;
  it("gives the next 3-hourly sync in Sri Lanka time", () => {
    // 10:00 UTC = 15:30 in Colombo; +3 h = 18:30 → "6:30 pm".
    expect(nextSyncLabel("2026-09-30T10:00:00Z", 3 * H, Date.parse("2026-09-30T11:00:00Z"))).toBe("around 6:30 pm");
  });
  it("says 'any minute now' once a sync is due or late", () => {
    expect(nextSyncLabel("2026-09-30T10:00:00Z", 3 * H, Date.parse("2026-09-30T13:30:00Z"))).toBe("any minute now");
    expect(nextSyncLabel("not a date", 3 * H)).toBe("any minute now");
  });
});
