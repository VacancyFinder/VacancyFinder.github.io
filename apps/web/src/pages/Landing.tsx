import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { EXTENDED_FIELD_SLUGS, FIELD_DESCRIPTIONS, FIELD_LABELS, TECH_FIELD_SLUGS, type FieldSlug } from "@rekiya/shared/constants";
import { CompanyBadge } from "../components/CompanyBadge";
import { ChevronDownIcon, ChevronRightIcon, SearchIcon } from "../components/Icons";
import { JobList } from "../components/JobList";
import { REPO_URL, SUGGEST_URL } from "../components/Layout";
import { InstallButton } from "../components/Pwa";
import { ShareSite } from "../components/ShareSite";
import { JobListSkeleton } from "../components/Skeleton";
import { useApp } from "../lib/app-state";
import { useData, useJobs } from "../lib/data";
import { sortNewest } from "../lib/filters";
import { relativeTime } from "../lib/format";
import { fieldPath, HOME_META } from "../lib/paths";
import { usePrivatePage, useSeo, SITE_URL } from "../lib/seo";
import { faqLd, FAQ_TEXT, organizationLd, websiteLd } from "../lib/structured-data";

const POPULAR = ["Software engineer", "Intern", "Accountant", "Data", "Marketing", "HR"];

const STEPS = [
  ["Pick your fields", "Software, data, design, HR, finance and more — choose what you want to do."],
  ["We check career pages", "Every three hours Rekiya reads the official career pages of Sri Lankan companies."],
  ["See what's new", "Your feed shows open roles, newest first, with a New badge on what appeared since your last visit."],
  ["Apply at the source", "Apply takes you to the company's own listing. We never see or handle your application."],
] as const;

export const FAQ: [string, React.ReactNode][] = [
  [
    "Where do the jobs come from?",
    "Only from companies' own career pages and their official recruiting systems (like Workday, Lever or Oracle). We don't copy from job boards or recruitment agencies, so every listing is from the employer itself.",
  ],
  [
    "How often is it updated?",
    "Every three hours. A job disappears from Rekiya once it has been missing from the company's page for two checks in a row, so closed jobs don't linger.",
  ],
  [
    "Is it free? Do I need an account?",
    "Yes, it's free, and there are no accounts. Saved jobs, notes and settings stay in your browser — nothing is sent to us.",
  ],
  [
    "How do I apply?",
    "Open a job and press Apply. You'll go to the company's own listing and apply there. Genuine employers never ask you to pay to apply.",
  ],
  [
    "Can I get alerts?",
    "Save a search and Rekiya counts the new matches each time you visit. You can also subscribe to any field's RSS feed in a feed reader, and install Rekiya as an app.",
  ],
  [
    "A company is missing — can you add it?",
    <>
      Yes.{" "}
      <a href={SUGGEST_URL} className="link" rel="noopener">
        Suggest its careers page
      </a>{" "}
      and we'll check whether it can be read reliably and politely.
    </>,
  ],
  [
    "I'm an employer. Can I be removed or corrected?",
    <>
      Of course.{" "}
      <a href={`${REPO_URL}/issues/new`} className="link" rel="noopener">
        Open an issue
      </a>{" "}
      and we'll act on it. Rekiya respects robots.txt and only keeps a job's title, location and a short snippet, always linking back to
      you.
    </>,
  ],
];

function HeroSearch() {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    nav(q.trim() ? `/jobs/?q=${encodeURIComponent(q.trim())}` : "/jobs/");
  };
  return (
    <form role="search" onSubmit={submit} className="mt-6 max-w-2xl">
      <div className="flex flex-col gap-2 rounded-2xl bg-white p-2 shadow-xl sm:flex-row">
        <div className="relative flex-1">
          <label htmlFor="hero-q" className="sr-only">
            Search jobs
          </label>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            id="hero-q"
            type="search"
            enterKeyHint="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Job title, skill or company"
            autoComplete="off"
            className="h-12 w-full rounded-xl border-0 bg-transparent pl-10 pr-3 text-base text-slate-900 placeholder:text-slate-500 focus:outline-none focus-visible:outline-none"
          />
        </div>
        <button type="submit" className="btn h-12 rounded-xl bg-brand-800 px-6 text-base text-white hover:bg-brand-900">
          Search jobs
        </button>
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-brand-100">
        <span>Popular:</span>
        {POPULAR.map((p) => (
          <Link
            key={p}
            to={`/jobs/?q=${encodeURIComponent(p)}`}
            className="inline-flex min-h-[32px] items-center rounded-full border border-white/25 px-3 text-white hover:bg-white/10"
          >
            {p}
          </Link>
        ))}
      </p>
    </form>
  );
}

