import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { CompaniesFile, CrawlTarget, CseSourceFile, Group, TechSourceFile } from "@rekiya/shared";
import { importCompanies, type ImportReport } from "./importCompanies.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const DATA = resolve(ROOT, "data");
const p = (...parts: string[]) => resolve(DATA, ...parts);

function readJson<T>(path: string, schema: z.ZodType<T>, fallback?: T): T {
  if (!existsSync(path)) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing file: ${path}`);
  }
  const parsed = schema.safeParse(JSON.parse(readFileSync(path, "utf8")));
  if (!parsed.success) {
    console.error(`✗ ${path} failed validation:`);
    for (const i of parsed.error.issues.slice(0, 20)) console.error(`  [${i.path.join(".")}] ${i.message}`);
    process.exit(1);
  }
  return parsed.data;
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}

function renderReport(r: ImportReport): string {
  const L: string[] = [];
  L.push("# CSE import report", "");
  L.push("## Source file", "");
  L.push("| Check | Count |", "|---|---|");
  L.push(`| Total records | ${r.cse.total} |`);
  L.push(`| With a real careers URL | ${r.cse.withCareersUrl} |`);
  L.push(`| Placeholder careers value | ${r.cse.placeholder} |`);
  L.push(`| Other invalid careers value | ${r.cse.otherInvalidCareersValue.length} |`);
  L.push(`| Empty website | ${r.cse.noWebsite} |`);
  L.push(`| Unique careers pages | ${r.cse.uniqueCareersUrls} |`);
  L.push("");
  L.push(`Tech list: ${r.tech.total} companies, ${r.tech.withWebsite} with a known website.`, "");

  L.push("## Tech ↔ CSE overlaps (matched by domain)", "");
  for (const o of r.overlaps) L.push(`- ${o.tech} → ${o.cse} (${o.symbol}) via \`${o.domain}\``);
  if (r.ambiguousOverlaps.length) {
    L.push("", "Ambiguous (kept separate, resolve by hand):");
    for (const a of r.ambiguousOverlaps) L.push(`- ${a.tech} on \`${a.domain}\`: ${a.candidates.join(", ")}`);
  }
  L.push("");

  L.push("## Company status", "");
  L.push("| Status | Companies |", "|---|---|");
  for (const [k, v] of Object.entries(r.statusCounts)) L.push(`| ${k} | ${v} |`);
  L.push("");
  L.push(
    `\`needs-discovery\`: ${r.discovery.companies} companies across ${r.discovery.uniqueDomains} unique website domains (discovery probes each domain once).`,
    "",
  );

  L.push("## Parent groups", "");
  L.push("| Group | Derived from | Members |", "|---|---|---|");
  for (const g of r.groups) L.push(`| ${g.name} (\`${g.slug}\`) | shared ${g.via} domain | ${g.members.length}: ${g.members.join(", ")} |`);
  L.push("");

  if (r.crossDomainCareers.length) {
    L.push("## Careers page on a different domain than the website", "");
    L.push("Check whether these belong to a group that the domain rule can't see.", "");
    for (const c of r.crossDomainCareers) L.push(`- ${c.company}: website \`${c.website}\`, careers \`${c.careers}\``);
    L.push("");
  }
  if (r.unknownIndustries.length) {
    L.push("## ✗ Unmapped industries (add to packages/shared/src/industries.ts)", "");
    for (const u of r.unknownIndustries) L.push(`- ${u.company}: "${u.raw}"`);
    L.push("");
  }
  if (r.cse.otherInvalidCareersValue.length) {
    L.push("## ✗ Unexpected careers values", "");
    for (const v of r.cse.otherInvalidCareersValue) L.push(`- ${v}`);
    L.push("");
  }
  if (r.adapterConflicts.length) {
    L.push("## ✗ Adapter conflicts on shared targets", "");
    for (const a of r.adapterConflicts) L.push(`- ${a.target}: ${a.adapters.join(", ")}`);
    L.push("");
  }
  if (r.preservedHandEdits.length) {
    L.push("## Hand edits preserved over source values", "");
    for (const h of r.preservedHandEdits) L.push(`- ${h.company}.${h.field}`);
    L.push("");
  }
  L.push("## Output", "");
  L.push(`- companies.json: ${r.totals.companies}`);
  L.push(`- groups.json: ${r.totals.groups}`);
  L.push(`- crawl-targets.json: ${r.totals.crawlTargets}`);
  return L.join("\n") + "\n";
}

function main(): void {
  const cse = readJson(p("sources", "cse_listed_companies_career_pages.json"), CseSourceFile);
  const tech = readJson(p("sources", "tech_companies.json"), TechSourceFile);
  const existing = readJson(p("companies.json"), CompaniesFile, []);
  const existingGroups = readJson(p("groups.json"), z.array(Group), []);

  const { companies, groups, targets, report } = importCompanies({ cse, tech, existing, existingGroups });

  // Validate everything we are about to write.
  CompaniesFile.parse(companies);
  z.array(Group).parse(groups);
  z.array(CrawlTarget).parse(targets);

  const md = renderReport(report);
  process.stdout.write(md);

  const fatal = report.unknownIndustries.length + report.cse.otherInvalidCareersValue.length + report.adapterConflicts.length;
  if (fatal > 0) {
    console.error(`\n✗ ${fatal} blocking issue(s); nothing written.`);
    process.exit(1);
  }

  writeJson(p("companies.json"), companies);
  writeJson(p("groups.json"), groups);
  writeJson(p("crawl-targets.json"), targets);
  mkdirSync(p("reports"), { recursive: true });
  writeFileSync(p("reports", "import-cse.md"), md);
  console.log("\n✓ Wrote data/companies.json, data/groups.json, data/crawl-targets.json, data/reports/import-cse.md");
}

main();
