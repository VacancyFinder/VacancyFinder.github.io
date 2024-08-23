import { Link } from "react-router-dom";
import { FIELD_DESCRIPTIONS, FIELD_LABELS, TECH_FIELD_SLUGS } from "@rekiya/shared/constants";
import { InstallButton } from "../components/Pwa";
import { SUGGEST_URL } from "../components/Layout";
import { useApp } from "../lib/app-state";
import { useData } from "../lib/data";
import { relativeTime } from "../lib/format";
import { usePageTitle } from "../lib/usePageTitle";

const STEPS = [
  ["Pick your fields", "Software, data, design, HR, finance and more — choose what you want to do."],
  ["We check career pages", "Every few hours Rekiya reads the official career pages of Sri Lankan companies."],
  ["See what's new", "Your feed shows open roles, newest first, with a NEW badge on what appeared since your last visit."],
  ["Apply at the source", "Apply takes you to the company's own listing. We never handle your application."],
] as const;

export function Landing() {
  usePageTitle("");
  const { prefs } = useApp();
  const { meta, directory } = useData();
  const tracked = directory?.companies.filter((c) => c.status === "ready" && c.active).length;
  const hasData = meta && Date.parse(meta.generatedAt) > 0;

  return (
    <div>
      <section className="-mx-4 -mt-6 bg-brand-800 px-4 pb-12 pt-10 text-white">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-amber-300">Sri Lanka job search</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-bold leading-tight tracking-tight sm:text-5xl">Let us do the searching. You do the applying.</h1>
          <p className="mt-4 max-w-2xl text-lg text-brand-100">
            Rekiya collects open vacancies from the career pages of Sri Lankan companies — CSE-listed firms and tech employers — and sorts them by field and seniority.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to={prefs.onboarded ? "/jobs" : "/onboarding"} className="btn bg-amber-400 text-brand-950 hover:bg-amber-300">
              {prefs.onboarded ? "See my jobs" : "Get started"}
            </Link>
            <Link to="/jobs" className="btn border border-white/40 text-white hover:bg-white/10">
              Browse all jobs
            </Link>
            <InstallButton className="btn border border-white/40 text-white hover:bg-white/10" />
          </div>
          {meta && (
            <dl className="mt-8 grid max-w-2xl grid-cols-3 gap-3">
              <div className="rounded-xl bg-white/10 p-3">
                <dt className="text-xs text-brand-100">Open jobs</dt>
                <dd className="text-2xl font-bold">{meta.totals.open}</dd>
              </div>
              <div className="rounded-xl bg-white/10 p-3">
                <dt className="text-xs text-brand-100">Companies tracked</dt>
                <dd className="text-2xl font-bold">{tracked ?? "–"}</dd>
              </div>
              <div className="rounded-xl bg-white/10 p-3">
                <dt className="text-xs text-brand-100">Last updated</dt>
                <dd className="text-lg font-bold">{hasData ? relativeTime(meta.generatedAt) : "soon"}</dd>
              </div>
            </dl>
          )}
        </div>
      </section>

      <section aria-labelledby="how-h" className="mt-10">
        <h2 id="how-h" className="text-xl font-bold">
          How it works
        </h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="card p-4">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-800 text-sm font-bold text-white dark:bg-brand-300 dark:text-brand-950">{i + 1}</span>
              <h3 className="mt-3 font-semibold">{t}</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="fields-h" className="mt-10">
        <h2 id="fields-h" className="text-xl font-bold">
          Fields
        </h2>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {TECH_FIELD_SLUGS.map((f) => (
            <li key={f}>
              <Link to={`/jobs?fields=${f}`} className="card flex min-h-[64px] flex-col justify-center p-3 hover:border-brand-300 dark:hover:border-brand-700">
                <span className="font-semibold">
                  {FIELD_LABELS[f]}
                  {meta?.byField[f] ? <span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400">{meta.byField[f]} open</span> : null}
                </span>
                <span className="text-sm text-slate-600 dark:text-slate-400">{FIELD_DESCRIPTIONS[f]}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">Plus finance, banking, sales, hospitality, engineering, logistics, healthcare, admin and legal roles.</p>
      </section>

      <section aria-labelledby="co-h" className="mt-10">
        <h2 id="co-h" className="text-xl font-bold">
          Companies
        </h2>
        <p className="mt-2 max-w-3xl text-slate-700 dark:text-slate-300">
          {directory ? `${directory.companies.length} employers` : "Hundreds of employers"} — every company listed on the Colombo Stock Exchange plus Sri Lanka's leading tech firms. Many are still being added; you can help by{" "}
          <a href={SUGGEST_URL} className="link" rel="noopener">
            suggesting a careers page
          </a>
          .
        </p>
        <Link to="/companies" className="btn-secondary mt-4">
          Browse the company directory
        </Link>
      </section>

      <section aria-labelledby="ethics-h" className="mt-10 max-w-3xl">
        <h2 id="ethics-h" className="text-xl font-bold">
          How we collect jobs
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Rekiya reads public career pages and official job APIs, respects each site's robots.txt, waits between requests and identifies itself as RekiyaBot. It keeps only a job's title, location and a short snippet,
          and always links to the original listing. Companies can ask to be removed by opening an issue on GitHub.
        </p>
      </section>
    </div>
  );
}

export function NotFound() {
  usePageTitle("Page not found");
  return (
    <div className="py-12 text-center">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">That page doesn't exist.</p>
      <Link to="/" className="btn-primary mt-6">
        Go home
      </Link>
    </div>
  );
}
