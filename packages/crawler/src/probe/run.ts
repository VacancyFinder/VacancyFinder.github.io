/**
 * Investigation tool for Milestone 1 (not part of the scheduled crawl).
 * For every crawl target (and any extra URLs in probe/request.json):
 *   - fetch the careers page politely and record its signals,
 *   - verify every ATS account found on it against the ATS's public API,
 *   - optionally render it in Chromium and record the JSON requests it makes.
 * Raw responses are saved under .probe-out/ so adapters can be built and tested offline.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pLimit from "p-limit";
import { z } from "zod";
import { CrawlTarget } from "@rekiya/shared";
import { PoliteFetcher, USER_AGENT } from "../http/fetcher.js";
import { checkAts, type AtsCheck } from "./ats.js";
import { extractSignals, type PageSignals } from "./signals.js";

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const ROOT = resolve(PKG, "../..");
const OUT = resolve(PKG, ".probe-out");

const Request = z.object({
  targets: z.union([z.literal("all"), z.array(z.string())]).default("all"),
  urls: z.array(z.object({ id: z.string(), url: z.string().url() })).default([]),
  render: z.boolean().default(true),
});

interface ProbeEntry {
  id: string;
  url: string;
  companies: string[];
  fetch: { status: number; finalUrl: string; bytes: number; contentType: string } | { error: string };
  signals?: PageSignals;
  atsChecks: Omit<AtsCheck, "body">[];
  rendered?: { finalUrl: string; signals: PageSignals; json: { url: string; status: number; bytes: number }[] } | { error: string };
}

const safe = (s: string) => s.replace(/[^a-z0-9-]+/gi, "-").slice(0, 80);

async function main(): Promise<void> {
  const req = Request.parse(JSON.parse(readFileSync(resolve(PKG, "probe/request.json"), "utf8")));
  const allTargets = z.array(CrawlTarget).parse(JSON.parse(readFileSync(resolve(ROOT, "data/crawl-targets.json"), "utf8")));
  const companies = JSON.parse(readFileSync(resolve(ROOT, "data/companies.json"), "utf8")) as { slug: string; careersUrl: string | null }[];
  const careersOf = new Map(companies.map((c) => [c.slug, c.careersUrl]));

  const items: { id: string; url: string; companies: string[] }[] = [];
  for (const t of allTargets) {
    if (req.targets !== "all" && !req.targets.includes(t.id)) continue;
    // Fetch the URL as written in the data (with www etc.), not the canonical key.
    const url = t.companySlugs.map((s) => careersOf.get(s)).find(Boolean) ?? t.canonicalUrl;
    items.push({ id: t.id, url, companies: t.companySlugs });
  }
  for (const u of req.urls) items.push({ id: u.id, url: u.url, companies: [] });

  mkdirSync(resolve(OUT, "pages"), { recursive: true });
  mkdirSync(resolve(OUT, "api"), { recursive: true });
  const fetcher = new PoliteFetcher({ log: (m) => console.log(`  · ${m}`) });
  const limit = pLimit(6);
  const started = Date.now();

  const entries: ProbeEntry[] = await Promise.all(
    items.map((it) =>
      limit(async () => {
        const e: ProbeEntry = { ...it, fetch: { error: "not fetched" }, atsChecks: [] };
        try {
          const r = await fetcher.get(it.url);
          e.fetch = { status: r.status, finalUrl: r.url, bytes: r.text.length, contentType: r.headers["content-type"] ?? "" };
          writeFileSync(resolve(OUT, "pages", `${safe(it.id)}.html`), r.text);
          e.signals = extractSignals(r.text, r.url);
          for (const hit of e.signals.ats) {
            const c = await checkAts(fetcher, hit);
            if (!c) continue;
            if (c.body) writeFileSync(resolve(OUT, "api", `${safe(it.id)}--${c.ats}-${safe(c.id)}.txt`), c.body);
            const { body: _body, ...rest } = c;
            e.atsChecks.push(rest);
          }
        } catch (err) {
          e.fetch = { error: (err as Error).message };
        }
        console.log(`${"error" in e.fetch ? "✗" : "✓"} ${it.id} ${JSON.stringify(e.fetch)} ats=${e.atsChecks.map((a) => `${a.ats}:${a.id}=${a.jobs}`).join(",")}`);
        return e;
      }),
    ),
  );

  if (req.render) await renderAll(entries, fetcher);

  writeFileSync(resolve(OUT, "report.json"), JSON.stringify({ at: new Date().toISOString(), ms: Date.now() - started, requests: fetcher.requests, entries }, null, 2));
  console.log(`\nProbed ${entries.length} URLs in ${Math.round((Date.now() - started) / 1000)}s with ${fetcher.requests} requests.`);
}

/** Render each page once in Chromium (sequentially) and log the JSON XHR/fetch calls it makes. */
async function renderAll(entries: ProbeEntry[], fetcher: PoliteFetcher): Promise<void> {
  let chromium: typeof import("playwright").chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.log("playwright not installed; skipping render phase");
    return;
  }
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ userAgent: USER_AGENT });
  await ctx.route("**/*", (route) => {
    const t = route.request().resourceType();
    return ["image", "font", "media"].includes(t) ? route.abort() : route.continue();
  });
  for (const e of entries) {
    if (!(await fetcher.allowed(e.url))) {
      e.rendered = { error: "robots.txt disallows" };
      continue;
    }
    const page = await ctx.newPage();
    const json: { url: string; status: number; bytes: number }[] = [];
    let n = 0;
    page.on("response", async (res) => {
      const type = res.request().resourceType();
      const ct = res.headers()["content-type"] ?? "";
      if (!["xhr", "fetch"].includes(type) || !/json|xml/.test(ct)) return;
      try {
        const body = await res.text();
        json.push({ url: res.url(), status: res.status(), bytes: body.length });
        if (body.length < 2_000_000 && n < 15) writeFileSync(resolve(OUT, "api", `${safe(e.id)}--xhr-${n++}.txt`), `${res.url()}\n\n${body}`);
      } catch {
        // body unavailable (redirect/aborted)
      }
    });
    try {
      await page.goto(e.url, { waitUntil: "networkidle", timeout: 45000 });
      await page.waitForTimeout(2000);
      const html = await page.content();
      writeFileSync(resolve(OUT, "pages", `${safe(e.id)}.rendered.html`), html);
      e.rendered = { finalUrl: page.url(), signals: extractSignals(html, page.url()), json };
      console.log(`  rendered ${e.id}: text=${e.rendered.signals.textLength} jsonReq=${json.length}`);
    } catch (err) {
      e.rendered = { error: (err as Error).message.split("\n")[0]!, ...{ json } } as ProbeEntry["rendered"];
    }
    await page.close();
    await new Promise((r) => setTimeout(r, 2000 + Math.random() * 3000));
  }
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
