import { useCallback, useEffect, useState } from "react";
import { REPO_URL } from "../components/Layout";
import { ExternalIcon } from "../components/Icons";
import { SYNC_EVERY_MS } from "../lib/data";
import { hostOf } from "../lib/format";
import { usePrivatePage } from "../lib/seo";
import {
  colomboTime,
  computeStatus,
  duration,
  isRunning,
  meaningfulRuns,
  runDurationMs,
  runLabel,
  triggerLabel,
  type BuildInfo,
  type Level,
  type StatusInput,
  type TargetHealth,
  type WorkflowRun,
} from "../lib/status";

const REPO = REPO_URL.replace("https://github.com/", "");
const RUNS_API = `https://api.github.com/repos/${REPO}/actions/workflows/crawl-and-deploy.yml/runs?per_page=40`;
const REPO_META = `https://raw.githubusercontent.com/${REPO}/main/data/meta.json`;
const REFRESH_MS = 60_000;

const LEVEL: Record<Level, { label: string; dot: string; banner: string }> = {
  ok: {
    label: "Operational",
    dot: "bg-emerald-500",
    banner: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100",
  },
  warn: {
    label: "Degraded",
    dot: "bg-amber-500",
    banner: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100",
  },
  down: {
    label: "Problem",
    dot: "bg-red-600",
    banner: "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100",
  },
  unknown: {
    label: "Unknown",
    dot: "bg-slate-400",
    banner: "border-slate-300 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
  },
};

