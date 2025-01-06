import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CompaniesFile,
  CseSourceFile,
  TechSourceFile,
  isSharedHost,
  normaliseIndustry,
  ownerDomainOf,
  type Company,
  type CseSourceRecord,
  type TechSourceRecord,
} from "@rekiya/shared";
import { importCompanies } from "../src/import/importCompanies.js";

const DATA = resolve(__dirname, "../../../data/sources");
const cse = CseSourceFile.parse(JSON.parse(readFileSync(resolve(DATA, "cse_listed_companies_career_pages.json"), "utf8")));
const tech = TechSourceFile.parse(JSON.parse(readFileSync(resolve(DATA, "tech_companies.json"), "utf8")));
const run = (existing: Company[] = [], t: TechSourceRecord[] = tech, c: CseSourceRecord[] = cse) =>
  importCompanies({ cse: c, tech: t, existing, existingGroups: [] });

const first = run();
const bySlug = (list: Company[], slug: string) => {
  const c = list.find((x) => x.slug === slug);
  if (!c) throw new Error(`no company ${slug}`);
  return c;
};

describe("source file report", () => {
  it("matches the numbers stated in the spec", () => {
    expect(first.report.cse).toMatchObject({
      total: 270,
      withCareersUrl: 60,
      placeholder: 210,
      noWebsite: 118,
      uniqueCareersUrls: 41,
    });
    expect(first.report.cse.otherInvalidCareersValue).toEqual([]);
  });

  it("maps every raw industry value to the enum", () => {
    expect(first.report.unknownIndustries).toEqual([]);
    for (const r of cse) expect(normaliseIndustry(r.industry), r.industry).not.toBeNull();
  });

  it("produces schema-valid output", () => {
    expect(() => CompaniesFile.parse(first.companies)).not.toThrow();
    expect(first.companies).toHaveLength(270 + 28 - first.report.overlaps.length);
  });
});

