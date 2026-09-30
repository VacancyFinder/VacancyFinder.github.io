/**
 * pnpm --filter @rekiya/crawler request:company
 * Turns a "Suggest a company" issue (body in $ISSUE_BODY, number in $ISSUE_NUMBER) into a draft
 * companies.json entry with active: false. A maintainer reviews the PR, picks an adapter and activates it.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CompaniesFile, INDUSTRY_LABELS, INDUSTRY_SLUGS, isHttpUrl, type Company, type IndustrySlug } from "@rekiya/shared";
import { companySlug } from "./slug.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

/** GitHub renders issue forms as "### Label\n\nvalue" sections. */
export function parseIssueForm(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of body.split(/^###\s+/m).slice(1)) {
    const [label, ...rest] = part.split("\n");
    const value = rest.join("\n").trim();
    out[label!.trim()] = value === "_No response_" ? "" : value;
  }
  return out;
}

export function draftFromIssue(body: string, issueNumber: number, existing: Company[]): { company?: Company; error?: string } {
  const f = parseIssueForm(body);
  const name = (f["Company name"] ?? "").replace(/\s+/g, " ").trim();
  if (!name || name.length > 120) return { error: "Company name is missing or too long." };
  const website = f["Website"] && isHttpUrl(f["Website"]) ? f["Website"].trim() : null;
  const careersUrl = f["Careers page URL"] && isHttpUrl(f["Careers page URL"]) ? f["Careers page URL"].trim() : null;
  const cse = (f["CSE symbol (if listed)"] ?? "").trim().toUpperCase();
  const cseSymbol = /^[A-Z0-9]+\.[A-Z]\d{4}$/.test(cse) ? cse : null;
  const industry = (INDUSTRY_SLUGS.find((s) => INDUSTRY_LABELS[s] === f["Industry"]) ?? "services") as IndustrySlug;

  let slug = companySlug(name);
  if (!slug) return { error: "Company name has no letters or digits." };
  const dup = existing.find((c) => c.slug === slug || (cseSymbol && c.cseSymbol === cseSymbol));
  if (dup) return { error: `Already listed as "${dup.name}" (${dup.slug}).` };
  for (let n = 2; existing.some((c) => c.slug === slug); n++) slug = `${companySlug(name)}-${n}`;

  const extra = (f["Anything else?"] ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
  return {
    company: {
      slug,
      name,
      website,
      careersUrl,
      adapter: "none",
      adapterConfig: {},
      industry,
      cseSymbol,
      parentGroup: null,
      sourceLists: ["community"],
      status: careersUrl ? "needs-adapter" : website ? "needs-discovery" : "needs-research",
      active: false,
      notes: `Requested in issue #${issueNumber}.${extra ? ` Requester notes: ${extra}` : ""}`,
    },
  };
}

function main(): void {
  const body = process.env.ISSUE_BODY ?? "";
  const num = Number(process.env.ISSUE_NUMBER ?? "0");
  const path = resolve(ROOT, "data/companies.json");
  const companies = CompaniesFile.parse(JSON.parse(readFileSync(path, "utf8")));
  const r = draftFromIssue(body, num, companies);
  if (!r.company) {
    console.error(r.error);
    if (process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT, `error=${r.error}\n`, { flag: "a" });
    process.exit(2);
  }
  const next = CompaniesFile.parse([...companies, r.company].sort((a, b) => a.slug.localeCompare(b.slug)));
  writeFileSync(path, JSON.stringify(next, null, 2) + "\n");
  console.log(`Added draft ${r.company.slug}`);
  if (process.env.GITHUB_OUTPUT)
    writeFileSync(process.env.GITHUB_OUTPUT, `slug=${r.company.slug}\nname=${r.company.name}\n`, { flag: "a" });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
