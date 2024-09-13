import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";
import { CompaniesFile, FIELD_SLUGS, Group, HealthFile, JobsFile, type Job } from "@rekiya/shared";
import { z } from "zod";
import { buildDirectory } from "./directory.js";
import { fieldFeed } from "./feeds.js";

/** Files from /data that the site serves. Sources, reports and caches stay out. */
const PUBLISHED = ["jobs.json", "meta.json", "health.json", "groups.json", "fields", "changes"];

function readJson<T>(path: string, schema: z.ZodType<T>, fallback: T): T {
  return existsSync(path) ? schema.parse(JSON.parse(readFileSync(path, "utf8"))) : fallback;
}

export function generateSiteData(dataDir: string, outDir: string): { jobs: number; feeds: number } {
  const companies = readJson(resolve(dataDir, "companies.json"), CompaniesFile, []);
  const groups = readJson(resolve(dataDir, "groups.json"), z.array(Group), []);
  const health = readJson(resolve(dataDir, "health.json"), HealthFile, {});
  const jobs: Job[] = readJson(resolve(dataDir, "jobs.json"), JobsFile, []);

  const dataOut = resolve(outDir, "data");
  mkdirSync(dataOut, { recursive: true });
  for (const f of PUBLISHED) {
    const src = resolve(dataDir, f);
    if (existsSync(src)) cpSync(src, resolve(dataOut, f), { recursive: true });
  }
  // Empty shards so the app never 404s on a field with no jobs yet.
  mkdirSync(resolve(dataOut, "fields"), { recursive: true });
  for (const f of FIELD_SLUGS) {
    const p = resolve(dataOut, "fields", `${f}.json`);
    if (!existsSync(p)) writeFileSync(p, "[]\n");
  }
  if (!existsSync(resolve(dataOut, "meta.json"))) {
    writeFileSync(
      resolve(dataOut, "meta.json"),
      JSON.stringify({
        generatedAt: new Date(0).toISOString(),
        runDurationMs: 0,
        totals: { open: 0, companiesWithJobs: 0, targets: 0, targetsOk: 0 },
        byField: {},
        byCompany: {},
        bySeniority: {},
        byIndustry: {},
      }),
    );
  }
  writeFileSync(resolve(dataOut, "directory.json"), JSON.stringify(buildDirectory(companies, groups, health)));

  const names = new Map<string, string>([
    ...groups.map((g) => [g.slug, g.name] as const),
    ...companies.map((c) => [c.slug, c.name] as const),
  ]);
  const builtAt = new Date().toISOString();
  mkdirSync(resolve(outDir, "feeds"), { recursive: true });
  for (const f of FIELD_SLUGS) {
    writeFileSync(
      resolve(outDir, "feeds", `${f}.xml`),
      fieldFeed(
        f,
        jobs.filter((j) => j.fields.includes(f)),
        (s) => names.get(s) ?? s,
        builtAt,
      ),
    );
  }
  return { jobs: jobs.length, feeds: FIELD_SLUGS.length };
}

/** Copies /data into the build and generates directory.json + RSS feeds; serves /data in dev. */
export function rekiyaData(dataDir: string): Plugin {
  let outDir = "dist";
  let root = process.cwd();
  return {
    name: "rekiya-data",
    configResolved(c) {
      root = c.root;
      outDir = resolve(c.root, c.build.outDir);
    },
    configureServer(server) {
      const tmp = resolve(root, "node_modules/.rekiya-dev");
      generateSiteData(dataDir, tmp);
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? "").split("?")[0]!;
        const m = url.match(/^\/(data|feeds)\/(.+)$/);
        if (!m || m[2]!.includes("..")) return next();
        const file = resolve(tmp, m[1]!, m[2]!);
        if (!existsSync(file)) return next();
        res.setHeader("content-type", file.endsWith(".xml") ? "application/rss+xml" : "application/json");
        res.end(readFileSync(file));
      });
    },
    closeBundle() {
      const r = generateSiteData(dataDir, outDir);
      console.log(`rekiya-data: ${r.jobs} jobs, ${r.feeds} feeds → ${outDir}`);
    },
  };
}
