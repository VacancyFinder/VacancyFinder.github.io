import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  FIELD_LABELS,
  INDUSTRY_LABELS,
  JOB_TYPE_LABELS,
  SENIORITIES,
  SENIORITY_LABELS,
  WORK_MODE_LABELS,
  type FieldSlug,
  type IndustrySlug,
} from "@rekiya/shared/constants";
import { PageSkeleton } from "../components/Skeleton";
import { useData, useJobs } from "../lib/data";
import { relativeTime } from "../lib/format";
import { usePageTitle } from "../lib/usePageTitle";

interface Row {
  key: string;
  label: string;
  value: number;
  to: string;
}

/**
 * A horizontal bar list: one hue (magnitude, single series), 12px bars from a shared baseline,
 * rounded only at the data end, value in text ink at the tip. Each row links to the matching feed
 * and has a hover/focus tooltip with its share of the total.
 */
function BarList({ title, desc, rows, total, id }: { title: string; desc?: string; rows: Row[]; total: number; id: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <section aria-labelledby={id} className="card p-5">
      <h2 id={id} className="text-base font-semibold">
        {title}
      </h2>
      {desc && <p className="muted mt-0.5 text-sm">{desc}</p>}
      <ul className="mt-4 grid gap-0.5">
        {rows.map((r) => {
          const pct = total ? Math.round((r.value / total) * 100) : 0;
          return (
            <li key={r.key}>
              <Link
                to={r.to}
                className="group relative grid min-h-[36px] grid-cols-[minmax(0,11rem)_1fr] items-center gap-3 rounded-md px-2 hover:bg-slate-50 focus-visible:bg-slate-50 dark:hover:bg-slate-800/60 dark:focus-visible:bg-slate-800/60 sm:grid-cols-[minmax(0,13rem)_1fr]"
              >
                <span className="truncate text-sm text-slate-700 dark:text-slate-300">{r.label}</span>
                <span className="flex items-center gap-2">
                  <span
                    className="h-3 rounded-r bg-brand-600 transition-colors group-hover:bg-brand-800 dark:bg-brand-300 dark:group-hover:bg-brand-200"
                    style={{ width: `calc(${(r.value / max) * 100}% - 3rem)`, minWidth: r.value ? 4 : 0 }}
                    aria-hidden="true"
                  />
                  <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                    {r.value}
                    <span className="sr-only"> open jobs ({pct}%)</span>
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-9 right-2 z-10 hidden whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white shadow group-hover:block group-focus-visible:block dark:bg-slate-100 dark:text-slate-900"
                >
                  {r.value} jobs · {pct}% of open jobs · view
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <dt className="muted text-sm">{label}</dt>
      <dd className="mt-1 text-2xl font-bold tabular-nums">{value}</dd>
      {sub && <dd className="muted text-xs">{sub}</dd>}
    </div>
  );
}

export function Insights() {
  usePageTitle("Job market insights");
  const { meta, employer } = useData();
  const { jobs } = useJobs("all");

  const agg = useMemo(() => {
    if (!jobs) return null;
    const open = jobs.filter((j) => j.status === "open");
    const count = <K extends string>(get: (j: (typeof open)[number]) => K) => {
      const m = new Map<K, number>();
      for (const j of open) m.set(get(j), (m.get(get(j)) ?? 0) + 1);
      return m;
    };
    const week = Date.now() - 7 * 86_400_000;
    return {
      total: open.length,
      seniority: count((j) => j.seniority),
      workMode: count((j) => j.workMode),
      type: count((j) => j.type),
      entry: open.filter((j) => ["intern", "trainee", "junior"].includes(j.seniority)).length,
      flexible: open.filter((j) => j.workMode === "remote" || j.workMode === "hybrid").length,
      thisWeek: open.filter((j) => Date.parse(j.postedAt ?? j.firstSeenAt) >= week).length,
    };
  }, [jobs]);

  if (!meta || !agg) return <PageSkeleton />;
  const total = agg.total;
  const pct = (n: number) => (total ? `${Math.round((n / total) * 100)}%` : "–");

  const fields: Row[] = Object.entries(meta.byField)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([f, n]) => ({ key: f, label: FIELD_LABELS[f as FieldSlug] ?? f, value: n, to: `/jobs?fields=${f}` }));
  const seniority: Row[] = SENIORITIES.filter((s) => s !== "unspecified" && agg.seniority.get(s)).map((s) => ({
    key: s,
    label: SENIORITY_LABELS[s],
    value: agg.seniority.get(s) ?? 0,
    to: `/jobs?seniority=${s}`,
  }));
  const companies: Row[] = Object.entries(meta.byCompany)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([c, n]) => ({ key: c, label: employer(c).name, value: n, to: `/companies/${c}` }));
  const industries: Row[] = Object.entries(meta.byIndustry)
    .sort((a, b) => b[1] - a[1])
    .map(([i, n]) => ({ key: i, label: INDUSTRY_LABELS[i as IndustrySlug] ?? i, value: n, to: `/jobs?industry=${i}` }));
  const modes: Row[] = (["onsite", "hybrid", "remote"] as const)
    .filter((m) => agg.workMode.get(m))
    .map((m) => ({ key: m, label: WORK_MODE_LABELS[m], value: agg.workMode.get(m) ?? 0, to: `/jobs?workMode=${m}` }));
  const types: Row[] = (["full-time", "contract", "internship", "part-time"] as const)
    .filter((t) => agg.type.get(t))
    .map((t) => ({ key: t, label: JOB_TYPE_LABELS[t], value: agg.type.get(t) ?? 0, to: `/jobs?type=${t}` }));
  const unstated = (m: Map<string, number>) => m.get("unspecified") ?? 0;

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Job market insights</h1>
      <p className="muted mt-1 max-w-2xl">
        What Sri Lankan employers are hiring for right now, from the career pages Rekiya checks. Updated {relativeTime(meta.generatedAt)}.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="card flex flex-col justify-center p-5">
          <p className="muted text-sm">Open jobs right now</p>
          <p className="text-5xl font-extrabold tabular-nums tracking-tight">{total.toLocaleString()}</p>
          <p className="muted mt-1 text-sm">at {meta.totals.companiesWithJobs} employers</p>
          <Link to="/jobs" className="link mt-3 text-sm">
            Browse them all
          </Link>
        </div>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="Posted in the last 7 days" value={agg.thisWeek.toLocaleString()} sub={pct(agg.thisWeek)} />
          <Stat label="Entry level" value={agg.entry.toLocaleString()} sub={`${pct(agg.entry)} · intern, trainee, junior`} />
          <Stat label="Remote or hybrid" value={agg.flexible.toLocaleString()} sub={pct(agg.flexible)} />
          <Stat label="Internships" value={(agg.type.get("internship") ?? 0).toLocaleString()} sub={pct(agg.type.get("internship") ?? 0)} />
          <Stat label="Career pages checked" value={String(meta.totals.targets)} sub={`${meta.totals.targetsOk} read successfully`} />
          <Stat label="Top field" value={fields[0]?.label ?? "–"} sub={fields[0] ? `${fields[0].value} jobs` : undefined} />
        </dl>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <BarList id="ch-fields" title="Jobs by field" desc="A job can belong to more than one field." rows={fields} total={total} />
        <div className="grid content-start gap-4">
          <BarList
            id="ch-sen"
            title="Jobs by experience level"
            desc={`${unstated(agg.seniority)} listings don't state a level.`}
            rows={seniority}
            total={total}
          />
          <BarList
            id="ch-mode"
            title="Work mode"
            desc={`${unstated(agg.workMode)} listings don't say whether they're on-site, hybrid or remote.`}
            rows={modes}
            total={total}
          />
          <BarList id="ch-type" title="Job type" desc={`${unstated(agg.type)} listings don't state a type.`} rows={types} total={total} />
        </div>
        <BarList id="ch-co" title="Top hiring companies" rows={companies} total={total} />
        <BarList id="ch-ind" title="Jobs by industry" rows={industries} total={total} />
      </div>

      <p className="muted mt-6 text-sm">
        Counts cover open listings on the career pages Rekiya reads, so they reflect those employers rather than the whole job market. Field
        and level are assigned automatically from each job's title and description.
      </p>
    </div>
  );
}
