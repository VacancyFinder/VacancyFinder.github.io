import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { INDUSTRY_LABELS } from "@rekiya/shared/constants";
import { CompanyBadge } from "../components/CompanyBadge";
import { ExternalIcon } from "../components/Icons";
import { JobCard } from "../components/JobCard";
import { SUGGEST_URL } from "../components/Layout";
import { useApp } from "../lib/app-state";
import { useData, useJobs } from "../lib/data";
import { sortNewest } from "../lib/filters";
import { hostOf, relativeTime, safeHref } from "../lib/format";
import { usePageTitle } from "../lib/usePageTitle";
import { trackingState } from "./Companies";

export function Company() {
  const { slug = "" } = useParams();
  const { directory, companyBySlug, employer, companyMatches } = useData();
  const { saved, toggleSave, isNew } = useApp();
  const { jobs } = useJobs("all");
  const c = companyBySlug.get(slug);
  const group = directory?.groups.find((g) => g.slug === slug);
  const name = c?.name ?? group?.name ?? slug;
  usePageTitle(name);

  const members = useMemo(
    () => (group ? (directory?.companies ?? []).filter((x) => x.parentGroup === group.slug) : []),
    [directory, group],
  );
  const list = useMemo(() => sortNewest((jobs ?? []).filter((j) => companyMatches(j.company, slug))), [jobs, slug, companyMatches]);

  if (!directory) return <p role="status">Loading…</p>;
  if (!c && !group) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Company not found</h1>
        <Link to="/companies" className="link mt-2 inline-block">
          Back to companies
        </Link>
      </div>
    );
  }

  const state = c ? trackingState(c) : "tracked";
  const careers = safeHref(c?.careersUrl);
  const site = safeHref(c?.website);
  const parent = c?.parentGroup ? directory.groups.find((g) => g.slug === c.parentGroup) : null;

  return (
    <div>
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link to="/companies" className="link">
          Companies
        </Link>
        {parent && (
          <>
            {" / "}
            <Link to={`/companies/${parent.slug}`} className="link">
              {parent.name}
            </Link>
          </>
        )}
      </nav>
      <div className="mt-3 flex items-start gap-4">
        <CompanyBadge slug={slug} name={name} size="lg" />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {[
              c ? INDUSTRY_LABELS[c.industry] : "Group",
              c?.cseSymbol ? `CSE: ${c.cseSymbol}` : null,
              c?.sourceLists.includes("tech") ? "Tech employer" : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {careers && (
              <a href={careers} target="_blank" rel="noopener noreferrer" className="btn-secondary">
                Careers page <ExternalIcon width={16} height={16} />
              </a>
            )}
            {site && (
              <a href={site} target="_blank" rel="noopener noreferrer" className="btn-secondary">
                {hostOf(site)} <ExternalIcon width={16} height={16} />
              </a>
            )}
          </div>
        </div>
      </div>

      {c && state === "soon" && (
        <div className="card mt-6 p-4 text-sm">
          <p className="font-semibold">Coming soon</p>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            {c.status === "needs-research"
              ? "We don't know this company's website or careers page yet."
              : c.status === "needs-discovery"
                ? "We haven't confirmed this company's careers page yet."
                : "We know the careers page but can't read its listings reliably yet."}{" "}
            Know where they post jobs?{" "}
            <a href={SUGGEST_URL} className="link" rel="noopener">
              Suggest it
            </a>
            .
          </p>
        </div>
      )}
      {c && state === "failing" && c.health && (
        <p className="card mt-6 p-4 text-sm" role="status">
          We couldn't read this careers page on the last {c.health.consecutiveFailures} attempt{c.health.consecutiveFailures > 1 ? "s" : ""}
          .{c.health.lastSuccessAt ? ` Jobs below are from ${relativeTime(c.health.lastSuccessAt)}.` : ""}
        </p>
      )}

      {group && members.length > 0 && (
        <section className="mt-6" aria-labelledby="members-h">
          <h2 id="members-h" className="label">
            Group companies
          </h2>
          <ul className="flex flex-wrap gap-2">
            {members.map((m) => (
              <li key={m.slug}>
                <Link
                  to={`/companies/${m.slug}`}
                  className="chip min-h-[36px] border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  {m.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8" aria-labelledby="open-h">
        <h2 id="open-h" className="text-lg font-semibold">
          Open jobs {jobs && <span className="font-normal text-slate-600 dark:text-slate-400">({list.length})</span>}
        </h2>
        {parent && list.some((j) => j.company === parent.slug) && (
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Includes jobs posted on the shared {parent.name} careers page.</p>
        )}
        {!jobs && <p role="status">Loading jobs…</p>}
        {jobs && list.length === 0 && <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">No open jobs right now.</p>}
        <ul className="mt-3 grid gap-3 xl:grid-cols-2">
          {list.map((j) => (
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
      </section>
    </div>
  );
}
