import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CompanyBadge } from "../components/CompanyBadge";
import { BellIcon, DownloadIcon, ExternalIcon, HistoryIcon, TrashIcon } from "../components/Icons";
import { JobCard, STATUS_STYLE } from "../components/JobCard";
import { JobListSkeleton } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { useApp } from "../lib/app-state";
import { useData, useJobs } from "../lib/data";
import { applyFilters, parseFilters } from "../lib/filters";
import { downloadFile, formatDate, relativeDays, safeHref, toCsv } from "../lib/format";
import { APP_STATUSES, APP_STATUS_LABELS, type AppStatus, type SavedJob } from "../lib/storage";
import type { Job } from "../lib/types";
import { useJobActions } from "../lib/useJobActions";
import { jobPath } from "../lib/paths";
import { usePrivatePage } from "../lib/seo";

type Tab = AppStatus | "all";

export function Saved() {
  usePrivatePage("Saved jobs");
  const [params, setParams] = useSearchParams();
  const tab = ((["all", ...APP_STATUSES] as string[]).includes(params.get("status") ?? "") ? params.get("status") : "all") as Tab;
  const { saved } = useApp();
  const { employer } = useData();
  const { jobs } = useJobs("all");
  const byId = useMemo(() => new Map((jobs ?? []).map((j) => [j.id, j])), [jobs]);

  const list = useMemo(() => Object.values(saved).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [saved]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: list.length };
    for (const s of list) c[s.status] = (c[s.status] ?? 0) + 1;
    return c;
  }, [list]);
  const shown = tab === "all" ? list : list.filter((s) => s.status === tab);

  const exportCsv = () => {
    const rows = [
      ["Title", "Company", "Status", "Saved on", "Last updated", "Still listed", "Link", "Notes"],
      ...list.map((s) => [
        s.title,
        employer(s.company).name,
        APP_STATUS_LABELS[s.status],
        formatDate(s.savedAt),
        formatDate(s.updatedAt),
        jobs ? (byId.has(s.id) ? "Yes" : "No") : "",
        s.url,
        s.notes,
      ]),
    ];
    downloadFile(`rekiya-applications-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows), "text/csv;charset=utf-8");
  };

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Saved jobs</h1>
            <p className="muted mt-1 text-sm">
              {list.length
                ? `${list.length} saved · ${list.filter((s) => s.status !== "saved").length} in progress. Stored on this device only.`
                : "Jobs you bookmark appear here, so you can track where you've applied."}
            </p>
          </div>
          {list.length > 0 && (
            <button type="button" className="btn-secondary" onClick={exportCsv}>
              <DownloadIcon width={16} height={16} /> Export CSV
            </button>
          )}
        </div>

        {list.length > 0 && (
          <div role="tablist" aria-label="Application status" className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {(["all", ...APP_STATUSES] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                className={`pill ${tab === t ? "pill-on" : "pill-off"}`}
                onClick={() => {
                  const p = new URLSearchParams(params);
                  if (t === "all") p.delete("status");
                  else p.set("status", t);
                  setParams(p, { replace: true });
                }}
              >
                {t === "all" ? "All" : APP_STATUS_LABELS[t]}
                <span className="opacity-70">{counts[t] ?? 0}</span>
              </button>
            ))}
          </div>
        )}

        {list.length === 0 && (
          <div className="card mt-6 p-8 text-center">
            <p className="text-lg font-semibold">No saved jobs yet</p>
            <p className="muted mx-auto mt-1 max-w-md text-sm">
              Tap the bookmark on any job to save it. Then track each application from “Saved” to “Offer”, add notes, and export the list.
            </p>
            <Link to="/jobs/" className="btn-primary mt-5">
              Browse jobs
            </Link>
          </div>
        )}
        {list.length > 0 && shown.length === 0 && <p className="muted mt-6 text-sm">Nothing here yet.</p>}
        {list.length > 0 && !jobs && <JobListSkeleton rows={Math.min(3, shown.length)} label="Loading saved jobs…" />}
        {jobs && list.length > 0 && <h2 className="sr-only">Your saved jobs</h2>}
        {jobs && (
          <ul className="mt-4 grid gap-3">
            {shown.map((s) => (
              <li key={s.id}>
                <SavedItem entry={s} job={byId.get(s.id) ?? null} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <aside className="flex flex-col gap-6" aria-label="Searches and history">
        <SavedSearches jobs={jobs} />
        <RecentlyViewed />
      </aside>
    </div>
  );
}

function SavedItem({ entry, job }: { entry: SavedJob; job: Job | null }) {
  const { setStatus, setNotes, removeSaved, restoreSaved, isNew } = useApp();
  const { employer } = useData();
  const { save } = useJobActions();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [notes, setDraft] = useState(entry.notes);
  const emp = employer(entry.company);
  const href = safeHref(entry.url);

  const remove = () => {
    removeSaved(entry.id);
    toast({ message: "Removed from saved jobs", action: { label: "Undo", onClick: () => restoreSaved(entry) } });
  };

  return (
    <div className="flex flex-col gap-0">
      {job ? (
        <JobCard job={job} employer={emp} isNew={isNew(job)} saved status={entry.status} onToggleSave={save} />
      ) : (
        <article className="card flex gap-3 p-4" aria-label={entry.title}>
          <CompanyBadge slug={emp.slug} name={emp.name} />
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-slate-700 dark:text-slate-300">{entry.title}</h3>
            <p className="muted text-sm">
              {emp.name} · saved {relativeDays(entry.savedAt)}
            </p>
            <p className="mt-2 flex flex-wrap items-center gap-2">
              <span className="chip bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">No longer listed</span>
              {entry.status !== "saved" && <span className={`chip ${STATUS_STYLE[entry.status]}`}>{APP_STATUS_LABELS[entry.status]}</span>}
              {href && (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link inline-flex min-h-[40px] items-center gap-1 text-sm"
                >
                  Original listing <ExternalIcon width={14} height={14} />
                </a>
              )}
            </p>
          </div>
        </article>
      )}
      <div className="-mt-2 flex flex-wrap items-center gap-2 rounded-b-xl border border-t-0 border-slate-200 bg-slate-50 px-4 pb-2 pt-4 dark:border-slate-800 dark:bg-slate-900/60">
        <label htmlFor={`st-${entry.id}`} className="sr-only">
          Application status for {entry.title}
        </label>
        <select
          id={`st-${entry.id}`}
          className="input h-10 min-h-0 w-auto py-0"
          value={entry.status}
          onChange={(e) => setStatus(entry, e.target.value as AppStatus)}
        >
          {APP_STATUSES.map((s) => (
            <option key={s} value={s}>
              {APP_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <button type="button" className="btn-ghost h-10 min-h-0" aria-expanded={editing} onClick={() => setEditing((v) => !v)}>
          {entry.notes ? "Edit notes" : "Add notes"}
        </button>
        <span className="muted ml-auto hidden text-xs sm:inline">Updated {relativeDays(entry.updatedAt)}</span>
        <button type="button" className="icon-btn ml-auto h-10 w-10 sm:ml-0" aria-label={`Remove ${entry.title}`} onClick={remove}>
          <TrashIcon width={18} height={18} />
        </button>
        {entry.notes && !editing && (
          <p className="w-full whitespace-pre-line pb-1 text-sm text-slate-700 dark:text-slate-300">{entry.notes}</p>
        )}
        {editing && (
          <div className="w-full pb-2">
            <label htmlFor={`nt-${entry.id}`} className="sr-only">
              Notes for {entry.title}
            </label>
            <textarea
              id={`nt-${entry.id}`}
              className="input min-h-[80px] py-2"
              value={notes}
              maxLength={2000}
              placeholder="Contact person, interview date, salary discussed…"
              onChange={(e) => setDraft(e.target.value)}
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="btn-primary h-10 min-h-0"
                onClick={() => {
                  setNotes(entry.id, notes);
                  setEditing(false);
                }}
              >
                Save notes
              </button>
              <button
                type="button"
                className="btn-ghost h-10 min-h-0"
                onClick={() => {
                  setDraft(entry.notes);
                  setEditing(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SavedSearches({ jobs }: { jobs: Job[] | null }) {
  const { searches, removeSearch, restoreSearch, markSearchSeen, isHidden } = useApp();
  const data = useData();
  const nav = useNavigate();
  const toast = useToast();
  const counts = useMemo(() => {
    const out = new Map<string, { total: number; fresh: number }>();
    if (!jobs) return out;
    for (const s of searches) {
      const f = parseFilters(new URLSearchParams(s.params));
      // Text queries use simple matching here; the feed ranks them properly.
      const words = f.q.toLowerCase().split(/\s+/).filter(Boolean);
      const list = applyFilters(
        jobs,
        { ...f, q: "" },
        { isCse: data.isCse, companyMatches: data.companyMatches, isNew: () => true, isHidden },
      ).filter((j) => words.every((w) => `${j.title} ${data.employer(j.company).name} ${j.location}`.toLowerCase().includes(w)));
      out.set(s.id, { total: list.length, fresh: list.filter((j) => j.firstSeenAt > s.seenAt).length });
    }
    return out;
  }, [jobs, searches, data, isHidden]);

  return (
    <section aria-labelledby="ss-h" className="card p-4">
      <h2 id="ss-h" className="flex items-center gap-2 text-sm font-semibold">
        <BellIcon width={16} height={16} /> Saved searches
      </h2>
      {searches.length === 0 ? (
        <p className="muted mt-2 text-sm">
          Filter the{" "}
          <Link to="/jobs/" className="link">
            job feed
          </Link>{" "}
          and press “Save search”. We'll count new matches here.
        </p>
      ) : (
        <ul className="mt-2 grid gap-1">
          {searches.map((s) => {
            const c = counts.get(s.id);
            return (
              <li key={s.id} className="flex items-center gap-1">
                <button
                  type="button"
                  className="-mx-2 flex min-h-[44px] min-w-0 flex-1 flex-col items-start justify-center rounded-lg px-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
                  onClick={() => {
                    markSearchSeen(s.id);
                    nav(`/jobs/?${s.params}`);
                  }}
                >
                  <span className="w-full truncate text-sm font-medium">{s.name}</span>
                  <span className="muted text-xs">
                    {c ? `${c.total} open` : "…"}
                    {c && c.fresh > 0 && <span className="ml-2 font-semibold text-amber-700 dark:text-amber-300">{c.fresh} new</span>}
                  </span>
                </button>
                <button
                  type="button"
                  className="icon-btn h-10 w-10"
                  aria-label={`Delete saved search ${s.name}`}
                  onClick={() => {
                    removeSearch(s.id);
                    toast({ message: "Saved search deleted", action: { label: "Undo", onClick: () => restoreSearch(s) } });
                  }}
                >
                  <TrashIcon width={16} height={16} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function RecentlyViewed() {
  const { recent, clearRecent } = useApp();
  const { employer } = useData();
  return (
    <section aria-labelledby="rv-h" className="card p-4">
      <div className="flex items-center justify-between">
        <h2 id="rv-h" className="flex items-center gap-2 text-sm font-semibold">
          <HistoryIcon width={16} height={16} /> Recently viewed
        </h2>
        {recent.length > 0 && (
          <button type="button" className="link min-h-[36px] text-xs" onClick={clearRecent}>
            Clear
          </button>
        )}
      </div>
      {recent.length === 0 ? (
        <p className="muted mt-2 text-sm">Jobs you open will be listed here.</p>
      ) : (
        <ul className="mt-2 grid gap-1">
          {recent.slice(0, 8).map((r) => (
            <li key={r.id}>
              <Link
                to={jobPath(r, employer(r.company).name)}
                className="-mx-2 block rounded-lg px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <span className="block truncate text-sm font-medium">{r.title}</span>
                <span className="muted block truncate text-xs">
                  {employer(r.company).name} · {relativeDays(r.at)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