function Dot({ level }: { level: Level }) {
  return <span aria-hidden="true" className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${LEVEL[level].dot}`} />;
}

async function json<T>(url: string): Promise<T | null> {
  try {
    const sep = url.includes("?") ? "&" : "?";
    const res = await fetch(url.startsWith("http") ? url : `${url}${sep}t=${Date.now()}`, { cache: "no-store" });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

interface Snapshot extends StatusInput {
  responseMs: number | null;
  checkedAt: number;
}

async function load(): Promise<Snapshot> {
  const t0 = performance.now();
  const build = await json<BuildInfo>("/build.json");
  const responseMs = build ? Math.round(performance.now() - t0) : null;
  const [meta, health, runs, repo] = await Promise.all([
    json<StatusInput["meta"]>("/data/meta.json"),
    json<Record<string, TargetHealth>>("/data/health.json"),
    json<{ workflow_runs: WorkflowRun[] }>(RUNS_API),
    json<{ generatedAt: string }>(REPO_META),
  ]);
  return {
    now: Date.now(),
    checkedAt: Date.now(),
    syncEveryMs: SYNC_EVERY_MS,
    build,
    meta,
    health,
    runs: runs?.workflow_runs ?? null,
    repoGeneratedAt: repo?.generatedAt ?? null,
    responseMs,
  };
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Colombo" });

export function Status() {
  usePrivatePage("System status");
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true);
    setSnap(await load());
    setBusy(false);
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => document.visibilityState === "visible" && void refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const status = snap ? computeStatus(snap) : null;
  const history = snap?.runs ? meaningfulRuns(snap.runs).slice(0, 12) : [];
  const failing = Object.values(snap?.health ?? {})
    .filter((h) => h.consecutiveFailures > 0)
    .sort((a, b) => b.consecutiveFailures - a.consecutiveFailures);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">System status</h1>
      <p className="muted mt-1">Live health of the Rekiya website and the automatic job sync that runs every 3 hours.</p>

      <section
        aria-live="polite"
        aria-busy={!status}
        className={`mt-6 rounded-2xl border p-5 ${status ? LEVEL[status.overall].banner : LEVEL.unknown.banner}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-3 text-lg font-semibold">
            <Dot level={status?.overall ?? "unknown"} />
            {status ? status.headline : "Checking…"}
          </p>
          <button type="button" className="btn-secondary h-10" onClick={() => void refresh()} disabled={busy}>
            {busy ? "Checking…" : "Check again"}
          </button>
        </div>
        {snap && (
          <p className="mt-2 text-sm opacity-80">
            Checked at {colomboTime(snap.checkedAt)} Sri Lanka time · refreshes every minute
            {snap.responseMs !== null ? ` · website responded in ${snap.responseMs} ms` : ""}
          </p>
        )}
      </section>

      <section aria-labelledby="components-h" className="mt-8">
        <h2 id="components-h" className="text-lg font-semibold">
          Components
        </h2>
        <ul className="card mt-3 divide-y divide-slate-200 dark:divide-slate-800">
          {(status?.components ?? []).map((c) => (
            <li key={c.key} className="p-4" data-component={c.key} data-level={c.level}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{c.name}</p>
                <p className="flex items-center gap-2 text-sm">
                  <Dot level={c.level} />
                  <span>{c.summary}</span>
                  <span className="sr-only">({LEVEL[c.level].label})</span>
                </p>
              </div>
              {c.detail && <p className="muted mt-1 text-sm">{c.detail}</p>}
            </li>
          ))}
          {!status && <li className="muted p-4 text-sm">Checking the website, data and sync…</li>}
        </ul>
      </section>

      <section aria-labelledby="history-h" className="mt-8">
        <h2 id="history-h" className="text-lg font-semibold">
          Recent syncs and updates
        </h2>
        {snap && !snap.runs ? (
          <p className="muted mt-2 text-sm">
            GitHub couldn't be reached from your browser (it allows 60 checks an hour per network). See the{" "}
            <a className="link" href={`${REPO_URL}/actions/workflows/crawl-and-deploy.yml`} rel="noopener">
              run history on GitHub
            </a>
            .
          </p>
        ) : (
          <div className="card mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Started (Sri Lanka)
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Trigger
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Took
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Result
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {history.map((r) => {
                  const level: Level = isRunning(r)
                    ? "unknown"
                    : r.conclusion === "success"
                      ? "ok"
                      : r.conclusion === "failure"
                        ? "down"
                        : "warn";
                  return (
                    <tr key={r.id} data-run={r.conclusion ?? r.status}>
                      <td className="whitespace-nowrap px-3 py-2">{when(r.run_started_at ?? r.created_at)}</td>
                      <td className="whitespace-nowrap px-3 py-2">{triggerLabel(r.event)}</td>
                      <td className="whitespace-nowrap px-3 py-2">{isRunning(r) ? "—" : duration(runDurationMs(r))}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <a href={r.html_url} className="link inline-flex items-center gap-2 font-normal" rel="noopener" target="_blank">
                          <Dot level={level} />
                          {runLabel(r)}
                          <span className="sr-only"> (opens the run on GitHub)</span>
                        </a>
                      </td>
                    </tr>
                  );
                })}
                {snap && history.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted px-4 py-3">
                      No runs yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {failing.length > 0 && (
        <section aria-labelledby="sources-h" className="mt-8">
          <h2 id="sources-h" className="text-lg font-semibold">
            Career pages that couldn't be read
          </h2>
          <p className="muted mt-1 text-sm">These are retried on every sync. Jobs already listed from them stay up until they recover.</p>
          <ul className="card mt-3 divide-y divide-slate-200 text-sm dark:divide-slate-800">
            {failing.map((h) => (
              <li key={h.target} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <a href={h.url} className="link inline-flex items-center gap-1 font-medium" rel="noopener noreferrer" target="_blank">
                    {hostOf(h.url)} <ExternalIcon width={14} height={14} />
                  </a>
                  <span className="muted">
                    failed {h.consecutiveFailures} {h.consecutiveFailures === 1 ? "time" : "times"} in a row
                  </span>
                </div>
                {h.lastError && <p className="muted mt-1 break-words">{h.lastError.slice(0, 200)}</p>}
                {h.lastSuccessAt && <p className="muted mt-1">Last read successfully {when(h.lastSuccessAt)}.</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8 text-sm">
        <p className="muted">
          The sync runs on GitHub Actions every 3 hours, with an automatic retry 45 minutes after a failed attempt. A failed sync never
          replaces the jobs on the site — the previous data stays up until the next successful sync.
        </p>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          <a className="link" href={`${REPO_URL}/actions/workflows/crawl-and-deploy.yml`} rel="noopener">
            Full run history
          </a>
          <a className="link" href={`${REPO_URL}/issues/new?title=${encodeURIComponent("Status: ")}`} rel="noopener">
            Report a problem
          </a>
          {snap?.build?.runUrl && (
            <a className="link" href={snap.build.runUrl} rel="noopener">
              Build that's live now
            </a>
          )}
        </p>
      </section>
    </div>
  );
}
