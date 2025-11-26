import { describe, expect, it } from "vitest";
import { buildDirectory } from "../build/directory";
import { fieldFeed } from "../build/feeds";
import {
  activeFilterCount,
  applyFilters,
  EMPTY_FILTERS,
  parseFilters,
  serializeFilters,
  sortNewest,
  type Filters,
} from "../src/lib/filters";
import { hue, initials, isStale, relativeDays, relativeTime, safeHref } from "../src/lib/format";
import { buildIndex, searchIds } from "../src/lib/search";
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

const ctx = {
  isCse: (s: string) => s === "listed",
  companyMatches: (j: string, f: string) => j === f || (f === "grp" && j === "member"),
  isNew: (j: Job) => j.firstSeenAt > "2026-09-05",
};

describe("filters ↔ URL", () => {
  it("round-trips every filter", () => {
    const f: Filters = {
      q: "react dev",
      fields: ["software-engineering", "qa-testing"],
      industry: "banking",
      seniority: ["junior", "intern"],
      company: "acme",
      cse: true,
      workMode: "remote",
      type: "internship",
      location: "Kandy",
      newOnly: true,
      posted: "7",
      sort: "company",
    };
    expect(parseFilters(serializeFilters(f))).toEqual(f);
  });
  it("omits defaults and drops invalid values", () => {
    expect(serializeFilters(EMPTY_FILTERS).toString()).toBe("");
    const f = parseFilters(
      new URLSearchParams("fields=nope,qa-testing,qa-testing&industry=<x>&seniority=boss&workMode=moon&company=A%20B!&cse=yes"),
    );
    expect(f).toEqual({ ...EMPTY_FILTERS, fields: ["qa-testing"], company: "" });
  });
  it("counts active filters (fields and search excluded)", () => {
    expect(activeFilterCount({ ...EMPTY_FILTERS, q: "x", fields: ["other"] })).toBe(0);
    expect(activeFilterCount({ ...EMPTY_FILTERS, cse: true, location: "Galle", seniority: ["senior"] })).toBe(3);
  });
});

describe("applyFilters", () => {
  const jobs = [
    job("1"),
    job("2", { fields: ["qa-testing"], seniority: "intern", type: "internship" }),
    job("3", { company: "listed", industry: "banking", workMode: "remote", location: "Kandy · Colombo" }),
    job("4", { status: "closed" }),
    job("5", { company: "member", firstSeenAt: "2026-09-10T00:00:00.000Z" }),
  ];
  const ids = (f: Partial<Filters>) => applyFilters(jobs, { ...EMPTY_FILTERS, ...f }, ctx).map((j) => j.id);

  it("shows only open jobs", () => expect(ids({})).toEqual(["1", "2", "3", "5"]));
  it("filters by field (any of)", () => expect(ids({ fields: ["qa-testing"] })).toEqual(["2"]));
  it("filters by industry, seniority, type, work mode", () => {
    expect(ids({ industry: "banking" })).toEqual(["3"]);
    expect(ids({ seniority: ["intern", "senior"] })).toEqual(["2"]);
    expect(ids({ type: "internship" })).toEqual(["2"]);
    expect(ids({ workMode: "remote" })).toEqual(["3"]);
  });
  it("filters by company including group membership", () => {
    expect(ids({ company: "grp" })).toEqual(["5"]);
    expect(ids({ company: "acme" })).toEqual(["1", "2"]);
  });
  it("filters CSE-only, location substring and new-only", () => {
    expect(ids({ cse: true })).toEqual(["3"]);
    expect(ids({ location: "kandy" })).toEqual(["3"]);
    expect(ids({ newOnly: true })).toEqual(["5"]);
  });
  it("combines filters", () => expect(ids({ fields: ["software-engineering"], location: "colombo", cse: true })).toEqual(["3"]));
  it("sorts newest first", () => expect(sortNewest(jobs.slice(0, 5)).map((j) => j.id)[0]).toBe("5"));
});

