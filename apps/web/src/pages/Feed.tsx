import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FIELD_LABELS, type IndustrySlug } from "@rekiya/shared/constants";
import { FilterPanel, type FilterOptions } from "../components/FilterPanel";
import { FilterIcon, RssIcon, SearchIcon, XIcon } from "../components/Icons";
import { JobCard } from "../components/JobCard";
import { useApp } from "../lib/app-state";
import { useData, useJobs } from "../lib/data";
import { activeFilterCount, applyFilters, EMPTY_FILTERS, parseFilters, serializeFilters, sortNewest, type Filters } from "../lib/filters";
import { buildIndex, searchIds } from "../lib/search";
import type { Employer, Job } from "../lib/types";
import { usePageTitle } from "../lib/usePageTitle";

const PAGE = 30;

export function Feed() {
  usePageTitle("Jobs");
  const [params, setParams] = useSearchParams();
  const { prefs, saved, toggleSave, isNew } = useApp();
  const data = useData();
  const [showFilters, setShowFilters] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  // First visit to the feed: start from the user's saved preferences (then the URL is the truth).
  useEffect(() => {
    if ([...params.keys()].length === 0 && (prefs.fields.length || prefs.seniority.length)) {
      setParams(serializeFilters({ ...EMPTY_FILTERS, fields: prefs.fields, seniority: prefs.seniority }), { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on mount
  }, []);

  const f = useMemo(() => parseFilters(params), [params]);
  const set = (patch: Partial<Filters>) => {
    setLimit(PAGE);
    setParams(serializeFilters({ ...f, ...patch }), { replace: true });
  };

  const { jobs, error } = useJobs(f.fields.length ? f.fields : "all");
  const employer = data.employer;
  const q = useDeferredValue(f.q);

  const index = useMemo(() => (jobs ? buildIndex(jobs, (s) => employer(s).name) : null), [jobs, employer]);
  const results = useMemo(() => {
    if (!jobs) return null;
    const filtered = applyFilters(jobs, f, { isCse: data.isCse, companyMatches: data.companyMatches, isNew });
    const ids = index ? searchIds(index, q) : null;
    if (!ids) return sortNewest(filtered);
    const rank = new Map(ids.map((id, i) => [id, i]));
    return filtered.filter((j) => rank.has(j.id)).sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
  }, [jobs, f, q, index, data.isCse, data.companyMatches, isNew]);

  const options = useMemo<FilterOptions>(() => {
    const ind = new Map<IndustrySlug, number>();
    const co = new Map<string, number>();
    const loc = new Map<string, number>();
    for (const j of jobs ?? []) {
      ind.set(j.industry, (ind.get(j.industry) ?? 0) + 1);
      co.set(j.company, (co.get(j.company) ?? 0) + 1);
      for (const l of j.location.split(" · ")) if (l) loc.set(l, (loc.get(l) ?? 0) + 1);
    }
    return {
      industries: [...ind.entries()].sort((a, b) => b[1] - a[1]),
      companies: [...co.entries()]
        .map(([s, n]) => [employer(s), n] as [Employer, number])
        .sort((a, b) => a[0].name.localeCompare(b[0].name)),
      locations: [...loc.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30)
        .map(([l]) => l),
      fieldCounts: data.meta?.byField ?? {},
    };
  }, [jobs, employer, data.meta]);

  const newCount = useMemo(() => (jobs ?? []).filter(isNew).length, [jobs, isNew]);
  const nFilters = activeFilterCount(f);
  const heading = f.fields.length === 1 ? `${FIELD_LABELS[f.fields[0]!]} jobs` : f.fields.length > 1 ? "Jobs in your fields" : "All jobs";

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{heading}</h1>
          {f.fields.length > 1 && (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{f.fields.map((x) => FIELD_LABELS[x]).join(" · ")}</p>
          )}
        </div>
        {f.fields.length === 1 && (
          <a
            href={`${import.meta.env.BASE_URL}feeds/${f.fields[0]}.xml`}
            className="link inline-flex min-h-[44px] items-center gap-1 text-sm"
          >
            <RssIcon width={16} height={16} /> RSS feed
          </a>
        )}
      </div>

      {!prefs.onboarded && (
        <p className="card mt-4 flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <span>Tell us which fields you're interested in and we'll show just those jobs.</span>
          <Link to="/onboarding" className="btn-primary">
            Choose fields
          </Link>
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <div className="relative flex-1">
          <label htmlFor="q" className="sr-only">
            Search jobs
          </label>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            id="q"
            type="search"
            className="input pl-10"
            placeholder="Search title, company, location…"
            value={f.q}
            onChange={(e) => set({ q: e.target.value })}
            autoComplete="off"
          />
        </div>
        <button
          type="button"
          className="btn-secondary lg:hidden"
          aria-expanded={showFilters}
          aria-controls="filters"
          onClick={() => setShowFilters((s) => !s)}
        >
          <FilterIcon width={18} height={18} />
          Filters{nFilters ? ` (${nFilters})` : ""}
        </button>
      </div>

      {newCount > 0 && !f.newOnly && (
        <p className="mt-3 text-sm">
          <button type="button" className="link min-h-[44px]" onClick={() => set({ newOnly: true })}>
            {newCount} new job{newCount > 1 ? "s" : ""} since your last visit
          </button>
        </p>
      )}

      <div className="mt-4 grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside id="filters" aria-label="Filters" className={`${showFilters ? "block" : "hidden"} lg:block`}>
          <div className="card p-4 lg:sticky lg:top-20">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Filters</h2>
              {(nFilters > 0 || f.fields.length > 0) && (
                <button type="button" className="link min-h-[44px] text-sm" onClick={() => set({ ...EMPTY_FILTERS, q: f.q })}>
                  Clear all
                </button>
              )}
            </div>
            <FilterPanel f={f} set={set} options={options} />
          </div>
        </aside>

        <section aria-label="Results">
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-400" role="status" aria-live="polite">
            {error ? "" : results === null ? "Loading jobs…" : `${results.length} open job${results.length === 1 ? "" : "s"}`}
          </p>
          {error && (
            <p role="alert" className="card p-4 text-sm text-red-700 dark:text-red-300">
              Jobs couldn't be loaded ({error}). Check your connection and reload.
            </p>
          )}
          {results && results.length === 0 && <Empty f={f} clear={() => set({ ...EMPTY_FILTERS })} total={jobs?.length ?? 0} />}
          {results && results.length > 0 && (
            <>
              <ul className="grid gap-3 xl:grid-cols-2">
                {results.slice(0, limit).map((j: Job) => (
                  <li key={j.id}>
                    <JobCard
                      job={j}
                      employer={employer(j.company)}
                      isNew={isNew(j)}
                      saved={!!saved[j.id]}
                      applied={!!saved[j.id]?.applied}
                      onToggleSave={toggleSave}
                    />
                  </li>
                ))}
              </ul>
              {results.length > limit && (
                <div className="mt-6 text-center">
                  <button type="button" className="btn-secondary" onClick={() => setLimit((l) => l + PAGE)}>
                    Show more ({results.length - limit} more)
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function Empty({ f, clear, total }: { f: Filters; clear: () => void; total: number }) {
  const { meta } = useData();
  const noData = meta && meta.totals.open === 0;
  return (
    <div className="card p-6 text-center">
      <p className="font-semibold">
        {noData ? "No jobs collected yet" : total === 0 ? "No open jobs in these fields right now" : "No jobs match these filters"}
      </p>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        {noData
          ? "The first crawl hasn't run yet. Browse the companies we track in the meantime."
          : "Try removing a filter or searching for something broader."}
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {(activeFilterCount(f) > 0 || f.fields.length > 0 || f.q) && (
          <button type="button" className="btn-secondary" onClick={clear}>
            <XIcon width={16} height={16} /> Clear filters
          </button>
        )}
        <Link to="/companies" className="btn-secondary">
          Browse companies
        </Link>
      </div>
    </div>
  );
}
