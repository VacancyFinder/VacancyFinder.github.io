import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FIELD_LABELS, INDUSTRY_LABELS, JOB_TYPE_LABELS, SENIORITY_LABELS, WORK_MODE_LABELS } from "@rekiya/shared/constants";
import { CompanyBadge } from "../components/CompanyBadge";
import { BookmarkIcon, ChevronLeftIcon, ExternalIcon, EyeOffIcon, FlagIcon, ShareIcon, WhatsAppIcon } from "../components/Icons";
import { postedLabel } from "../components/JobCard";
import { JobList } from "../components/JobList";
import { REPO_URL } from "../components/Layout";
import { PageSkeleton } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { useApp } from "../lib/app-state";
import { useData, useJobs } from "../lib/data";
import { similarJobs, sortNewest } from "../lib/filters";
import { appUrl, cleanSnippet, formatDate, hostOf, relativeTime, safeHref } from "../lib/format";
import { APP_STATUSES, APP_STATUS_LABELS, type AppStatus } from "../lib/storage";
import type { Job } from "../lib/types";
import { useJobActions } from "../lib/useJobActions";
import { fieldPath, jobKeyFromParam, jobPath, JOB_META, matchesJobKey, SITE_NAME } from "../lib/paths";
import { SITE_URL, useSeo } from "../lib/seo";
import { jobShareMessage, whatsappUrl } from "../lib/share";
import { breadcrumbLd, jobPostingLd } from "../lib/structured-data";

function BackLink() {
  const nav = useNavigate();
  // Go back to the exact feed (filters, scroll) when we came from inside the app.
  const canGoBack = typeof window !== "undefined" && (window.history.state as { idx?: number } | null)?.idx;
  return (
    <button type="button" className="btn-ghost -ml-3 px-3" onClick={() => (canGoBack ? nav(-1) : nav("/jobs/"))}>
      <ChevronLeftIcon width={18} height={18} /> Back to jobs
    </button>
  );
}

export function JobDetail() {
  const { key: param = "" } = useParams();
  const key = jobKeyFromParam(param);
  const nav = useNavigate();
  const { jobs, error } = useJobs("all");
  const { saved, recent, hidden } = useApp();
  const { employer, companyBySlug } = useData();
  const job = jobs?.find((j) => matchesJobKey(j.id, key)) ?? null;
  const known =
    Object.values(saved).find((s) => matchesJobKey(s.id, key)) ??
    recent.find((r) => matchesJobKey(r.id, key)) ??
    Object.values(hidden).find((h) => matchesJobKey(h.id, key));
  const emp = job ? employer(job.company) : null;
  const canonical = job && emp ? jobPath(job, emp.name) : null;

  useSeo(
    job && emp && canonical
      ? {
          ...JOB_META(job, emp.name),
          path: canonical,
          jsonLd: [
            jobPostingLd(SITE_URL, job, { name: emp.name, website: companyBySlug.get(job.company)?.website }),
            breadcrumbLd(SITE_URL, [
              ["Home", "/"],
              ["Jobs", "/jobs/"],
              [job.title, canonical],
            ]),
          ],
        }
      : { title: `${known?.title ?? "Job"} · ${SITE_NAME}`, noindex: !!jobs },
  );

  // Old links (#/job/<full id>, or a changed title) move to the canonical address.
  useEffect(() => {
    if (canonical && window.location.pathname !== canonical) nav(canonical, { replace: true });
  }, [canonical, nav]);

  if (error) return <p role="alert">This job couldn't be loaded ({error}).</p>;
  if (!jobs) return <PageSkeleton />;
  if (!job) return <Gone title={known?.title} company={known?.company} />;
  return <Detail job={job} all={jobs} />;
}

function Gone({ title, company }: { title?: string; company?: string }) {
  const { employer } = useData();
  return (
    <div className="mx-auto max-w-2xl">
      <BackLink />
      <div className="card mt-2 p-6 text-center">
        <h1 className="text-xl font-bold">{title ? `“${title}” is no longer listed` : "This job is no longer listed"}</h1>
        <p className="muted mt-2 text-sm">
          The company has taken the listing down, or it closed. Jobs disappear from Rekiya when they've been missing from the careers page
          for two checks in a row.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {company && (
            <Link to={`/companies/${company}`} className="btn-primary">
              Other jobs at {employer(company).name}
            </Link>
          )}
          <Link to={title ? `/jobs/?q=${encodeURIComponent(title)}` : "/jobs/"} className="btn-secondary">
            Find similar jobs
          </Link>
        </div>
      </div>
    </div>
  );
}