describe("search", () => {
  const jobs = [
    job("a", { title: "Senior React Developer", location: "Colombo" }),
    job("b", { title: "Accountant", company: "bank", location: "Kandy" }),
    job("c", { title: "QA Engineer", snippet: "Selenium and Cypress automation" }),
  ];
  const ms = buildIndex(jobs, (s) => (s === "bank" ? "Sampath Bank PLC" : "Acme"));
  it("finds by title, company, location and snippet", () => {
    expect(searchIds(ms, "react")).toEqual(["a"]);
    expect(searchIds(ms, "sampath")).toEqual(["b"]);
    expect(searchIds(ms, "kandy")).toEqual(["b"]);
    expect(searchIds(ms, "cypress")).toEqual(["c"]);
  });
  it("tolerates typos and prefixes", () => {
    expect(searchIds(ms, "develper")).toContain("a");
    expect(searchIds(ms, "accoun")).toContain("b");
  });
  it("returns null for an empty query", () => expect(searchIds(ms, "  ")).toBeNull());
});

describe("format", () => {
  const now = new Date("2026-09-30T10:00:00Z");
  it("relative days", () => {
    expect(relativeDays("2026-09-30T01:00:00Z", now)).toBe("today");
    expect(relativeDays("2026-09-29T01:00:00Z", now)).toBe("yesterday");
    expect(relativeDays("2026-09-25", now)).toBe("5 days ago");
    expect(relativeDays("2026-09-02", now)).toBe("4 weeks ago");
  });
  it("relative time and staleness", () => {
    expect(relativeTime("2026-09-30T07:00:00Z", now.getTime())).toBe("3 h ago");
    expect(isStale("2026-09-29T21:00:00Z", now.getTime())).toBe(true);
    expect(isStale("2026-09-30T05:00:00Z", now.getTime())).toBe(false); // 5 h: one late sync is not "stale"
    expect(isStale("2026-09-30T03:00:00Z", now.getTime())).toBe(true); // 7 h: two syncs missed
  });
  it("initials and stable colours", () => {
    expect(initials("John Keells Holdings PLC")).toBe("JK");
    expect(initials("99x")).toBe("99");
    expect(initials("Digital Mobility Solutions Lanka PLC (PickMe)")).toBe("DM");
    expect(hue("acme")).toBe(hue("acme"));
  });
  it("only links http(s)", () => {
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("https://a.lk/x")).toBe("https://a.lk/x");
  });
});

describe("build: RSS feed", () => {
  it("is valid-looking RSS with escaped content, newest first, open only", () => {
    const xml = fieldFeed(
      "software-engineering",
      [job("1", { title: "Dev <Lead> & Co" }), job("2", { firstSeenAt: "2026-09-09T00:00:00.000Z" }), job("3", { status: "closed" })],
      () => "Acme & Sons",
      "2026-09-30T00:00:00.000Z",
    );
    expect(xml).toMatch(/^<\?xml version="1.0"/);
    expect(xml).toContain("Dev &lt;Lead&gt; &amp; Co — Acme &amp; Sons");
    expect(xml.indexOf('<guid isPermaLink="false">2</guid>')).toBeLessThan(xml.indexOf('<guid isPermaLink="false">1</guid>'));
    expect(xml).not.toContain('<guid isPermaLink="false">3</guid>');
  });
});

describe("build: directory", () => {
  it("projects companies and attaches crawl health", () => {
    const d = buildDirectory(
      [
        {
          slug: "acme",
          name: "Acme",
          website: null,
          careersUrl: "https://acme.lk/careers",
          adapter: "lever",
          adapterConfig: { site: "acme" },
          industry: "technology",
          cseSymbol: null,
          parentGroup: null,
          sourceLists: ["tech"],
          status: "ready",
          active: true,
        },
      ],
      [],
      {
        t: {
          target: "t",
          url: "https://acme.lk/careers",
          adapter: "lever",
          companies: ["acme"],
          lastRunAt: "2026-09-30T00:00:00.000Z",
          lastSuccessAt: null,
          lastError: "boom",
          consecutiveFailures: 2,
          jobCount: 0,
          suspect: false,
        },
      },
    );
    expect(d.companies[0]).toMatchObject({ slug: "acme", health: { ok: false, consecutiveFailures: 2 } });
    expect(d.companies[0]).not.toHaveProperty("adapterConfig");
  });
});
