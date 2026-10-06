import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { FIELD_LABELS, type FieldSlug } from "@rekiya/shared/constants";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JobList } from "../components/JobList";
import { JobListSkeleton } from "../components/Skeleton";
import { useData, useJobs } from "../lib/data";
import { sortNewest } from "../lib/filters";
import { fieldPath, LOCATION_META, LOCATION_MIN_JOBS, locationIntro, locationPath, PLACES, placeSlugsOf } from "../lib/paths";
import { SITE_URL, useSeo } from "../lib/seo";
import { breadcrumbLd, jobListLd, locationCrumbs } from "../lib/structured-data";
import { NotFound } from "./Landing";

/** "Jobs in <city>": every open job whose location names the city. Indexed only with enough jobs. */
export function Location() {
  const { place: slug = "" } = useParams();
  const place = PLACES[slug];
  const { employer } = useData();
  const { jobs, error } = useJobs("all");
  const list = useMemo(() => sortNewest((jobs ?? []).filter((j) => placeSlugsOf(j.location).includes(slug))), [jobs, slug]);

  const byField = useMemo(() => {
    const m = new Map<FieldSlug, number>();
    for (const j of list) for (const f of j.fields) if (f !== "other") m.set(f, (m.get(f) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [list]);

  useSeo(
    place
      ? {
          ...LOCATION_META(place, list.length),
          path: locationPath(slug),
          noindex: !!jobs && list.length < LOCATION_MIN_JOBS,
          jsonLd: [
            breadcrumbLd(SITE_URL, locationCrumbs(slug, place)),
            jobListLd(SITE_URL, `Jobs in ${place}`, list, (s) => employer(s).name),
          ],
        }
      : { title: "Page not found", noindex: true },
  );
  if (!place) return <NotFound />;

  return (
    <div>
      <Breadcrumbs items={locationCrumbs(slug, place)} />
      <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Jobs in {place}</h1>
      <p className="mt-2 max-w-3xl text-slate-700 dark:text-slate-300">{locationIntro(place)}</p>
      <p className="mt-3 text-sm">
        <Link to={`/jobs/?location=${encodeURIComponent(place)}`} className="link">
          Filter {place} jobs
        </Link>
      </p>

      <h2 className="mt-6 text-xl font-bold">Open vacancies in {place}</h2>
      <div className="mt-3">
        {error && <p role="alert">Jobs couldn't be loaded ({error}).</p>}
        {!jobs && !error && <JobListSkeleton rows={4} />}
        {jobs && list.length === 0 && (
          <p className="card muted p-4 text-sm">
            No open jobs in {place} right now. New vacancies are added every 3 hours —{" "}
            <Link to="/jobs/" className="link">
              browse all jobs in Sri Lanka
            </Link>
            .
          </p>
        )}
        <JobList jobs={list} className="xl:grid-cols-2" />
      </div>

      {byField.length > 0 && (
        <section aria-labelledby="loc-fields-h" className="mt-8">
          <h2 id="loc-fields-h" className="text-xl font-bold">
            {place} jobs by field
          </h2>
          <ul className="mt-2 flex flex-wrap gap-2">
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
    </div>
  );
}
