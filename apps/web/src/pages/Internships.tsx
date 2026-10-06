import { useMemo } from "react";
import { Link } from "react-router-dom";
import { FIELD_LABELS, type FieldSlug } from "@rekiya/shared/constants";
import { JobList } from "../components/JobList";
import { JobListSkeleton } from "../components/Skeleton";
import { useData, useJobs } from "../lib/data";
import { sortNewest } from "../lib/filters";
import { relativeTime } from "../lib/format";
import { fieldPath, INTERNSHIPS_META, INTERNSHIPS_PATH, isInternship } from "../lib/paths";
import { SITE_URL, useSeo } from "../lib/seo";
import { breadcrumbLd, FAQ_TEXT, faqLd, internshipCrumbs, jobListLd } from "../lib/structured-data";

/** Landing page for "internships in Sri Lanka": internships, traineeships and intern-level roles. */
export function Internships() {
  const { meta, employer } = useData();
  const { jobs, error } = useJobs("all");
  const list = useMemo(() => sortNewest((jobs ?? []).filter(isInternship)), [jobs]);

  const byField = useMemo(() => {
    const m = new Map<FieldSlug, number>();
    for (const j of list) for (const f of j.fields) if (f !== "other") m.set(f, (m.get(f) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [list]);

  useSeo({
    ...INTERNSHIPS_META(list.length),
    path: INTERNSHIPS_PATH,
    noindex: !!jobs && list.length === 0,
    jsonLd: [
      breadcrumbLd(SITE_URL, internshipCrumbs),
      jobListLd(SITE_URL, "Internships in Sri Lanka", list, (s) => employer(s).name),
      faqLd(FAQ_TEXT.filter(([q]) => /internship/i.test(q))),
    ],
  });

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Internships in Sri Lanka</h1>
      <p className="mt-2 max-w-3xl text-slate-700 dark:text-slate-300">
        {jobs ? `${list.length} open` : "Open"} internships, traineeships and intern-level roles from Sri Lankan companies' own career pages
        {meta ? `, updated ${relativeTime(meta.generatedAt)}` : ""}. For university students, undergraduates and fresh graduates — you apply
        directly on the employer's website.
      </p>
      <p className="mt-3 text-sm">
        <Link to="/jobs/?type=internship" className="link">
          Search and filter internships
        </Link>{" "}
        ·{" "}
        <Link to="/jobs/?seniority=intern,trainee,junior" className="link">
          All entry-level jobs
        </Link>
      </p>

      {byField.length > 0 && (
        <section aria-labelledby="by-field-h" className="mt-6">
          <h2 id="by-field-h" className="sr-only">
            Internships by field
          </h2>
          <ul className="flex flex-wrap gap-2">
            {byField.map(([f, n]) => (
              <li key={f}>
                <Link to={fieldPath(f)} className="pill pill-off">
                  {FIELD_LABELS[f]} <span className="muted">{n}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="list-h" className="mt-6">
        <h2 id="list-h" className="sr-only">
          Open internships
        </h2>
        {error && <p role="alert">Internships couldn't be loaded ({error}).</p>}
        {!jobs && !error && <JobListSkeleton rows={4} />}
        {jobs && list.length === 0 && (
          <p className="card muted p-4 text-sm">
            No internships are open right now. New ones are added every 3 hours — save a search on the{" "}
            <Link to="/jobs/?type=internship" className="link">
              job feed
            </Link>{" "}
            to see them first.
          </p>
        )}
        <JobList jobs={list} className="xl:grid-cols-2" />
      </section>
    </div>
  );
}
