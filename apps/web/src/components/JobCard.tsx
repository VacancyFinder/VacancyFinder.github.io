import { memo } from "react";
import { Link } from "react-router-dom";
import { JOB_TYPE_LABELS, SENIORITY_LABELS, WORK_MODE_LABELS } from "@rekiya/shared/constants";
import { relativeDays, safeHref } from "../lib/format";
import type { Employer, Job } from "../lib/types";
import { CompanyBadge } from "./CompanyBadge";
import { BookmarkIcon, CheckIcon, ClockIcon, ExternalIcon, MapPinIcon } from "./Icons";

export interface JobCardProps {
  job: Job;
  employer: Employer;
  isNew: boolean;
  saved: boolean;
  applied: boolean;
  onToggleSave: (job: Job) => void;
  onToggleApplied?: (job: Job) => void;
}

function JobCardInner({ job, employer, isNew, saved, applied, onToggleSave, onToggleApplied }: JobCardProps) {
  const href = safeHref(job.url);
  const posted = job.postedAt ? `Posted ${relativeDays(job.postedAt)}` : `First seen ${relativeDays(job.firstSeenAt)}`;
  const titleId = `job-${job.id}`;
  return (
    <article aria-labelledby={titleId} className="card flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <CompanyBadge slug={employer.slug} name={employer.name} />
        <div className="min-w-0 flex-1">
          <h3 id={titleId} className="text-base font-semibold leading-snug text-slate-900 dark:text-white">
            {job.title}
            {isNew && (
              <span className="chip ml-2 bg-amber-100 align-middle text-amber-900 dark:bg-amber-400/20 dark:text-amber-200">
                NEW
              </span>
            )}
          </h3>
          <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-300">
            <Link to={`/companies/${employer.slug}`} className="link">
              {employer.name}
            </Link>
            {employer.cseSymbol && <span className="ml-2 font-mono text-xs text-slate-500 dark:text-slate-400">{employer.cseSymbol}</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onToggleSave(job)}
          aria-pressed={saved}
          aria-label={saved ? `Remove ${job.title} from saved jobs` : `Save ${job.title}`}
          className="-mr-2 -mt-2 inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-brand-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-brand-300"
        >
          <BookmarkIcon filled={saved} className={saved ? "text-brand-700 dark:text-brand-300" : ""} />
        </button>
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-400" aria-label="Job details">
        {job.location && (
          <li className="inline-flex items-center gap-1">
            <MapPinIcon width={16} height={16} />
            {job.location}
          </li>
        )}
        <li className="inline-flex items-center gap-1">
          <ClockIcon width={16} height={16} />
          <time dateTime={job.postedAt ?? job.firstSeenAt}>{posted}</time>
        </li>
      </ul>

      <div className="flex flex-wrap gap-1.5">
        {job.seniority !== "unspecified" && <span className="chip bg-brand-50 text-brand-800 dark:bg-brand-900/60 dark:text-brand-100">{SENIORITY_LABELS[job.seniority]}</span>}
        {job.workMode !== "unspecified" && <span className="chip bg-emerald-50 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">{WORK_MODE_LABELS[job.workMode]}</span>}
        {job.type !== "unspecified" && <span className="chip bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">{JOB_TYPE_LABELS[job.type]}</span>}
      </div>

      {job.snippet && <p className="line-clamp-3 text-sm text-slate-600 dark:text-slate-400">{job.snippet}</p>}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="btn-primary" aria-label={`Apply for ${job.title} at ${employer.name} (opens the company's listing in a new tab)`}>
            Apply <ExternalIcon width={16} height={16} />
          </a>
        ) : null}
        {onToggleApplied && (
          <button type="button" onClick={() => onToggleApplied(job)} aria-pressed={applied} className="btn-secondary">
            {applied ? <CheckIcon width={16} height={16} /> : null}
            {applied ? "Applied" : "Mark as applied"}
          </button>
        )}
      </div>
    </article>
  );
}

export const JobCard = memo(JobCardInner);
