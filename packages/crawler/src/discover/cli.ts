/**
 * pnpm discover — find careers-page candidates for `needs-discovery` companies.
 * Manual trigger only. Writes data/discovery-candidates.json; a human approves each candidate by PR.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pLimit from "p-limit";
import { CompaniesFile, domainOf } from "@rekiya/shared";
import { PoliteFetcher } from "../http/fetcher.js";
import { discoverDomain, type DomainResult } from "./discover.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

async function main(): Promise<void> {
  const only = process.argv.slice(2);
  const companies = CompaniesFile.parse(JSON.parse(readFileSync(resolve(ROOT, "data/companies.json"), "utf8")));
  const byDomain = new Map<string, { website: string; slugs: string[] }>();
  for (const c of companies) {
    if (c.status !== "needs-discovery" || !c.website) continue;
    if (only.length && !only.includes(c.slug)) continue;
    const d = domainOf(c.website)!;
    const e = byDomain.get(d) ?? { website: c.website, slugs: [] };
    e.slugs.push(c.slug);
    byDomain.set(d, e);
  }
  console.log(`Discovering careers pages for ${byDomain.size} domains…`);
  const fetcher = new PoliteFetcher({ log: (m) => console.log(`  · ${m}`) });
  const limit = pLimit(6);
  const started = Date.now();
  const results: DomainResult[] = await Promise.all(
    [...byDomain.values()].map((d) =>
      limit(async () => {
        const r = await discoverDomain(fetcher, d.website, d.slugs);
        const best = r.candidates[0];
        console.log(`${best ? "✓" : "–"} ${r.domain}: ${best ? `${best.url} (score ${best.score})` : "no candidate"}${r.errors.length ? ` [${r.errors.length} errors]` : ""}`);
        return r;
      }),
    ),
  );
  results.sort((a, b) => a.domain.localeCompare(b.domain));
  const out = {
    generatedAt: new Date().toISOString(),
    note: "Candidates only. Nothing here is crawled until a human copies an approved URL into companies.json via PR.",
    domains: results,
  };
  writeFileSync(resolve(ROOT, "data/discovery-candidates.json"), JSON.stringify(out, null, 2) + "\n");
  const found = results.filter((r) => r.candidates.length).length;
  console.log(`\n${found}/${results.length} domains have candidates. ${fetcher.requests} requests in ${Math.round((Date.now() - started) / 1000)}s.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
