import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { INDUSTRY_LABELS, type IndustrySlug } from "@rekiya/shared/constants";
import { CompanyBadge } from "../components/CompanyBadge";
import { SearchIcon } from "../components/Icons";
import { SUGGEST_URL } from "../components/Layout";
import { useData } from "../lib/data";
import type { DirectoryCompany } from "../lib/types";
import { usePageTitle } from "../lib/usePageTitle";

type Show = "all" | "tracked" | "soon";

export function trackingState(c: DirectoryCompany): "tracked" | "failing" | "soon" | "off" {
  if (!c.active || c.status === "disabled") return "off";
  if (c.status === "ready") return c.health && !c.health.ok ? "failing" : "tracked";
  return "soon";
}

function Status({ c }: { c: DirectoryCompany }) {
  const s = trackingState(c);
  if (s === "tracked")
    return <span className="chip bg-emerald-50 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">Tracked</span>;
  if (s === "failing")
    return <span className="chip bg-amber-50 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">Temporarily unavailable</span>;
  if (s === "off") return <span className="chip bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">Not tracked</span>;
  return <span className="chip bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">Coming soon</span>;
}

export function Companies() {
  usePageTitle("Companies");
  const { directory, meta, error } = useData();
  const [params, setParams] = useSearchParams();
  const q = (params.get("q") ?? "").toLowerCase();
  const show = (["all", "tracked", "soon"].includes(params.get("show") ?? "") ? params.get("show") : "all") as Show;
  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v && v !== "all") p.set(k, v);
    else p.delete(k);
    setParams(p, { replace: true });
  };

  const groupName = useMemo(() => new Map((directory?.groups ?? []).map((g) => [g.slug, g.name])), [directory]);
  const jobsFor = (c: DirectoryCompany) => meta?.byCompany[c.slug] ?? 0;

  const sections = useMemo(() => {
    const list = (directory?.companies ?? []).filter((c) => {
      const st = trackingState(c);
      if (show === "tracked" && st !== "tracked" && st !== "failing") return false;
      if (show === "soon" && st !== "soon") return false;
      if (!q) return true;
      return `${c.name} ${c.cseSymbol ?? ""} ${c.parentGroup ? groupName.get(c.parentGroup) : ""}`.toLowerCase().includes(q);
    });
    const byInd = new Map<IndustrySlug, DirectoryCompany[]>();
    for (const c of list) byInd.set(c.industry, [...(byInd.get(c.industry) ?? []), c]);
    return [...byInd.entries()]
      .sort((a, b) => INDUSTRY_LABELS[a[0]].localeCompare(INDUSTRY_LABELS[b[0]]))
      .map(
        ([ind, cs]) =>
          [ind, cs.sort((a, b) => (a.parentGroup ?? "~").localeCompare(b.parentGroup ?? "~") || a.name.localeCompare(b.name))] as const,
      );
  }, [directory, q, show, groupName]);

  const counts = useMemo(() => {
    const cs = directory?.companies ?? [];
    return {
      all: cs.length,
      tracked: cs.filter((c) => ["tracked", "failing"].includes(trackingState(c))).length,
      soon: cs.filter((c) => trackingState(c) === "soon").length,
    };
  }, [directory]);

  if (error) return <p role="alert">The company list couldn't be loaded ({error}).</p>;
  if (!directory) return <p role="status">Loading companies…</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Companies</h1>
      <p className="mt-1 text-slate-600 dark:text-slate-400">
        {counts.all} Sri Lankan employers — CSE-listed companies and tech firms. {counts.tracked} are crawled for jobs today; the rest are
        coming soon.
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <label htmlFor="cq" className="sr-only">
            Search companies
          </label>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            id="cq"
            type="search"
            className="input pl-10"
            placeholder="Company, CSE symbol or group…"
            value={params.get("q") ?? ""}
            onChange={(e) => set("q", e.target.value)}
          />
        </div>
        <div role="radiogroup" aria-label="Show" className="flex overflow-hidden rounded-lg border border-slate-300 dark:border-slate-700">
          {(
            [
              ["all", `All (${counts.all})`],
              ["tracked", `Tracked (${counts.tracked})`],
              ["soon", `Coming soon (${counts.soon})`],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={show === v}
              onClick={() => set("show", v)}
              className={`min-h-[44px] flex-1 whitespace-nowrap px-3 text-sm font-medium ${show === v ? "bg-brand-800 text-white dark:bg-brand-300 dark:text-brand-950" : "bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-300"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
        Know the careers page of a company that's coming soon?{" "}
        <a href={SUGGEST_URL} className="link" rel="noopener">
          Suggest it
        </a>
        .
      </p>

      {sections.length === 0 && <p className="card mt-6 p-6 text-center">No companies match.</p>}
      {sections.map(([ind, cs]) => (
        <section key={ind} aria-labelledby={`ind-${ind}`} className="mt-8">
          <h2 id={`ind-${ind}`} className="mb-3 text-lg font-semibold">
            {INDUSTRY_LABELS[ind]} <span className="font-normal text-slate-500 dark:text-slate-400">({cs.length})</span>
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {cs.map((c) => (
              <li key={c.slug}>
                <Link
                  to={`/companies/${c.slug}`}
                  className="card flex min-h-[72px] items-center gap-3 p-3 hover:border-brand-300 dark:hover:border-brand-700"
                >
                  <CompanyBadge slug={c.slug} name={c.name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{c.name}</span>
                    <span className="block truncate text-xs text-slate-600 dark:text-slate-400">
                      {[c.cseSymbol, c.parentGroup ? groupName.get(c.parentGroup) : null].filter(Boolean).join(" · ") ||
                        (c.sourceLists.includes("tech") ? "Tech" : "")}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <Status c={c} />
                    {jobsFor(c) > 0 && <span className="text-xs font-semibold text-brand-800 dark:text-brand-300">{jobsFor(c)} open</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
