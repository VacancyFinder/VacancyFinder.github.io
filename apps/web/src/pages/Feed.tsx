import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FIELD_LABELS, type IndustrySlug } from "@rekiya/shared/constants";
import { FilterPanel, type FilterOptions } from "../components/FilterPanel";
import { BellIcon, CheckIcon, FilterIcon, RssIcon, SearchIcon, XIcon } from "../components/Icons";
import { JobList } from "../components/JobList";
import { Sheet } from "../components/Sheet";
import { JobListSkeleton } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { useApp } from "../lib/app-state";
import { SYNC_EVERY_MS, useData, useJobs } from "../lib/data";
import {
  activeChips,
  activeFilterCount,
  applyFilters,
  describeFilters,
  EMPTY_FILTERS,
  hasAnyFilter,
  parseFilters,
  QUICK_FILTERS,
  serializeFilters,
  SORT_LABELS,
  SORTS,
  sortJobs,
  sortNewest,
  type Filters,
  type SortKey,
} from "../lib/filters";
import { nextSyncLabel, relativeTime } from "../lib/format";
import { buildIndex, searchIds } from "../lib/search";
import type { Employer, Job } from "../lib/types";
import { FIELD_META, fieldPath, isFieldSlug, JOBS_META, SITE_NAME } from "../lib/paths";
import { SITE_URL, useSeo } from "../lib/seo";
import { breadcrumbLd, fieldCrumbs, jobListLd } from "../lib/structured-data";

const PAGE = 25;

