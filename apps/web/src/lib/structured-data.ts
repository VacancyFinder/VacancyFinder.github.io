/**
 * schema.org JSON-LD for search engines and AI assistants. Pure functions (no DOM): the build uses them
 * for prerendered pages and the app for client-side navigation, so both always agree.
 */
import { FIELD_LABELS, JOB_TYPE_LABELS, SENIORITY_LABELS, WORK_MODE_LABELS, type FieldSlug } from "@rekiya/shared/constants";
import { cleanSnippet } from "./format";
import { absUrl, companyPath, fieldPath, jobPath, SITE_NAME } from "./paths";
import type { Job } from "./types";

type Ld = Record<string, unknown>;

const EMPLOYMENT: Record<string, string> = {
  "full-time": "FULL_TIME",
  "part-time": "PART_TIME",
  contract: "CONTRACTOR",
  internship: "INTERN",
};

/** Towns only; "Head Office", "Islandwide" etc. aren't places a map can find. */
const NOT_A_PLACE = /^(sri lanka|head office|.*head office|islandwide|island ?wide|remote|multiple locations?|various)$/i;

export function websiteLd(siteUrl: string): Ld {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${absUrl(siteUrl, "/")}#website`,
    name: SITE_NAME,
    alternateName: ["Rekiya Jobs", "රැකියා", "Sri Lanka job vacancies"],
    url: absUrl(siteUrl, "/"),
    inLanguage: "en-LK",
    description: "Latest job vacancies in Sri Lanka, collected from employers' own career pages every 3 hours.",
    publisher: { "@id": `${absUrl(siteUrl, "/")}#organization` },
    // Sitelinks search box.
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${absUrl(siteUrl, "/jobs/")}?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

export function organizationLd(siteUrl: string): Ld {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${absUrl(siteUrl, "/")}#organization`,
    name: SITE_NAME,
    url: absUrl(siteUrl, "/"),
    logo: absUrl(siteUrl, "/icon-512.png"),
    areaServed: { "@type": "Country", name: "Sri Lanka" },
    sameAs: ["https://github.com/VacancyFinder/VacancyFinder.github.io"],
  };
}

export function breadcrumbLd(siteUrl: string, items: [string, string][]): Ld {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: absUrl(siteUrl, path) })),
  };
}

/** Google for Jobs: one JobPosting per job page. */
export function jobPostingLd(
  siteUrl: string,
  job: Job,
  company: { name: string; website?: string | null },
  extra: { validThrough?: string } = {},
): Ld {
  const places = job.location
    .split(" · ")
    .map((l) => l.trim())
    .filter((l) => l && !NOT_A_PLACE.test(l));
  const remote = job.workMode === "remote";
  // The listing excerpt plus the facts we know, so the description stands on its own.
  const facts = [
    job.type !== "unspecified" ? `Job type: ${JOB_TYPE_LABELS[job.type]}` : "",
    job.seniority !== "unspecified" ? `Experience level: ${SENIORITY_LABELS[job.seniority]}` : "",
    job.workMode !== "unspecified" ? `Work mode: ${WORK_MODE_LABELS[job.workMode]}` : "",
    `Location: ${job.location || "Sri Lanka"}`,
    `Field: ${job.fields.map((f) => FIELD_LABELS[f]).join(", ")}`,
  ].filter(Boolean);
  const snippet = cleanSnippet(job.title, job.snippet) || job.snippet || `${company.name} is hiring a ${job.title} in Sri Lanka.`;
  const ld: Ld = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: `<p>${escapeHtml(snippet)}</p><ul>${facts.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}</ul><p>Read the full description and apply on ${escapeHtml(company.name)}'s website: ${escapeHtml(job.url)}</p>`,
    identifier: { "@type": "PropertyValue", name: company.name, value: job.id.slice(0, 12) },
    datePosted: (job.postedAt ?? job.firstSeenAt).slice(0, 10),
    hiringOrganization: {
      "@type": "Organization",
      name: company.name,
      ...(company.website ? { sameAs: company.website } : {}),
    },
    jobLocation: (places.length ? places : ["Sri Lanka"]).slice(0, 5).map((p) => ({
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        ...(p !== "Sri Lanka" ? { addressLocality: p } : {}),
        addressCountry: "LK",
      },
    })),
    directApply: false,
    url: absUrl(siteUrl, jobPath(job, company.name)),
  };
  if (EMPLOYMENT[job.type]) ld.employmentType = EMPLOYMENT[job.type];
  if (remote) {
    ld.jobLocationType = "TELECOMMUTE";
    ld.applicantLocationRequirements = { "@type": "Country", name: "Sri Lanka" };
  }
  if (extra.validThrough) ld.validThrough = extra.validThrough;
  if (job.fields.length) ld.occupationalCategory = job.fields.map((f) => FIELD_LABELS[f]).join(", ");
  if (job.seniority === "intern" || job.seniority === "trainee" || job.seniority === "junior")
    ld.experienceRequirements = { "@type": "OccupationalExperienceRequirements", monthsOfExperience: 0 };
  return ld;
}

/** A list page (field, company, all jobs) as an ItemList of its job pages. */
export function jobListLd(siteUrl: string, name: string, jobs: Job[], companyName: (slug: string) => string): Ld {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: jobs.length,
    itemListElement: jobs.slice(0, 100).map((j, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: absUrl(siteUrl, jobPath(j, companyName(j.company))),
      name: `${j.title} — ${companyName(j.company)}`,
    })),
  };
}

export function faqLd(qa: [string, string][]): Ld {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: qa.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };
}

export const fieldCrumbs = (f: FieldSlug): [string, string][] => [
  ["Home", "/"],
  ["Jobs", "/jobs/"],
  [`${FIELD_LABELS[f]} jobs`, fieldPath(f)],
];
export const companyCrumbs = (slug: string, name: string): [string, string][] => [
  ["Home", "/"],
  ["Companies", "/companies/"],
  [name, companyPath(slug)],
];

/** Plain-text FAQ (for JSON-LD and llms.txt); the landing page renders its own richer version. */
export const FAQ_TEXT: [string, string][] = [
  [
    "Where do the jobs on Rekiya come from?",
    "Only from Sri Lankan companies' own career pages and official recruiting systems (such as Workday, Oracle, Lever or Teamtailor). Rekiya does not copy from job boards or recruitment agencies, so every listing comes from the employer itself.",
  ],
  [
    "How often are the vacancies updated?",
    "Every three hours. A job disappears once it has been missing from the company's page for two checks in a row, so closed vacancies don't linger.",
  ],
  ["Is Rekiya free? Do I need an account?", "Yes, it is free and there are no accounts. Saved jobs and settings stay in your own browser."],
  [
    "How do I apply for a job?",
    "Open the job and press Apply. You apply on the company's own website. Genuine employers never ask you to pay to apply.",
  ],
  [
    "Which fields are covered?",
    "Software engineering, data and AI, cloud and DevOps, cybersecurity, QA, UI/UX, digital and graphics, HR, product and project management, finance and accounting, banking and insurance, sales and marketing, hospitality and tourism, engineering and manufacturing, operations and logistics, healthcare, administration and customer service, and legal roles.",
  ],
  [
    "What does Rekiya mean?",
    "Rekiya (රැකියා) is the Sinhala word for 'jobs'. The site lists vacancies from Colombo and across Sri Lanka in English.",
  ],
];

function escapeHtml(s: string): string {
  return s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);
}

/** JSON for a <script type="application/ld+json"> tag: never lets data close the script element. */
export const ldJson = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");
