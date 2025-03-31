/**
 * pnpm notify — tell subscribers about jobs added by the latest crawl.
 * Notifiers are pluggable: Telegram today; Web Push can be added as another Notifier later
 * (it would read the same `NewJobsEvent`). Each notifier skips itself when unconfigured.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CompaniesFile, FIELD_LABELS, JobsFile, Meta, ChangesFile, type Job } from "@rekiya/shared";
import { fetch } from "undici";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const SITE = "https://vacancyfinder.github.io/";

export interface NewJobsEvent {
  at: string;
  jobs: Job[];
  companyName: (slug: string) => string;
}

export interface Notifier {
  name: string;
  configured(): boolean;
  send(e: NewJobsEvent): Promise<void>;
}

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

/** Telegram channel posting (HTML parse mode). Needs TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID. */
export function formatTelegram(e: NewJobsEvent, max = 15): string {
  const lines = e.jobs.slice(0, max).map((j) => {
    const f = j.fields
      .filter((x) => x !== "other")
      .map((x) => FIELD_LABELS[x])
      .slice(0, 2)
      .join(", ");
    return `• <a href="${esc(j.url)}">${esc(j.title)}</a> — ${esc(e.companyName(j.company))}${j.location ? `, ${esc(j.location)}` : ""}${f ? ` <i>(${esc(f)})</i>` : ""}`;
  });
  const more = e.jobs.length > max ? `\n…and ${e.jobs.length - max} more on <a href="${SITE}">Rekiya</a>` : "";
  return `<b>${e.jobs.length} new job${e.jobs.length > 1 ? "s" : ""} in Sri Lanka</b>\n\n${lines.join("\n")}${more}`;
}

export const telegram: Notifier = {
  name: "telegram",
  configured: () => !!process.env.TELEGRAM_BOT_TOKEN && !!process.env.TELEGRAM_CHAT_ID,
  async send(e) {
    const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: formatTelegram(e),
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`Telegram HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  },
};

export const NOTIFIERS: Notifier[] = [telegram];

async function main(): Promise<void> {
  const active = NOTIFIERS.filter((n) => n.configured());
  if (active.length === 0) {
    console.log("No notifiers configured (e.g. TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID); skipping.");
    return;
  }
  const meta = Meta.parse(JSON.parse(readFileSync(resolve(ROOT, "data/meta.json"), "utf8")));
  const changesPath = resolve(ROOT, `data/changes/${meta.generatedAt.slice(0, 10)}.json`);
  if (!existsSync(changesPath)) return console.log("No changes file for this run; nothing to send.");
  const run = ChangesFile.parse(JSON.parse(readFileSync(changesPath, "utf8"))).find((r) => r.at === meta.generatedAt);
  if (!run || run.added.length === 0) return console.log("No new jobs this run.");
  const jobs = JobsFile.parse(JSON.parse(readFileSync(resolve(ROOT, "data/jobs.json"), "utf8")));
  const ids = new Set(run.added.map((a) => a.id));
  const companies = CompaniesFile.parse(JSON.parse(readFileSync(resolve(ROOT, "data/companies.json"), "utf8")));
  const groups = JSON.parse(readFileSync(resolve(ROOT, "data/groups.json"), "utf8")) as { slug: string; name: string }[];
  const names = new Map([...groups.map((g) => [g.slug, g.name] as const), ...companies.map((c) => [c.slug, c.name] as const)]);
  const event: NewJobsEvent = {
    at: run.at,
    jobs: jobs.filter((j) => ids.has(j.id) && j.status === "open"),
    companyName: (s) => names.get(s) ?? s,
  };
  for (const n of active) {
    try {
      await n.send(event);
      console.log(`${n.name}: sent ${event.jobs.length} jobs`);
    } catch (err) {
      // An alert failure must never fail the crawl/deploy.
      console.error(`${n.name}: ${(err as Error).message}`);
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) void main();
