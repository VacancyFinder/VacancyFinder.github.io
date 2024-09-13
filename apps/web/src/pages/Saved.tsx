import { useMemo } from "react";
import { Link } from "react-router-dom";
import { CheckIcon, ExternalIcon, XIcon } from "../components/Icons";
import { JobCard } from "../components/JobCard";
import { useApp } from "../lib/app-state";
import { useData, useJobs } from "../lib/data";
import { relativeDays, safeHref } from "../lib/format";
import { usePageTitle } from "../lib/usePageTitle";

export function Saved() {
  usePageTitle("Saved jobs");
  const { saved, toggleSave, toggleApplied, removeSaved, isNew } = useApp();
  const { employer } = useData();
  const { jobs } = useJobs("all");
  const byId = useMemo(() => new Map((jobs ?? []).map((j) => [j.id, j])), [jobs]);
  const list = Object.values(saved).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  const applied = list.filter((s) => s.applied).length;

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Saved jobs</h1>
      <p className="mt-1 text-slate-600 dark:text-slate-400">
        {list.length
          ? `${list.length} saved · ${applied} marked as applied. Saved on this device only.`
          : "Jobs you bookmark appear here. They're stored on this device only."}
      </p>
      {list.length === 0 && (
        <Link to="/jobs" className="btn-primary mt-4">
          Browse jobs
        </Link>
      )}
      <ul className="mt-4 grid gap-3 xl:grid-cols-2">
        {list.map((s) => {
          const job = byId.get(s.id);
          if (job) {
            return (
              <li key={s.id}>
                <JobCard
                  job={job}
                  employer={employer(job.company)}
                  isNew={isNew(job)}
                  saved
                  applied={s.applied}
                  onToggleSave={toggleSave}
                  onToggleApplied={toggleApplied}
                />
              </li>
            );
          }
          const href = safeHref(s.url);
          return (
            <li key={s.id}>
              <article className="card flex flex-col gap-2 p-4 opacity-90">
                <h3 className="font-semibold">{s.title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {employer(s.company).name} · saved {relativeDays(s.savedAt)}
                </p>
                <p className="chip w-fit bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {jobs ? "No longer listed" : "Loading…"}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {href && (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="btn-secondary">
                      Original listing <ExternalIcon width={16} height={16} />
                    </a>
                  )}
                  <button type="button" className="btn-secondary" aria-pressed={s.applied} onClick={() => toggleApplied(s)}>
                    {s.applied && <CheckIcon width={16} height={16} />}
                    {s.applied ? "Applied" : "Mark as applied"}
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => removeSaved(s.id)}>
                    <XIcon width={16} height={16} /> Remove
                  </button>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