function Detail({ job, all }: { job: Job; all: Job[] }) {
  const { employer, companyBySlug } = useData();
  const { saved, setStatus, setNotes, addRecent, isNew, hidden, unhideJob } = useApp();
  const { save, hide } = useJobActions();
  const toast = useToast();
  const emp = employer(job.company);
  const company = companyBySlug.get(job.company);
  const entry = saved[job.id];
  const href = safeHref(job.url);
  const snippet = cleanSnippet(job.title, job.snippet) || job.snippet;
  const [notes, setNotesDraft] = useState(entry?.notes ?? "");

  useEffect(() => {
    addRecent(job);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per job
  }, [job.id]);
  useEffect(() => setNotesDraft(saved[job.id]?.notes ?? ""), [job.id, saved]);

  const atCompany = useMemo(() => sortNewest(all.filter((j) => j.company === job.company && j.id !== job.id)).slice(0, 4), [all, job]);
  const similar = useMemo(
    () =>
      similarJobs(
        job,
        all.filter((j) => j.company !== job.company),
      ),
    [all, job],
  );

  const share = async () => {
    const url = appUrl(jobPath(job, emp.name));
    const title = `${job.title} at ${emp.name}`;
    try {
      if (navigator.share) {
        // The URL goes separately so apps build their preview card from it.
        await navigator.share({ title, text: jobShareMessage(job, emp.name, "").trimEnd(), url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast({ message: "Link copied to clipboard" });
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast({ message: "Couldn't share — copy the address from your browser instead" });
    }
  };

  const reportUrl = `${REPO_URL}/issues/new?${new URLSearchParams({
    title: `Listing problem: ${job.title} (${emp.name})`,
    body: `**Job:** ${job.title}\n**Company:** ${emp.name}\n**Listing:** ${job.url}\n**Rekiya id:** ${job.id}\n\n**What's wrong?** (closed, wrong field/seniority, wrong company, duplicate…)\n\n`,
  }).toString()}`;

  const facts: [string, React.ReactNode][] = [
    ["Location", job.location || "Not stated"],
    ["Work mode", job.workMode === "unspecified" ? "Not stated" : WORK_MODE_LABELS[job.workMode]],
    ["Job type", job.type === "unspecified" ? "Not stated" : JOB_TYPE_LABELS[job.type]],
    ["Experience level", job.seniority === "unspecified" ? "Not stated" : SENIORITY_LABELS[job.seniority]],
    [
      "Field",
      <span key="f" className="flex flex-wrap gap-x-3 gap-y-1">
        {job.fields.map((f) => (
          <Link key={f} to={fieldPath(f)} className="link">
            {FIELD_LABELS[f]}
          </Link>
        ))}
      </span>,
    ],
    ["Industry", INDUSTRY_LABELS[job.industry]],
    ["Posted", job.postedAt ? formatDate(job.postedAt) : "Not stated by the company"],
    ["Found on Rekiya", formatDate(job.firstSeenAt)],
    ["Last checked", `${relativeTime(job.lastSeenAt)} — still open`],
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <BackLink />
      <div className="mt-2 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <article aria-labelledby="job-title" className="min-w-0">
          <div className="card p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <CompanyBadge slug={emp.slug} name={emp.name} size="lg" />
              <div className="min-w-0">
                <h1 id="job-title" className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
                  {job.title}
                </h1>
                <p className="mt-1 text-base">
                  <Link to={`/companies/${emp.slug}`} className="link">
                    {emp.name}
                  </Link>
                  {emp.cseSymbol && <span className="muted ml-2 font-mono text-sm">{emp.cseSymbol}</span>}
                </p>
                <p className="muted mt-1 text-sm">
                  {[job.location, postedLabel(job)].filter(Boolean).join(" · ")}
                  {isNew(job) && (
                    <span className="chip ml-2 bg-amber-100 text-amber-900 dark:bg-amber-400/20 dark:text-amber-200">New</span>
                  )}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {href && (
                <a href={href} target="_blank" rel="noopener noreferrer" className="btn-primary h-12 px-6 text-base">
                  Apply on {hostOf(href)} <ExternalIcon width={18} height={18} />
                </a>
              )}
              <button type="button" className="btn-secondary h-12" aria-pressed={!!entry} onClick={() => save(job)}>
                <BookmarkIcon filled={!!entry} width={18} height={18} />
                {entry ? "Saved" : "Save"}
              </button>
              <a
                href={whatsappUrl(jobShareMessage(job, emp.name, appUrl(jobPath(job, emp.name))))}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary h-12"
                aria-label="Share on WhatsApp"
              >
                <WhatsAppIcon width={18} height={18} className="text-[#128c4b] dark:text-[#25d366]" /> WhatsApp
              </a>
              <button type="button" className="btn-secondary h-12" onClick={share}>
                <ShareIcon width={18} height={18} /> Share
              </button>
            </div>

            <section aria-labelledby="summary-h" className="mt-6">
              <h2 id="summary-h" className="text-lg font-semibold">
                About the role
              </h2>
              {snippet ? <p className="mt-2 whitespace-pre-line leading-relaxed text-slate-700 dark:text-slate-300">{snippet}</p> : null}
              <p className="muted mt-3 text-sm">
                {snippet ? "This is a short excerpt. " : ""}Read the full description, requirements and closing date on{" "}
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="link">
                    {emp.name}'s listing
                  </a>
                ) : (
                  "the company's careers page"
                )}
                .
              </p>
            </section>

            <section aria-labelledby="facts-h" className="mt-6">
              <h2 id="facts-h" className="text-lg font-semibold">
                Job details
              </h2>
              <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {facts.map(([k, v]) => (
                  <div key={k} className="border-b border-slate-100 pb-2 dark:border-slate-800">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">{k}</dt>
                    <dd className="mt-0.5 text-sm">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
        </article>

        <aside className="flex flex-col gap-4" aria-label="Your application">
          <div className="card p-4">
            <h2 className="text-sm font-semibold">Track your application</h2>
            <label htmlFor="status" className="muted mt-1 block text-xs">
              Only you can see this. It's stored on this device.
            </label>
            <select
              id="status"
              className="input mt-2"
              value={entry?.status ?? ""}
              onChange={(e) => {
                const v = e.target.value as AppStatus | "";
                if (v) {
                  setStatus(job, v);
                  toast({ message: `Marked as “${APP_STATUS_LABELS[v]}”` });
                }
              }}
            >
              {!entry && <option value="">Not tracked</option>}
              {APP_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {APP_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            {entry && (
              <>
                <label htmlFor="notes" className="label mt-3">
                  Notes
                </label>
                <textarea
                  id="notes"
                  className="input min-h-[96px] py-2"
                  placeholder="Contact person, interview date, salary discussed…"
                  value={notes}
                  maxLength={2000}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  onBlur={() => notes !== (entry.notes ?? "") && setNotes(job.id, notes)}
                />
              </>
            )}
          </div>

          <div className="card p-4 text-sm">
            <h2 className="font-semibold">About {emp.name}</h2>
            <p className="muted mt-1">
              {[
                company ? INDUSTRY_LABELS[company.industry] : emp.isGroup ? "Group of companies" : null,
                emp.cseSymbol ? "Listed on the CSE" : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <Link to={`/companies/${emp.slug}`} className="link mt-2 inline-flex min-h-[40px] items-center">
              All jobs at {emp.name}
            </Link>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            <h2 className="font-semibold">Stay safe</h2>
            <p className="mt-1">
              Genuine employers never charge you to apply or to be interviewed. Apply only on the company's own website.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-sm">
            {hidden[job.id] ? (
              <button type="button" className="btn-ghost" onClick={() => unhideJob(job.id)}>
                <EyeOffIcon width={16} height={16} /> Show in my feed again
              </button>
            ) : (
              <button type="button" className="btn-ghost" onClick={() => hide(job)}>
                <EyeOffIcon width={16} height={16} /> Not interested
              </button>
            )}
            <a href={reportUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost">
              <FlagIcon width={16} height={16} /> Report a problem
            </a>
          </div>
        </aside>
      </div>

      {atCompany.length > 0 && (
        <section aria-labelledby="more-h" className="mt-10">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="more-h" className="text-lg font-semibold">
              More at {emp.name}
            </h2>
            <Link to={`/companies/${emp.slug}`} className="link text-sm">
              See all
            </Link>
          </div>
          <JobList jobs={atCompany} className="mt-3 xl:grid-cols-2" />
        </section>
      )}
      {similar.length > 0 && (
        <section aria-labelledby="similar-h" className="mt-10">
          <h2 id="similar-h" className="text-lg font-semibold">
            Similar jobs at other companies
          </h2>
          <JobList jobs={similar} className="mt-3 xl:grid-cols-2" />
        </section>
      )}
    </div>
  );
}
