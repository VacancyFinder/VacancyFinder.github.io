/**
 * pnpm validate:data — validate every file in /data against the shared schemas.
 * Run in CI and before the crawl workflow commits or deploys anything.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { ChangesFile, CompaniesFile, CrawlTarget, FIELD_SLUGS, Group, HealthFile, Job, JobsFile, Meta, Overrides } from "@rekiya/shared";

const DATA = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../data");

export function validateDataDir(dir: string): string[] {
  const errors: string[] = [];
  const check = (rel: string, schema: z.ZodTypeAny, required = false) => {
    const p = resolve(dir, rel);
    if (!existsSync(p)) {
      if (required) errors.push(`${rel}: missing`);
      return undefined;
    }
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(p, "utf8"));
    } catch (e) {
      errors.push(`${rel}: invalid JSON (${(e as Error).message})`);
      return undefined;
    }
    const r = schema.safeParse(raw);
    if (!r.success) for (const i of r.error.issues.slice(0, 10)) errors.push(`${rel} [${i.path.join(".")}] ${i.message}`);
    return r.success ? (r.data as unknown) : undefined;
  };

  const companies = check("companies.json", CompaniesFile, true) as z.infer<typeof CompaniesFile> | undefined;
  const groups = check("groups.json", z.array(Group), true) as { slug: string }[] | undefined;
  const targets = check("crawl-targets.json", z.array(CrawlTarget), true) as z.infer<typeof CrawlTarget>[] | undefined;
  const jobs = check("jobs.json", JobsFile) as z.infer<typeof Job>[] | undefined;
  check("meta.json", Meta);
  check("health.json", HealthFile);
  check("overrides.json", Overrides);
  for (const sub of ["changes", "archive"]) {
    const d = resolve(dir, sub);
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d).filter((x) => x.endsWith(".json"))) check(`${sub}/${f}`, sub === "changes" ? ChangesFile : z.array(Job));
  }
  const shardDir = resolve(dir, "fields");
  if (existsSync(shardDir)) for (const f of FIELD_SLUGS) check(`fields/${f}.json`, z.array(Job));

  // Cross-file references.
  if (companies && groups && targets) {
    const slugs = new Set(companies.map((c) => c.slug));
    const groupSlugs = new Set(groups.map((g) => g.slug));
    for (const c of companies)
      if (c.parentGroup && !groupSlugs.has(c.parentGroup))
        errors.push(`companies.json: ${c.slug} has unknown parentGroup ${c.parentGroup}`);
    for (const t of targets)
      for (const s of t.companySlugs) if (!slugs.has(s)) errors.push(`crawl-targets.json: ${t.id} names unknown company ${s}`);
    if (jobs) {
      for (const j of jobs)
        if (!slugs.has(j.company) && !groupSlugs.has(j.company)) errors.push(`jobs.json: ${j.id} has unknown company ${j.company}`);
    }
  }
  return errors;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const errors = validateDataDir(DATA);
  if (errors.length) {
    console.error(`✗ ${errors.length} problem(s) in /data:`);
    for (const e of errors.slice(0, 50)) console.error(`  ${e}`);
    process.exit(1);
  }
  console.log("✓ /data is valid");
}