export function Landing() {
  const { prefs } = useApp();
  const { meta, directory, employer } = useData();
  useSeo({
    ...HOME_META(meta?.totals.open ?? 0, meta?.totals.companiesWithJobs ?? 0),
    path: "/",
    jsonLd: [websiteLd(SITE_URL), organizationLd(SITE_URL), faqLd(FAQ_TEXT)],
  });
  const { jobs } = useJobs("all");
  const tracked = directory?.companies.filter((c) => c.status === "ready" && c.active).length;
  const hasData = meta && Date.parse(meta.generatedAt) > 0;
  const latest = useMemo(() => (jobs ? sortNewest(jobs).slice(0, 6) : null), [jobs]);
  const topCompanies = useMemo(
    () =>
      Object.entries(meta?.byCompany ?? {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8),
    [meta],
  );
  const fieldCount = (f: FieldSlug) => meta?.byField[f] ?? 0;

  return (
    <div>
      <section className="relative overflow-hidden bg-brand-800 text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_20%,rgba(251,191,36,0.18),transparent_45%),radial-gradient(circle_at_10%_90%,rgba(134,169,216,0.25),transparent_40%)]"
        />
        <div className="container-page relative pb-14 pt-10 sm:pb-16 sm:pt-14">
          <p className="text-sm font-semibold uppercase tracking-widest text-amber-300">Let us do the searching. You do the applying.</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Latest job vacancies in Sri Lanka
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-brand-100">
            Every open job from the career pages of Sri Lankan companies — CSE-listed firms and leading tech employers — in one place,
            updated every 3 hours and sorted by field and experience level.
          </p>
          <HeroSearch />
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to={prefs.onboarded ? "/jobs/" : "/onboarding/"} className="btn bg-amber-400 text-brand-950 hover:bg-amber-300">
              {prefs.onboarded ? "See my jobs" : "Get started"}
            </Link>
            <Link to="/jobs/" className="btn border border-white/40 text-white hover:bg-white/10">
              Browse all jobs
            </Link>
            <InstallButton className="btn border border-white/40 text-white hover:bg-white/10" />
          </div>
          {/* Always rendered (with placeholders) so loading the numbers doesn't shift the layout. */}
          <dl className="mt-10 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                ["Open jobs", meta ? meta.totals.open.toLocaleString() : "–"],
                ["Companies hiring", meta ? String(meta.totals.companiesWithJobs) : "–"],
                ["Career pages checked", tracked !== undefined ? String(tracked) : "–"],
                ["Last updated", meta ? (hasData ? relativeTime(meta.generatedAt) : "soon") : "–"],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="rounded-xl bg-white/10 p-3 ring-1 ring-white/10">
                <dt className="text-xs text-brand-100">{k}</dt>
                <dd className="text-2xl font-bold">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="container-page">
        <section aria-labelledby="latest-h" className="mt-12">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="latest-h" className="text-xl font-bold sm:text-2xl">
              Latest jobs
            </h2>
            <Link to="/jobs/" className="link inline-flex items-center gap-1 text-sm">
              View all <ChevronRightIcon width={16} height={16} />
            </Link>
          </div>
          <div className="mt-4">
            {latest ? (
              <JobList jobs={latest} className="lg:grid-cols-2" />
            ) : (
              <JobListSkeleton rows={6} label="Loading latest jobs…" className="lg:grid-cols-2" />
            )}
          </div>
        </section>

        <section aria-labelledby="fields-h" className="mt-14">
          <h2 id="fields-h" className="text-xl font-bold sm:text-2xl">
            Browse by field
          </h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {TECH_FIELD_SLUGS.map((f) => (
              <li key={f}>
                <Link to={fieldPath(f)} className="card card-hover flex min-h-[72px] items-center gap-3 p-3">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{FIELD_LABELS[f]}</span>
                    <span className="muted block truncate text-sm">{FIELD_DESCRIPTIONS[f]}</span>
                  </span>
                  <span className="chip shrink-0 bg-brand-50 text-brand-800 dark:bg-brand-900/60 dark:text-brand-100">{fieldCount(f)}</span>
                </Link>
              </li>
            ))}
          </ul>
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="More fields">
            {EXTENDED_FIELD_SLUGS.filter((f) => f !== "other").map((f) => (
              <li key={f}>
                <Link to={fieldPath(f)} className="pill pill-off">
                  {FIELD_LABELS[f]} <span className="muted">{fieldCount(f)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {topCompanies.length > 0 && (
          <section aria-labelledby="co-h" className="mt-14">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="co-h" className="text-xl font-bold sm:text-2xl">
                Top hiring companies
              </h2>
              <Link to="/companies/" className="link inline-flex items-center gap-1 text-sm">
                All {directory ? directory.companies.length : ""} companies <ChevronRightIcon width={16} height={16} />
              </Link>
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {topCompanies.map(([slug, n]) => {
                const e = employer(slug);
                return (
                  <li key={slug}>
                    <Link to={`/companies/${slug}`} className="card card-hover flex min-h-[72px] items-center gap-3 p-3">
                      <CompanyBadge slug={slug} name={e.name} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{e.name}</span>
                        <span className="muted text-xs">
                          {n} open job{n === 1 ? "" : "s"}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section aria-labelledby="how-h" className="mt-14">
          <h2 id="how-h" className="text-xl font-bold sm:text-2xl">
            How it works
          </h2>
          <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="card p-4">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-800 text-sm font-bold text-white dark:bg-brand-300 dark:text-brand-950">
                  {i + 1}
                </span>
                <h3 className="mt-3 font-semibold">{t}</h3>
                <p className="muted mt-1 text-sm">{d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="faq-h" className="mt-14 max-w-3xl">
          <h2 id="faq-h" className="text-xl font-bold sm:text-2xl">
            Questions
          </h2>
          <div className="card mt-4 divide-y divide-slate-200 dark:divide-slate-800">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group">
                <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-medium [&::-webkit-details-marker]:hidden">
                  {q}
                  <ChevronDownIcon width={18} height={18} className="shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <div className="muted px-4 pb-4 text-sm leading-relaxed">{a}</div>
              </details>
            ))}
          </div>
        </section>

        <ShareSite />

        <section className="mt-14 rounded-2xl bg-brand-50 p-6 dark:bg-brand-900/40 sm:p-8">
          <h2 className="text-xl font-bold">Know a company we should track?</h2>
          <p className="mt-1 max-w-2xl text-slate-700 dark:text-slate-300">
            Rekiya covers {directory ? directory.companies.length : "hundreds of"} employers — every company on the Colombo Stock Exchange
            plus Sri Lanka's leading tech firms — and more are added every week.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={SUGGEST_URL} className="btn-primary" rel="noopener">
              Suggest a careers page
            </a>
            <Link to="/companies/" className="btn-secondary">
              Browse the company directory
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

export function NotFound() {
  usePrivatePage("Page not found");
  return (
    <div className="py-12 text-center">
      <p className="text-5xl font-extrabold text-brand-800 dark:text-brand-300">404</p>
      <h1 className="mt-2 text-2xl font-bold">Page not found</h1>
      <p className="muted mt-2">That page doesn't exist or has moved.</p>
      <div className="mt-6 flex justify-center gap-2">
        <Link to="/jobs/" className="btn-primary">
          Browse jobs
        </Link>
        <Link to="/" className="btn-secondary">
          Home
        </Link>
      </div>
    </div>
  );
}