describe("placeholder handling", () => {
  it("never turns the placeholder into a careers URL", () => {
    for (const c of first.companies) {
      if (c.careersUrl) expect(c.careersUrl).toMatch(/^https?:\/\//);
    }
    const placeholderSymbols = new Set(cse.filter((r) => !r.career_page.startsWith("http")).map((r) => r.symbol));
    for (const c of first.companies.filter((x) => x.cseSymbol && placeholderSymbols.has(x.cseSymbol))) {
      expect(c.careersUrl).toBeNull();
    }
  });

  it("assigns status from what is known", () => {
    for (const c of first.companies) {
      if (c.careersUrl) expect(c.status).toBe("needs-adapter");
      else if (c.website) expect(c.status).toBe("needs-discovery");
      else expect(c.status).toBe("needs-research");
    }
  });
});

describe("tech ↔ CSE overlap", () => {
  it("matches Dialog Axiata and PickMe by domain, and nothing else", () => {
    expect(first.report.overlaps.map((o) => o.symbol).sort()).toEqual(["DIAL.N0000", "PKME.N0000"]);
    expect(bySlug(first.companies, "dialog-axiata").sourceLists).toEqual(["tech", "cse"]);
  });

  it("does not tag Dialog Finance as tech even though it shares dialog.lk", () => {
    expect(bySlug(first.companies, "dialog-finance").sourceLists).toEqual(["cse"]);
  });

  it("never matches Millennium IT to Millennium Housing Developers", () => {
    const withSite = tech.map((t) => (t.name === "Millennium IT" ? { ...t, website: "https://www.millenniumit.com" } : t));
    const r = run([], withSite);
    expect(r.report.overlaps.find((o) => o.tech === "Millennium IT")).toBeUndefined();
    expect(bySlug(r.companies, "millennium-it").sourceLists).toEqual(["tech"]);
    expect(bySlug(r.companies, "millennium-housing-developers").sourceLists).toEqual(["cse"]);
  });

  it("flags a tech company whose domain matches several CSE names equally", () => {
    const r = run([], [{ name: "Unrelated Co", website: "https://www.dialog.lk", careersUrl: null }]);
    expect(r.report.ambiguousOverlaps).toHaveLength(1);
    expect(r.report.overlaps).toHaveLength(0);
  });
});

describe("groups and crawl targets", () => {
  it("fetches each shared group page once", () => {
    const keells = first.targets.find((t) => t.canonicalUrl === "https://keells.com/careers");
    expect(keells?.companySlugs).toHaveLength(5);
    expect(keells?.parentGroup).toBe("keells");
    // The spec's 60 CSE careers URLs collapse to 41 pages; tech-only careers pages add their own targets.
    const bySlugMap = new Map(first.companies.map((c) => [c.slug, c]));
    const cseTargets = first.targets.filter((t) => t.companySlugs.some((s) => bySlugMap.get(s)?.cseSymbol));
    expect(cseTargets).toHaveLength(41);
    const techOnly = first.companies.filter((c) => !c.cseSymbol && c.careersUrl).length;
    expect(first.targets).toHaveLength(41 + techOnly);
    expect(new Set(first.targets.map((t) => t.id)).size).toBe(first.targets.length);
  });

  it("gives single-company targets no parent group", () => {
    const single = first.targets.filter((t) => t.companySlugs.length === 1);
    for (const t of single) expect(t.parentGroup).toBeNull();
  });

  it("derives the expected careers-page groups", () => {
    const careersGroups = first.report.groups
      .filter((g) => g.via === "careers")
      .map((g) => g.slug)
      .sort();
    expect(careersGroups).toEqual(
      ["aitkenspence", "brownsgroup", "cargillsceylon", "dialog", "hayleys-group", "keells", "lolc", "softlogic"].sort(),
    );
  });
});

describe("idempotency and hand edits", () => {
  it("re-running on its own output changes nothing", () => {
    const second = run(first.companies);
    expect(second.companies).toEqual(first.companies);
    expect(second.targets).toEqual(first.targets);
  });

  it("preserves adapter, adapterConfig, notes and active, and recomputes status", () => {
    const edited = first.companies.map((c) =>
      c.slug === "hayleys"
        ? { ...c, adapter: "html" as const, adapterConfig: { listSelector: ".job" }, notes: "checked by hand", active: false }
        : c,
    );
    const r = run(edited);
    const h = bySlug(r.companies, "hayleys");
    expect(h).toMatchObject({
      adapter: "html",
      adapterConfig: { listSelector: ".job" },
      notes: "checked by hand",
      active: false,
      status: "ready",
    });
  });

  it("keeps a careers URL added by hand to a needs-discovery company", () => {
    const target = first.companies.find((c) => c.status === "needs-discovery" && c.cseSymbol)!;
    const edited = first.companies.map((c) => (c.slug === target.slug ? { ...c, careersUrl: "https://example.lk/careers" } : c));
    const r = run(edited);
    expect(bySlug(r.companies, target.slug)).toMatchObject({ careersUrl: "https://example.lk/careers", status: "needs-adapter" });
    expect(r.targets.some((t) => t.canonicalUrl === "https://example.lk/careers")).toBe(true);
  });

  it("keeps a disabled company disabled and out of crawl targets", () => {
    const edited = first.companies.map((c) => (c.slug === "sampath-bank" ? { ...c, status: "disabled" as const } : c));
    const r = run(edited);
    expect(bySlug(r.companies, "sampath-bank").status).toBe("disabled");
    expect(r.targets.some((t) => t.companySlugs.includes("sampath-bank"))).toBe(false);
  });
});

describe("shared hosts (job boards / ATS)", () => {
  const rec = (name: string, symbol: string, site: string, careers: string): CseSourceRecord => ({
    company_name: name,
    symbol,
    website: site,
    career_page: careers,
    industry: "Banking",
  });
  const cseOnAts = [
    rec("Alpha PLC", "ALP.N0000", "https://alpha.lk", "https://jobs.lever.co/alpha"),
    rec("Beta PLC", "BET.N0000", "https://beta.lk", "https://jobs.lever.co/beta"),
  ];

  it("never derives a parent group from a shared ATS host", () => {
    const r = run([], [], cseOnAts);
    expect(r.groups).toEqual([]);
    for (const c of r.companies) expect(c.parentGroup).toBeNull();
    expect(r.targets).toHaveLength(2);
  });

  it("never matches a tech company to a CSE company through a shared ATS host", () => {
    const r = run([], [{ name: "Gamma Tech", website: null, careersUrl: "https://jobs.lever.co/gamma" }], cseOnAts);
    expect(r.report.overlaps).toEqual([]);
    expect(r.report.ambiguousOverlaps).toEqual([]);
    expect(bySlug(r.companies, "gamma-tech").sourceLists).toEqual(["tech"]);
  });

  it("identifies shared hosts and their subdomains only", () => {
    expect(isSharedHost("jobs.lever.co")).toBe(true);
    expect(isSharedHost("apply.workable.com")).toBe(true);
    expect(isSharedHost("lk.linkedin.com")).toBe(true);
    expect(isSharedHost("notlever.co")).toBe(false);
    expect(isSharedHost("keells.com")).toBe(false);
    expect(ownerDomainOf("https://www.dialog.lk/careers")).toBe("dialog.lk");
    expect(ownerDomainOf("https://boards.greenhouse.io/acme")).toBeNull();
  });
});

describe("slug collisions", () => {
  const twins: TechSourceRecord[] = [
    { name: "Acme", website: "https://acme.com", careersUrl: null },
    { name: "Acme Ltd", website: "https://acme.io", careersUrl: null },
  ];

  it("gives two tech companies with the same base slug distinct slugs", () => {
    const r = run([], twins, []);
    expect(r.companies.map((c) => c.slug).sort()).toEqual(["acme", "acme-2"]);
    expect(() => CompaniesFile.parse(r.companies)).not.toThrow();
  });

  it("keeps those slugs stable when re-run, whatever the source order", () => {
    const r1 = run([], twins, []);
    const r2 = run(r1.companies, [...twins].reverse(), []);
    const slugOf = (list: Company[], name: string) => list.find((c) => c.name === name)?.slug;
    for (const t of twins) expect(slugOf(r2.companies, t.name)).toBe(slugOf(r1.companies, t.name));
    expect(() => CompaniesFile.parse(r2.companies)).not.toThrow();
  });
});

describe("community companies", () => {
  it("keeps hand-added community entries across re-imports and crawls them", () => {
    const community: Company = {
      slug: "acme-labs",
      name: "Acme Labs",
      website: "https://acmelabs.lk",
      careersUrl: "https://acmelabs.lk/careers",
      adapter: "none",
      adapterConfig: {},
      industry: "technology",
      cseSymbol: null,
      parentGroup: null,
      sourceLists: ["community"],
      status: "needs-adapter",
      active: false,
      notes: "Requested in #12",
    };
    const r = run([...first.companies, community]);
    expect(bySlug(r.companies, "acme-labs")).toMatchObject({ active: false, notes: "Requested in #12", status: "needs-adapter" });
    // Inactive: no crawl target until someone reviews and activates it.
    expect(r.targets.some((t) => t.companySlugs.includes("acme-labs"))).toBe(false);
    const active = run([...first.companies, { ...community, active: true, adapter: "html", adapterConfig: { listSelector: ".job" } }]);
    expect(bySlug(active.companies, "acme-labs").status).toBe("ready");
    expect(active.targets.some((t) => t.companySlugs.includes("acme-labs"))).toBe(true);
  });
});

describe("group slugs never collide with company slugs", () => {
  it("names the Hayleys group hayleys-group, not hayleys (the company)", () => {
    const slugs = new Set(first.companies.map((c) => c.slug));
    for (const g of first.groups) expect(slugs.has(g.slug), g.slug).toBe(false);
    expect(first.groups.find((g) => g.slug === "hayleys-group")?.name).toBe("Hayleys Group");
    expect(bySlug(first.companies, "haycarb").parentGroup).toBe("hayleys-group");
  });
  it("migrates an existing parentGroup that collides", () => {
    const old = first.companies.map((c) => (c.parentGroup === "hayleys-group" ? { ...c, parentGroup: "hayleys" } : c));
    const r = run(old);
    expect(bySlug(r.companies, "hayleys").parentGroup).toBe("hayleys-group");
  });
});