export function Feed() {
  const [params] = useSearchParams();
  const { field: fieldParam } = useParams();
  const routeField = isFieldSlug(fieldParam) ? fieldParam : null;
  const navigate = useNavigate();
  const location = useLocation();
  const { prefs, isNew, isHidden, searches, addSearch, removeSearch } = useApp();
  const data = useData();
  const toast = useToast();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const searchRef = useRef<HTMLInputElement>(null);

  // First visit to the feed: start from the user's saved preferences (then the URL is the truth).
  useEffect(() => {
    if (!routeField && [...params.keys()].length === 0 && (prefs.fields.length || prefs.seniority.length)) {
      navigate(`/jobs/?${serializeFilters({ ...EMPTY_FILTERS, fields: prefs.fields, seniority: prefs.seniority })}`, { replace: true });
    }
    if ((location.state as { focusSearch?: boolean } | null)?.focusSearch) searchRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on mount
  }, []);

  // /jobs/<field>/ is the crawlable page for one field; any further filtering continues at /jobs/?….
  const f = useMemo(() => {
    const parsed = parseFilters(params);
    return routeField && !params.has("fields") ? { ...parsed, fields: [routeField] } : parsed;
  }, [params, routeField]);
  const set = (patch: Partial<Filters>) => {
    setLimit(PAGE);
    const next = serializeFilters({ ...f, ...patch });
    const only = parseFilters(next);
    const single = only.fields.length === 1 && next.toString() === `fields=${only.fields[0]}`;
    navigate(single ? fieldPath(only.fields[0]!) : `/jobs/${next.toString() ? `?${next}` : ""}`, { replace: true });
  };
  const clearAll = () => set({ ...EMPTY_FILTERS });

  const heading = f.fields.length === 1 ? `${FIELD_LABELS[f.fields[0]!]} jobs` : f.fields.length > 1 ? "Jobs in your fields" : "All jobs";
  const { jobs, error } = useJobs(f.fields.length ? f.fields : "all");
  const employer = data.employer;
  const companyName = (s: string) => employer(s).name;

  // Index the plain feed and one-field pages; searches and combined filters are views, not pages.
  const onlyField = f.fields.length === 1 && activeFilterCount(f) === 0 && !f.q.trim() && !f.sort ? f.fields[0]! : null;
  const plain = !hasAnyFilter(f) && !f.sort;
  const fieldCount = onlyField ? (data.meta?.byField[onlyField] ?? jobs?.length ?? 0) : 0;
  useSeo(
    onlyField
      ? {
          ...FIELD_META(onlyField, fieldCount),
          path: fieldPath(onlyField),
          jsonLd: [
            breadcrumbLd(SITE_URL, fieldCrumbs(onlyField)),
            ...(jobs ? [jobListLd(SITE_URL, `${FIELD_LABELS[onlyField]} jobs in Sri Lanka`, sortNewest(jobs), companyName)] : []),
          ],
        }
      : plain
        ? { ...JOBS_META(data.meta?.totals.open ?? 0), path: "/jobs/" }
        : { title: `${f.q.trim() ? `“${f.q.trim()}” jobs` : heading} in Sri Lanka · ${SITE_NAME}`, noindex: true },
  );
  const q = useDeferredValue(f.q);
  const sort: SortKey = f.sort || (q.trim() ? "relevance" : "newest");

  const index = useMemo(() => (jobs ? buildIndex(jobs, (s) => employer(s).name) : null), [jobs, employer]);
  const results = useMemo(() => {
    if (!jobs) return null;
    const filtered = applyFilters(jobs, f, { isCse: data.isCse, companyMatches: data.companyMatches, isNew, isHidden });
    const ids = index ? searchIds(index, q) : null;
    const idSet = ids ? new Set(ids) : null;
    const matched = idSet ? filtered.filter((j) => idSet.has(j.id)) : filtered;
    if (ids && sort === "relevance") {
      const rank = new Map(ids.map((id, i) => [id, i]));
      return matched.sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
    }
    return sortJobs(matched, sort === "relevance" ? "newest" : sort, (s) => employer(s).name);
  }, [jobs, f, q, sort, index, data.isCse, data.companyMatches, isNew, isHidden, employer]);

  const options = useMemo<FilterOptions>(() => {
    const ind = new Map<IndustrySlug, number>();
    const co = new Map<string, number>();
    const loc = new Map<string, number>();
    const sen: Record<string, number> = {};
    for (const j of jobs ?? []) {
      ind.set(j.industry, (ind.get(j.industry) ?? 0) + 1);
      co.set(j.company, (co.get(j.company) ?? 0) + 1);
      sen[j.seniority] = (sen[j.seniority] ?? 0) + 1;
      for (const l of j.location.split(" · ")) if (l && l !== "Sri Lanka") loc.set(l, (loc.get(l) ?? 0) + 1);
    }
    return {
      industries: [...ind.entries()].sort((a, b) => b[1] - a[1]),
      companies: [...co.entries()]
        .map(([s, n]) => [employer(s), n] as [Employer, number])
        .sort((a, b) => a[0].name.localeCompare(b[0].name)),
      locations: [...loc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30),
      fieldCounts: data.meta?.byField ?? {},
      seniorityCounts: sen,
    };
  }, [jobs, employer, data.meta]);

  const newCount = useMemo(() => (jobs ?? []).filter((j) => isNew(j) && !isHidden(j)).length, [jobs, isNew, isHidden]);
  const hiddenCount = useMemo(() => (jobs ?? []).filter((j) => j.status === "open" && isHidden(j)).length, [jobs, isHidden]);
  const nFilters = activeFilterCount(f);
  const chips = activeChips(f, companyName);
  const paramString = serializeFilters({ ...f, sort: "" }).toString();
  const savedSearch = searches.find((s) => s.params === paramString);

  const toggleSavedSearch = () => {
    if (savedSearch) {
      removeSearch(savedSearch.id);
      toast({ message: "Search removed" });
      return;
    }
    const s = addSearch(describeFilters(f, companyName), paramString);
    toast({ message: "Search saved — new matches are counted under Saved", action: { label: "Undo", onClick: () => removeSearch(s.id) } });
  };

  const shown = results ? results.slice(0, limit) : [];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{heading}</h1>
          <p className="muted mt-1 text-sm">
            {f.fields.length > 1 ? `${f.fields.map((x) => FIELD_LABELS[x]).join(" · ")} · ` : ""}
            {data.meta && Date.parse(data.meta.generatedAt) > 0
              ? `Updated ${relativeTime(data.meta.generatedAt)} · next update ${nextSyncLabel(data.meta.generatedAt, SYNC_EVERY_MS)}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {f.fields.length === 1 && (
            <a href={`${import.meta.env.BASE_URL}feeds/${f.fields[0]}.xml`} className="btn-ghost" title="Subscribe in a feed reader">
              <RssIcon width={16} height={16} /> RSS
            </a>
          )}
          {hasAnyFilter(f) && (
            <button type="button" className="btn-secondary" aria-pressed={!!savedSearch} onClick={toggleSavedSearch}>
              {savedSearch ? <CheckIcon width={16} height={16} /> : <BellIcon width={16} height={16} />}
              {savedSearch ? "Search saved" : "Save search"}
            </button>
          )}
        </div>
      </div>

      {!prefs.onboarded && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900 dark:border-brand-800 dark:bg-brand-900/40 dark:text-brand-100">
          <span>
            <strong>Personalise your feed.</strong> Tell us which fields you're interested in and we'll show those jobs first.
          </span>
          <Link to="/onboarding/" className="btn-primary">
            Choose fields
          </Link>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <div className="relative flex-1">
          <label htmlFor="q" className="sr-only">
            Search jobs
          </label>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            id="q"
            ref={searchRef}
            type="search"
            enterKeyHint="search"
            className="input h-12 pl-10 pr-10 text-base"
            placeholder="Job title, skill, company or location"
            value={f.q}
            onChange={(e) => set({ q: e.target.value })}
            autoComplete="off"
          />
          {!f.q && <span className="kbd pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 sm:inline-flex">/</span>}
        </div>
        <button
          type="button"
          className="btn-secondary h-12 lg:hidden"
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          onClick={() => setSheetOpen(true)}
        >
          <FilterIcon width={18} height={18} />
          <span>Filters</span>
          {nFilters + f.fields.length > 0 && (
            <span className="chip bg-brand-800 text-white dark:bg-brand-300 dark:text-brand-950">{nFilters + f.fields.length}</span>
          )}
        </button>
      </div>

      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Quick filters">
        {newCount > 0 && (
          <button
            type="button"
            className={`pill ${f.newOnly ? "pill-on" : "pill-off"}`}
            aria-pressed={f.newOnly}
            onClick={() => set({ newOnly: !f.newOnly })}
          >
            <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden="true" />
            New for you ({newCount})
          </button>
        )}
        {QUICK_FILTERS.map((qf) => {
          const on = qf.isOn(f);
          return (
            <button
              key={qf.key}
              type="button"
              className={`pill ${on ? "pill-on" : "pill-off"}`}
              aria-pressed={on}
              onClick={() => set(qf.toggle(f))}
            >
              {qf.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[272px_minmax(0,1fr)]">
        <aside aria-label="Filters" className="hidden lg:block">
          <div className="card no-scrollbar p-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Filters</h2>
              {hasAnyFilter(f) && (
                <button type="button" className="link min-h-[36px] text-sm" onClick={clearAll}>
                  Clear all
                </button>
              )}
            </div>
            <FilterPanel f={f} set={set} options={options} />
          </div>
        </aside>

        <section aria-labelledby="results-h" className="min-w-0">
          <h2 id="results-h" className="sr-only">
            Job results
          </h2>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-700 dark:text-slate-300" role="status" aria-live="polite">
              {error ? "" : results === null ? "Loading jobs…" : <ResultCount n={results.length} />}
            </p>
            <div className="flex items-center gap-2">
              <label htmlFor="sort" className="muted text-sm">
                Sort by
              </label>
              <select
                id="sort"
                className="input h-10 min-h-0 w-auto py-0 pr-8"
                value={sort}
                onChange={(e) => set({ sort: e.target.value === (q.trim() ? "relevance" : "newest") ? "" : (e.target.value as SortKey) })}
              >
                {(q.trim() ? (["relevance", ...SORTS] as SortKey[]) : [...SORTS]).map((s) => (
                  <option key={s} value={s}>
                    {SORT_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {chips.length > 0 && (
            <ul className="mb-3 flex flex-wrap items-center gap-1.5" aria-label="Active filters">
              {chips.map((c) => (
                <li key={c.key}>
                  <button
                    type="button"
                    className="pill border-brand-200 bg-brand-50 text-brand-900 hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-900/40 dark:text-brand-100 dark:hover:bg-brand-900/70"
                    onClick={() => set(c.remove)}
                    aria-label={`Remove filter: ${c.label}`}
                  >
                    {c.label}
                    <XIcon width={14} height={14} />
                  </button>
                </li>
              ))}
              {chips.length > 1 && (
                <li>
                  <button type="button" className="link min-h-[36px] px-2 text-sm" onClick={clearAll}>
                    Clear all
                  </button>
                </li>
              )}
            </ul>
          )}

          {error && (
            <div role="alert" className="card p-4 text-sm text-red-700 dark:text-red-300">
              Jobs couldn't be loaded ({error}). Check your connection and{" "}
              <button type="button" className="link" onClick={() => window.location.reload()}>
                try again
              </button>
              .
            </div>
          )}
          {!error && results === null && <JobListSkeleton />}
          {results && results.length === 0 && <Empty f={f} clear={clearAll} total={jobs?.length ?? 0} />}
          {results && results.length > 0 && (
            <>
              <JobList jobs={shown as Job[]} />
              <div className="mt-6 flex flex-col items-center gap-2">
                <p className="muted text-sm">
                  Showing {shown.length} of {results.length}
                </p>
                {results.length > limit && (
                  <button type="button" className="btn-secondary" onClick={() => setLimit((l) => l + PAGE)}>
                    Show {Math.min(PAGE, results.length - limit)} more
                  </button>
                )}
              </div>
            </>
          )}
          {hiddenCount > 0 && (
            <p className="muted mt-4 text-center text-sm">
              {hiddenCount} job{hiddenCount > 1 ? "s" : ""} you hid {hiddenCount > 1 ? "aren't" : "isn't"} shown.{" "}
              <Link to="/settings/#hidden" className="link">
                Manage hidden jobs
              </Link>
            </p>
          )}
        </section>
      </div>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Filters"
        footer={
          <div className="flex gap-2">
            <button type="button" className="btn-secondary flex-1" onClick={clearAll} disabled={!hasAnyFilter(f)}>
              Clear all
            </button>
            <button type="button" className="btn-primary flex-[2]" onClick={() => setSheetOpen(false)}>
              {results ? `Show ${results.length} job${results.length === 1 ? "" : "s"}` : "Show jobs"}
            </button>
          </div>
        }
      >
        <FilterPanel f={f} set={set} options={options} />
      </Sheet>
    </div>
  );
}

function ResultCount({ n }: { n: number }) {
  return (
    <>
      <strong className="font-semibold text-slate-900 dark:text-white">{n.toLocaleString()}</strong> open job{n === 1 ? "" : "s"}
    </>
  );
}

function Empty({ f, clear, total }: { f: Filters; clear: () => void; total: number }) {
  const { meta } = useData();
  const noData = meta && meta.totals.open === 0;
  return (
    <div className="card p-8 text-center">
      <SearchIcon width={32} height={32} className="mx-auto text-slate-400" />
      <p className="mt-3 text-lg font-semibold">
        {noData ? "No jobs collected yet" : total === 0 ? "No open jobs in these fields right now" : "No jobs match these filters"}
      </p>
      <p className="muted mx-auto mt-1 max-w-md text-sm">
        {noData
          ? "The first crawl hasn't run yet. Browse the companies we track in the meantime."
          : "Try removing a filter, checking the spelling, or searching for something broader. Save the search to be told when matching jobs appear."}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {hasAnyFilter(f) && (
          <button type="button" className="btn-primary" onClick={clear}>
            <XIcon width={16} height={16} /> Clear filters
          </button>
        )}
        <Link to="/companies/" className="btn-secondary">
          Browse companies
        </Link>
      </div>
    </div>
  );
}
