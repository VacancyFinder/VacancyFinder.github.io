import { describe, expect, it } from "vitest";
import type { Company } from "@rekiya/shared";
import { CompaniesFile } from "@rekiya/shared";
import { draftFromIssue, parseIssueForm } from "../src/import/request.js";

const body = (o: Record<string, string>) =>
  Object.entries(o)
    .map(([k, v]) => `### ${k}\n\n${v}`)
    .join("\n\n");
const existing: Company[] = [
  {
    slug: "acme",
    name: "Acme PLC",
    website: "https://acme.lk",
    careersUrl: null,
    adapter: "none",
    adapterConfig: {},
    industry: "technology",
    cseSymbol: "ACME.N0000",
    parentGroup: null,
    sourceLists: ["cse"],
    status: "needs-discovery",
    active: true,
  },
];

describe("company request issue form", () => {
  it("parses GitHub's rendered issue-form body", () => {
    expect(parseIssueForm(body({ "Company name": "Foo", Website: "_No response_" }))).toEqual({ "Company name": "Foo", Website: "" });
  });

  it("drafts an inactive community entry", () => {
    const r = draftFromIssue(
      body({
        "Company name": "  Lanka   Software Foundry (Pvt) Ltd ",
        Website: "https://lsf.lk",
        "Careers page URL": "https://lsf.lk/careers",
        "CSE symbol (if listed)": "_No response_",
        Industry: "Technology",
        "Anything else?": "They also post on LinkedIn.",
      }),
      42,
      existing,
    );
    expect(r.company).toMatchObject({
      slug: "lanka-software-foundry",
      name: "Lanka Software Foundry (Pvt) Ltd",
      careersUrl: "https://lsf.lk/careers",
      industry: "technology",
      sourceLists: ["community"],
      status: "needs-adapter",
      active: false,
      adapter: "none",
    });
    expect(r.company!.notes).toContain("issue #42");
    expect(() => CompaniesFile.parse([...existing, r.company!])).not.toThrow();
  });

  it("rejects duplicates by slug or CSE symbol", () => {
    expect(draftFromIssue(body({ "Company name": "Acme", Industry: "Technology" }), 1, existing).error).toMatch(/Already listed/);
    expect(
      draftFromIssue(body({ "Company name": "Other", "CSE symbol (if listed)": "acme.n0000", Industry: "Banking" }), 1, existing).error,
    ).toMatch(/Already listed/);
  });

  it("ignores non-http URLs and bad symbols instead of trusting them", () => {
    const r = draftFromIssue(
      body({
        "Company name": "Safe Co",
        Website: "javascript:alert(1)",
        "Careers page URL": "ftp://x",
        "CSE symbol (if listed)": "NOPE",
        Industry: "Banking",
      }),
      7,
      existing,
    );
    expect(r.company).toMatchObject({ website: null, careersUrl: null, cseSymbol: null, status: "needs-research", industry: "banking" });
  });

  it("rejects a missing name", () => {
    expect(draftFromIssue(body({ "Company name": "_No response_" }), 1, existing).error).toBeTruthy();
  });
});
