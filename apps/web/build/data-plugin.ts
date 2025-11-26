import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";
import { CompaniesFile, FIELD_SLUGS, Group, HealthFile, JobsFile, type Job } from "@rekiya/shared";
import { z } from "zod";
import { buildDirectory } from "./directory.js";
import { fieldFeed } from "./feeds.js";
import { generateSeo } from "./seo.js";
import { DEFAULT_SITE_URL } from "../src/lib/paths.js";
import type { BuildInfo } from "../src/lib/status.js";

/** Canonical origin: set SITE_URL (e.g. a custom domain) at build time; defaults to the GitHub Pages URL. */
export const siteUrl = () => (process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, "");

/** Files from /data that the site serves. Sources, reports and caches stay out. */
const PUBLISHED = ["jobs.json", "meta.json", "health.json", "groups.json", "fields", "changes"];

function readJson<T>(path: string, schema: z.ZodType<T>, fallback: T): T {
  return existsSync(path) ? schema.parse(JSON.parse(readFileSync(path, "utf8"))) : fallback;
}

export interface SiteData {
  jobs: Job[];
  companies: z.infer<typeof CompaniesFile>;
  groups: Group[];
  generatedAt: string;
}

/** /build.json: which build is live and what its sync did — read by the status page and the deploy check. */
export function buildInfo(dataGeneratedAt: string, env: NodeJS.ProcessEnv = process.env, now = new Date()): BuildInfo {
  const sync = env.BUILD_SYNC;
  return {
    id: env.BUILD_ID || `local-${now.getTime()}`,
    builtAt: now.toISOString(),
    commit: env.BUILD_COMMIT || null,
    runUrl: env.BUILD_RUN_URL || null,
    event: env.BUILD_EVENT || null,
    sync: sync === "ok" || sync === "failed" || sync === "skipped" ? sync : "local",
    dataGeneratedAt,
    pagesSource: env.BUILD_PAGES_SOURCE || null,
  };
}

export function generateSiteData(dataDir: string, outDir: string): SiteData {
  const companies = readJson(resolve(dataDir, "companies.json"), CompaniesFile, []);
  const groups: Group[] = readJson(resolve(dataDir, "groups.json"), z.array(Group), []);
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
  const meta = JSON.parse(readFileSync(resolve(dataOut, "meta.json"), "utf8")) as { generatedAt: string };
  return { jobs, companies, groups, generatedAt: Date.parse(meta.generatedAt) > 0 ? meta.generatedAt : builtAt };
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
    async closeBundle() {
      const d = generateSiteData(dataDir, outDir);
      writeFileSync(resolve(outDir, "build.json"), JSON.stringify(buildInfo(d.generatedAt)));
      // Prerendered pages, sitemap, robots.txt, llms.txt — after the data, in the same hook, so order is fixed.
      const seo = await generateSeo({
        outDir,
        siteUrl: siteUrl(),
        ...d,
        verify: { google: process.env.GOOGLE_SITE_VERIFICATION, bing: process.env.BING_SITE_VERIFICATION },
        indexNowFile: resolve(root, ".seo/indexnow-urls.json"),
      });
      console.log(
        `rekiya-data: ${d.jobs.length} jobs, ${seo.pages} pages (${seo.indexed} indexable), ${seo.images} preview images → ${outDir}`,
      );
    },
  };
}
