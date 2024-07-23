import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CompaniesFile, Group, INDUSTRY_LABELS as SHARED_LABELS } from "@rekiya/shared";
import {
  DEFAULT_STATE,
  INDUSTRY_LABELS,
  accessOf,
  displayUrl,
  filterAndSort,
  parseState,
  prepare,
  safeUrl,
  serializeState,
  summarize,
} from "../../../assets/lib.js";

const ROOT = resolve(__dirname, "../../..");
const read = (p) => JSON.parse(readFileSync(resolve(ROOT, p), "utf8"));
const companies = CompaniesFile.parse(read("data/companies.json"));
const groups = Group.array().parse(read("data/groups.json"));
const all = prepare(companies, groups);
const run = (s) => filterAndSort(all, { ...DEFAULT_STATE, ...s });
const valid = { industries: Object.keys(INDUSTRY_LABELS), groups: groups.map((g) => g.slug) };

describe("site files", () => {
  it("has everything GitHub Pages serves", () => {
    for (const f of ["index.html", ".nojekyll", "assets/app.js", "assets/lib.js", "assets/styles.css", "assets/favicon.svg"]) {
      expect(existsSync(resolve(ROOT, f)), f).toBe(true);
    }
  });

  it("references only assets that exist", () => {
    const html = readFileSync(resolve(ROOT, "index.html"), "utf8");
    const refs = [...html.matchAll(/(?:src|href)="(assets\/[^"]+)"/g)].map((m) => m[1]);
    expect(refs.length).toBeGreaterThan(0);
    for (const r of refs) expect(existsSync(resolve(ROOT, r)), r).toBe(true);
  });
});

describe("data ↔ site consistency", () => {
  it("uses the same industry labels as the shared schema", () => {
    expect(INDUSTRY_LABELS).toEqual(SHARED_LABELS);
  });

  it("resolves every company's group to a name", () => {
    for (const c of all) if (c.parentGroup) expect(c.groupName, c.slug).not.toBe(c.parentGroup);
  });

  it("classifies every company by the links it really has", () => {
    for (const c of companies) {
      const expected = c.careersUrl ? "careers" : c.website ? "website" : "none";
      expect(accessOf(c), c.slug).toBe(expected);
    }
  });

  it("shows every company when no filter is set", () => {
    expect(run({})).toHaveLength(companies.length);
  });

  it("reports totals that match the data", () => {
    const s = summarize(all);
    expect(s.companies).toBe(companies.length);
    expect(s.careers).toBe(companies.filter((c) => c.careersUrl).length);
    expect(s.cse).toBe(companies.filter((c) => c.cseSymbol).length);
    expect(s.tech).toBe(companies.filter((c) => c.sourceLists.includes("tech")).length);
  });
});

describe("filters", () => {
  it("finds a company by name, symbol, or domain, ignoring case and accents", () => {
    expect(run({ q: "dialog axiata" }).map((c) => c.slug)).toContain("dialog-axiata");
    expect(run({ q: "dial.n0000" }).map((c) => c.slug)).toEqual(["dialog-axiata"]);
    expect(run({ q: "PICKME.LK" }).map((c) => c.slug)).toContain("digital-mobility-solutions-lanka-pickme");
  });

  it("requires every search word to match", () => {
    expect(run({ q: "keells zzzz-nothing" })).toEqual([]);
  });

  it("filters by industry, group, links and list", () => {
    for (const c of run({ industry: "banking" })) expect(c.industry).toBe("banking");
    expect(run({ group: "keells" })).toHaveLength(5);
    for (const c of run({ access: "careers" })) expect(c.careersUrl).toBeTruthy();
    for (const c of run({ access: "none" })) expect(c.website ?? c.careersUrl).toBeFalsy();
    for (const c of run({ list: "tech" })) expect(c.sourceLists).toContain("tech");
    const accessTotal = ["careers", "website", "none"].reduce((n, a) => n + run({ access: a }).length, 0);
    expect(accessTotal).toBe(companies.length);
  });

  it("sorts by name, or by industry then name", () => {
    const names = run({}).map((c) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base", numeric: true })));
    const byInd = run({ sort: "industry" });
    for (let i = 1; i < byInd.length; i++) {
      const a = INDUSTRY_LABELS[byInd[i - 1].industry];
      const b = INDUSTRY_LABELS[byInd[i].industry];
      expect(a.localeCompare(b, "en")).toBeLessThanOrEqual(0);
    }
  });
});

describe("URL state", () => {
  it("round-trips and omits defaults", () => {
    const s = { ...DEFAULT_STATE, q: "bank", industry: "banking", access: "careers", sort: "industry" };
    expect(serializeState(DEFAULT_STATE)).toBe("");
    expect(parseState(serializeState(s), valid)).toEqual(s);
  });

  it("ignores unknown or malicious values", () => {
    const s = parseState("?industry=nope&access=<script>&group=zzz&sort=x&list=all", valid);
    expect(s).toEqual(DEFAULT_STATE);
  });
});

describe("links", () => {
  it("only ever links http(s) URLs", () => {
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("data:text/html,hi")).toBeNull();
    expect(safeUrl("Check official website / job portals")).toBeNull();
    expect(safeUrl(null)).toBeNull();
    expect(safeUrl("https://keells.com/careers")).toBe("https://keells.com/careers");
  });

  it("shortens URLs for display", () => {
    expect(displayUrl("https://www.keells.com/careers/")).toBe("keells.com/careers");
    expect(displayUrl("https://99x.io")).toBe("99x.io");
  });

  it("every link in the data is a valid http(s) URL", () => {
    for (const c of companies) {
      if (c.careersUrl) expect(safeUrl(c.careersUrl), c.slug).not.toBeNull();
      if (c.website) expect(safeUrl(c.website), c.slug).not.toBeNull();
    }
  });
});
