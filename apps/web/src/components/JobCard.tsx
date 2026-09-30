import { memo } from "react";
import { Link } from "react-router-dom";
import { JOB_TYPE_LABELS, SENIORITY_LABELS, WORK_MODE_LABELS } from "@rekiya/shared/constants";
import { cleanSnippet, relativeDays, safeHref } from "../lib/format";
import { APP_STATUS_LABELS, type AppStatus } from "../lib/storage";
import type { Employer, Job } from "../lib/types";
import { CompanyBadge } from "./CompanyBadge";
import { BookmarkIcon, ClockIcon, ExternalIcon, EyeOffIcon, MapPinIcon } from "./Icons";

export interface JobCardProps {
  job: Job;
  employer: Employer;
  isNew: boolean;
  saved: boolean;
  /** Application status when saved (shown as a badge unless it's plain "saved"). */
  status?: AppStatus;
  viewed?: boolean;
  onToggleSave: (job: Job) => void;
  onHide?: (job: Job) => void;
}

const STATUS_STYLE: Record<AppStatus, string> = {
  saved: "",
  applied: "bg-sky-50 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  interviewing: "bg-violet-50 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200",
  offer: "bg-emerald-50 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  rejected: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};
export { STATUS_STYLE };

export function postedLabel(job: Pick<Job, "postedAt" | "firstSeenAt">): string {
  return job.postedAt ? `Posted ${relativeDays(job.postedAt)}` : `Found ${relativeDays(job.firstSeenAt)}`;
}

function JobCardInner({ job, employer, isNew, saved, status, viewed, onToggleSave, onHide }: JobCardProps) {
  const href = safeHref(job.url);
  const titleId = `job-${job.id}`;
  const snippet = cleanSnippet(job.title, job.snippet);
  return (
    <article aria-labelledby={titleId} className="card card-hover group relative flex gap-3 p-4">
      <CompanyBadge slug={employer.slug} name={employer.name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 id={titleId} className="text-base font-semibold leading-snug text-slate-900 dark:text-white">
              {/* The title link covers the whole card (after:inset-0); buttons and Apply sit above it. */}
              <Link
                to={`/job/${job.id}`}
                className={`after:absolute after:inset-0 after:rounded-xl after:content-[''] group-hover:text-brand-700 group-hover:underline dark:group-hover:text-brand-300 ${viewed ? "text-slate-700 dark:text-slate-300" : ""}`}
              >
                {job.title}
              </Link>
              {isNew && (
                <span className="chip ml-2 bg-amber-100 align-middle text-amber-900 dark:bg-amber-400/20 dark:text-amber-200">New</span>
              )}
            </h3>
            <p className="mt-0.5 truncate text-sm text-slate-700 dark:text-slate-300">
              <span className="font-medium">{employer.name}</span>
              {employer.cseSymbol && (
                <span className="ml-2 hidden font-mono text-xs text-slate-600 dark:text-slate-400 sm:inline">{employer.cseSymbol}</span>
              )}
            </p>
          </div>
          <div className="relative z-10 -mr-2 -mt-2 flex">
            {onHide && (
              <button
                type="button"
                onClick={() => onHide(job)}
                aria-label={`Hide ${job.title}`}
                title="Not interested — hide"
                className="icon-btn"
              >
                <EyeOffIcon width={18} height={18} />
              </button>
            )}
            <button
              type="button"
              onClick={() => onToggleSave(job)}
              aria-pressed={saved}
              aria-label={saved ? `Remove ${job.title} from saved jobs` : `Save ${job.title}`}
              title={saved ? "Saved" : "Save"}
              className="icon-btn"
            >
              <BookmarkIcon filled={saved} className={saved ? "text-brand-700 dark:text-brand-300" : ""} />
            </button>
          </div>
        </div>

        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-400" aria-label="Job details">
          {job.location && (
            <li className="inline-flex items-center gap-1">
              <MapPinIcon width={15} height={15} />
              {job.location}
            </li>
          )}
          <li className="inline-flex items-center gap-1">
            <ClockIcon width={15} height={15} />
            <time dateTime={job.postedAt ?? job.firstSeenAt}>{postedLabel(job)}</time>
          </li>
          {viewed && <li className="text-xs font-medium uppercase tracking-wide">Viewed</li>}
        </ul>

        {snippet && <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">{snippet}</p>}

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {status && status !== "saved" && <span className={`chip ${STATUS_STYLE[status]}`}>{APP_STATUS_LABELS[status]}</span>}
          {job.seniority !== "unspecified" && (
            <span className="chip bg-brand-50 text-brand-800 dark:bg-brand-900/60 dark:text-brand-100">
              {SENIORITY_LABELS[job.seniority]}
            </span>
          )}
          {job.workMode !== "unspecified" && (
            <span className="chip bg-emerald-50 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
              {WORK_MODE_LABELS[job.workMode]}
            </span>
          )}
          {job.type !== "unspecified" && (
            <span className="chip bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">{JOB_TYPE_LABELS[job.type]}</span>
          )}
          {href && (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="link relative z-10 -my-2 ml-auto inline-flex min-h-[44px] items-center gap-1 text-sm"
              aria-label={`Apply for ${job.title} at ${employer.name} (opens the company's listing in a new tab)`}
            >
              Apply <ExternalIcon width={15} height={15} />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

export const JobCard = memo(JobCardInner);
