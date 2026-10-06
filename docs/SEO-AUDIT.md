# Rekiya / VacancyFinder — SEO, Google Jobs and AI-search audit (6 Oct 2026)

Scope: https://vacancyfinder.github.io/ and the repository VacancyFinder/VacancyFinder.github.io.

**How this audit was done (and its limits).** This sandbox cannot open the live site, Google's documentation site or
competitor sites directly (its network proxy blocks them). So:

- **The site:** audited from the exact production build (`pnpm build` of `main`, 6 Oct 2026, 12:38 UTC data). Every
  deploy checks that `https://vacancyfinder.github.io/build.json` serves the build it just made, so this build is what
  the live site serves.
- **Search results and competitors:** taken from a web-search API that returns US-localised results. Treat rankings
  below as indicative, not as Sri Lankan Google SERPs.
- **Google rules:** cited from Google's documentation via search results.

In this report, **Verified** means measured in the build or data. **Recommendation** means advice.

---

## 1. Executive summary

**Verified.** The site is technically strong:

- every public page is prerendered HTML with a canonical URL, unique title and description, Open Graph tags and JSON-LD;
- Lighthouse (mobile) scores SEO 100, accessibility 100 and best practices 100, with performance 94–98 on every page
  type tested;
- jobs refresh every 3 hours, closed jobs return 404 within about 6 hours, and the robots.txt, sitemap and `llms.txt`
  files are clean.

**The single biggest limit is Google Jobs eligibility.** Google requires the JobPosting `description` to be "the full
description of the job". Rekiya deliberately keeps only an excerpt of at most 300 characters. That rule is in the
original project spec, out of fairness to employers. Today 195 of 395 open jobs have no excerpt at all, so their
`description` is a generated summary. Until full descriptions are stored, expect few or no Google Jobs appearances.
**This is a decision for you** (see §11 and P0-1); I have not changed the spec.

**Implemented in this PR** (all tested; nothing promises rankings):

- **JobPosting:** the description no longer has the "a Account Manager" grammar bug; `industry` is added;
  `experienceRequirements` is only set for intern and trainee roles; job titles and descriptions are now built from the
  listing's facts.
- **Indexing API:** support for Google's Indexing API, which Google permits for JobPosting pages. New jobs are sent as
  `URL_UPDATED` and removed jobs as `URL_DELETED`, capped to stay inside the quota. It is off until you add a key.
- **Location pages:** `/locations/<city>/` is published only when a city has at least 10 open jobs. Today that is
  Colombo only (150 jobs), so there are no thin "Jobs in Galle" pages.
- **Trust pages:**
  - `/how-it-works/` covers the source policy, freshness, the expired-vacancy policy, corrections and removal, and who
    runs the site;
  - `/privacy/` and `/terms/` are new.
- **Entity:** one consistent definition of Rekiya (VacancyFinder) is used in the WebSite and Organization schema,
  `llms.txt` and the visible copy. The retired sitelinks `SearchAction` is gone.
- **Sitemaps:** `sitemap.xml` is now an index of `sitemap-pages.xml` (71 URLs) and `sitemap-jobs.xml` (395 URLs). Search
  Console can then report indexing for jobs separately.
- **Internal links:**
  - every job page links to its city, field and internship pages;
  - list pages now have an H2 before the list;
  - company pages show hiring history ("Rekiya has listed N vacancies from X since …").
- **Bug fix:** the Internships page (merged earlier today) and the new Location page had layout shift (CLS 0.39 and
  0.61). Both are now 0.

**Realistic ranking outlook.**

- Broad terms like "jobs in Sri Lanka" are dominated by LinkedIn, topjobs.lk, ikman.lk, xpress.jobs, jobeka.lk and
  cv.lk, which have far more listings and years of links.
- Rekiya's realistic wins come first in specific searches:
  - "<company> jobs/careers";
  - "<field> jobs Sri Lanka" for IT and tech employers;
  - "internships in Sri Lanka" and "jobs in Colombo";
  - long-tail job titles.
- These grow with authority (§15) and coverage (more employers).

## 2. Current SEO score — 84 / 100 (rubric, not a Google metric)

| Area                        | Score | Why                                                                                                                                                                      |
| --------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Crawlability & indexability | 19/20 | Prerendered HTML, canonicals, noindex on private and filtered views, sitemap index, 404 for unknown and closed URLs. GitHub Pages can't send 410 or custom headers (−1). |
| On-page                     | 16/20 | Unique titles and descriptions, H1s, breadcrumbs. Job pages are thin (≈600 words of HTML, mostly navigation; excerpt only).                                              |
| Structured data             | 15/20 | JobPosting, ItemList, BreadcrumbList, Organization, WebSite. The JobPosting description is not a full description; no `validThrough` (closing dates aren't stored).      |
| Performance & UX            | 19/20 | Lighthouse mobile 94–98, CLS 0, a11y 100, mobile-first, PWA.                                                                                                             |
| Content & authority         | 15/20 | Strong freshness and provenance. Small index (395 jobs, 30 employers with jobs); new domain on github.io with few or no backlinks.                                       |

## 3. Google Jobs readiness — 40 / 100

| Requirement (Google)                                                 | Status                                                                                                                        |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Required: `title`, `datePosted`, `hiringOrganization`, `jobLocation` | ✅ all present on every job page                                                                                              |
| Required: `description` = full job description                       | ❌ Excerpt (≤300 chars) plus generated facts; 195/395 jobs have no excerpt                                                    |
| JobPosting only on single-job pages                                  | ✅ Only `/job/…` pages carry it; list pages use ItemList                                                                      |
| Expired jobs removed                                                 | ✅ Page removed (404) and dropped from the sitemap within about 6 h. With this PR, an optional `URL_DELETED` notification too |
| `validThrough`                                                       | ⚠️ Not set: closing dates are parsed for filtering but not stored                                                             |
| `employmentType`                                                     | ⚠️ Only where the listing states it (115/395)                                                                                 |
| `baseSalary`                                                         | — Not published by these employers; never invent it                                                                           |
| `directApply`                                                        | ✅ `false` (applications happen on the employer's site)                                                                       |
| Remote roles                                                         | ✅ `jobLocationType: TELECOMMUTE` + `applicantLocationRequirements` (3 jobs)                                                  |
| `identifier`, `industry`, `occupationalCategory`                     | ✅ (industry added in this PR)                                                                                                |

**Verified, data:** of 395 open jobs, 214 come from Workday (116) or Oracle HCM (98) career sites, and 139 from
employers' own HTML pages.

**Recommendation, likely and not verified:** large ATS-hosted sites often already appear in Google Jobs. Google
de-duplicates the same job, and usually prefers the employer's own posting. Rekiya's best Google Jobs opportunity is
therefore the **HTML-only employers** (John Keells, Dialog Axiata, Citizens Development Business Finance,
PickMe, NDB and similar), whose own careers pages may carry no JobPosting markup (worth checking per employer).

## 4. AI search readiness — 80 / 100

- **Verified strengths:**
  - every page is in static HTML;
  - `robots.txt` explicitly allows GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended and others;
  - `llms.txt` and `llms-full.txt` exist (one line per open job);
  - a consistent entity description, with provenance on every job page ("found on <employer>'s careers page and checked
    it was still open on <date>");
  - a public methodology page (new).
- **Gaps:**
  - no third-party corroboration of the entity yet (no Wikipedia/Wikidata entry, press or LinkedIn page);
  - the github.io domain;
  - job pages carry little unique text.

## 5. Technical SEO audit (verified unless marked)

| Item                                     | Finding                                                                                                                                                                                                                                 |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTTPS                                    | GitHub Pages, HTTPS only.                                                                                                                                                                                                               |
| robots.txt                               | Allows all; disallows `/saved/`, `/settings/`, `/onboarding/`; lists AI crawlers; points to `sitemap.xml`. Good.                                                                                                                        |
| Sitemaps                                 | Index → pages (71) + jobs (395) with `lastmod` (job = first-seen date, hubs = latest sync). Only indexable URLs.                                                                                                                        |
| Canonicals                               | Self-referencing, absolute, trailing slash, on every indexable page. Filtered views (`/jobs/?…`) are `noindex, follow`, with no canonical tags pointing to filters.                                                                     |
| Redirects                                | Legacy `#/` links → clean URLs (client-side). Server redirects aren't possible on GitHub Pages; avoid moving URLs.                                                                                                                      |
| 404                                      | `404.html` (noindex) for unknown and closed job URLs. GitHub Pages can't send 410, but Google treats 404 and 410 the same for removal.                                                                                                  |
| JS rendering                             | Not required: content, links and JSON-LD are in the HTML; React takes over afterwards.                                                                                                                                                  |
| Pagination                               | `/jobs/` lists the 200 newest in HTML, and every job is in `sitemap-jobs.xml` and linked from its field, company or city page. No `?page=` URLs to index.                                                                               |
| Faceted navigation                       | One indexable URL per field, city and company. Parameter combinations are noindex and not in the sitemap.                                                                                                                               |
| Core Web Vitals (lab, Lighthouse mobile) | Home 98 (LCP 1.7 s, CLS 0.01); job 95 (LCP 2.9 s); field 98; company 95; Colombo 94; internships 98; how-it-works 98.                                                                                                                   |
| Accessibility / semantics                | Lighthouse a11y 100; landmarks, skip link, breadcrumbs; H1 → H2 → H3 order fixed on list pages in this PR.                                                                                                                              |
| Images                                   | Only OG preview PNGs (~70 KB each) and SVG icons; no content images to optimise.                                                                                                                                                        |
| Pages source                             | ⚠️ Settings → Pages is still "Deploy from a branch". The workflow redeploys after every push so the app wins, but switch it to **GitHub Actions** (owner-only setting).                                                                 |
| `/about/`                                | ⚠️ The prerendered About page is unique, but the app renders the home page component at `/about/`, and it is excluded from the sitemap. Recommendation P1-4: give `/about/` its own app page, or redirect its link to `/how-it-works/`. |

## 6. Page-by-page audit (production build, 6 Oct 2026)

| Page type (example)                        | Title                                                                         | H1 / H2                                                                                                | Schema                            | Notes                                                                                                                          |
| ------------------------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Home `/`                                   | Jobs in Sri Lanka — 395 Latest Vacancies Updated Every 3 Hours \| Rekiya (71) | H1 "Latest job vacancies in Sri Lanka"; H2 latest jobs, fields, internships & locations, top companies | WebSite, Organization, FAQPage    | ~1,270 words in HTML; 24 newest jobs; intro now states "Fresh Sri Lankan job vacancies from employers' official career pages". |
| All jobs `/jobs/`                          | All Job Vacancies in Sri Lanka (395 open) \| Rekiya                           | H1 + H2 "Newest vacancies"                                                                             | BreadcrumbList, ItemList (100)    | 200 newest in HTML.                                                                                                            |
| Field `/jobs/software-engineering/`        | Software Engineering Jobs in Sri Lanka (54 open) \| Rekiya                    | H1 + H2 "Open … vacancies", "Related fields"                                                           | BreadcrumbList, ItemList          | RSS alternate link; noindex when empty.                                                                                        |
| Job `/job/intern-database-at-fortude-…/`   | Intern - Database at Fortude — Job in Colombo \| Rekiya                       | H1 title; H2 about the role, details, more at company, similar                                         | JobPosting, BreadcrumbList        | ~600 words, mostly lists; links to city, field, internships (new).                                                             |
| Company `/companies/sysco-labs/`           | Sysco LABS Jobs & Careers in Sri Lanka (86 open) \| Rekiya                    | H1 + H2 "Open vacancies at …"                                                                          | BreadcrumbList, ItemList          | Hiring-history line (new); careers-page link.                                                                                  |
| City `/locations/colombo/` (new)           | Jobs in Colombo — 150 Latest Vacancies \| Rekiya                              | H1 + H2 list, fields, employers                                                                        | BreadcrumbList, ItemList          | Only cities with ≥10 jobs.                                                                                                     |
| Internships `/internships/`                | Internships in Sri Lanka 2026 — 49 Open Internships & Trainee Jobs \| Rekiya  | H1 + H2 list, fields                                                                                   | BreadcrumbList, ItemList, FAQPage | CLS fixed in this PR.                                                                                                          |
| How it works `/how-it-works/` (new)        | How Rekiya Works — Sources, Updates and Removal Policy \| Rekiya              | H1 + 6 H2                                                                                              | BreadcrumbList                    | Methodology, source and removal policy.                                                                                        |
| Companies, Insights, About, Privacy, Terms | Unique titles and descriptions                                                | H1s                                                                                                    | Breadcrumb where relevant         | Insights has no schema; fine.                                                                                                  |
| Saved, Settings, Onboarding, Status, 404   | —                                                                             | —                                                                                                      | —                                 | `noindex, follow`; first three are also disallowed in robots.txt.                                                              |

All indexable pages have:

- **Open Graph:** og:title, og:description, og:url and a page-specific 1200×630 og:image;
- **Twitter/X:** `summary_large_image`.

## 7. Competitor analysis (indicative — see limits above)

| Site                                               | What ranks                                                                                                     | Strength                                                                                               | Where Rekiya can do better                                                                                      |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| LinkedIn Jobs                                      | `/jobs/jobs-in-sri-lanka`, `/jobs/colombo-jobs`, title pages                                                   | Authority, volume ("1,000+ jobs")                                                                      | Freshness from source, no login wall, Sri Lanka-only focus                                                      |
| topjobs.lk                                         | Home and functional-area listings                                                                              | Brand, 30 functional areas, employer-paid ads; ads are often image/PDF artwork with session-style URLs | Text-based, crawlable job pages with clean URLs and JobPosting data                                             |
| ikman.lk Jobs                                      | `/en/ads/sri-lanka/jobs`, `/en/ads/colombo/jobs`                                                               | Huge volume (≈9,700, ≈4,400 in Colombo), location pages                                                | Quality: only verified employer listings, no classified-ad noise                                                |
| xpress.jobs, jobeka.lk, cv.lk, jobber.lk, itpro.lk | Category, district and company pages (e.g. jobber `/organization/wso2-…`, itpro `/jobs/software-engineering/`) | Category depth; some niche (IT)                                                                        | Company pages tied to the official careers page with hiring history; internship and tech focus                  |
| Employer career sites (e.g. wso2.com/careers)      | Rank #1 for "<company> careers"                                                                                | Official                                                                                               | Don't compete on the brand query; rank for "<company> jobs Sri Lanka" and job-title long tail, and link to them |

**Key insight.** Competitors win on volume and age. Rekiya's defensible differences are:

1. listings verified against the employer's own page every 3 hours;
2. clean, crawlable job pages, where several local boards use images or session URLs;
3. per-company hiring data.

Grow coverage, meaning more employers in `data/companies.json`. Pages per job are what create long-tail entry points.

## 8. Keyword strategy

| Cluster                                                                                 | Target page                             | Status                                                                                                     |
| --------------------------------------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| jobs in Sri Lanka / latest vacancies / Sri Lanka job vacancies                          | `/` and `/jobs/`                        | live                                                                                                       |
| <field> jobs Sri Lanka (IT, software, accounting, marketing, banking, engineering, HR…) | `/jobs/<field>/` (19 fields)            | live                                                                                                       |
| jobs in Colombo                                                                         | `/locations/colombo/`                   | **new**                                                                                                    |
| jobs in <other city>                                                                    | `/locations/<city>/`                    | auto-published at ≥10 jobs                                                                                 |
| internships / trainee / graduate jobs Sri Lanka                                         | `/internships/` (+ graduate guide, §14) | live                                                                                                       |
| <company> jobs / careers Sri Lanka                                                      | `/companies/<slug>/`                    | live (296 companies; noindex when 0 open)                                                                  |
| <job title> <company>                                                                   | `/job/<title>-at-<company>-<id>/`       | live (395)                                                                                                 |
| government jobs, nursing, part-time, remote                                             | —                                       | **Don't target yet.** No government sources; healthcare 1 job; part-time 0; remote 3. Pages would be thin. |

## 9. Site architecture

```
/                                   home (latest jobs, fields, internships, cities, top companies)
├── /jobs/                          all jobs (newest 200 in HTML)
│   ├── /jobs/<field>/              19 field hubs (noindex when empty)
│   └── /jobs/?…                    filtered views: noindex, follow, not in sitemap
├── /internships/                   internship & trainee hub
├── /locations/<city>/              city hubs, only when ≥10 open jobs
├── /companies/                     directory (296)
│   └── /companies/<slug>/          employer hubs (noindex when 0 open)
├── /job/<title>-at-<company>-<id>/ one page per open job (JobPosting); 404 once closed
├── /insights/                      market statistics
├── /how-it-works/ /about/ /privacy/ /terms/   trust pages
└── /saved/ /settings/ /onboarding/ /status/  noindex (app pages)
```

- **Why `/locations/<city>/` and not `/jobs/colombo/`:** `/jobs/<x>/` is reserved for fields, so a city with the same
  name as a field can never collide. URL wording carries little ranking weight; the title and H1 say "Jobs in Colombo".
- **Doorway and thin-page protection:**
  - city and field pages are generated only above a job threshold, or set to noindex when empty;
  - no keyword-permutation pages (e.g. "IT jobs in Kandy") until there's real inventory;
  - every hub lists real jobs and links to them.

## 10. Structured data strategy

| Page                                        | Schema                                                                                                                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Home                                        | WebSite (name, alternateName incl. VacancyFinder, description) + Organization (Rekiya, alternateName VacancyFinder, logo, description, areaServed LK, sameAs GitHub) + FAQPage |
| Job                                         | JobPosting + BreadcrumbList                                                                                                                                                    |
| Field, company, city, internships, all jobs | ItemList (job URLs) + BreadcrumbList                                                                                                                                           |
| Trust pages                                 | BreadcrumbList                                                                                                                                                                 |

Notes:

- **FAQPage:** FAQ rich results no longer show in Google Search; they were limited in 2023 and discontinued in 2026.
  The FAQ stays because it is visible content that answer engines read, not for a rich result.
- **No CollectionPage wrapper:** ItemList and BreadcrumbList already describe these pages; adding CollectionPage gives
  no Google feature.
- **Never** add ratings, reviews or salaries that the employer didn't publish.

Example JobPosting as generated now (`src/lib/structured-data.ts → jobPostingLd`):

```json
{
  "@context": "https://schema.org",
  "@type": "JobPosting",
  "title": "Intern - Database",
  "description": "<p>Primary Job Role As a Database intern you will contribute to …</p><ul><li>Experience level: Intern</li><li>Location: Colombo</li><li>Field: …</li></ul><p>Read the full description and apply on Fortude's website: https://…</p>",
  "identifier": { "@type": "PropertyValue", "name": "Fortude", "value": "09f07ea8305c" },
  "datePosted": "2026-10-06",
  "hiringOrganization": { "@type": "Organization", "name": "Fortude", "sameAs": "https://fortude.co" },
  "jobLocation": [{ "@type": "Place", "address": { "@type": "PostalAddress", "addressLocality": "Colombo", "addressCountry": "LK" } }],
  "directApply": false,
  "url": "https://vacancyfinder.github.io/job/intern-database-at-fortude-09f07ea8305c/",
  "occupationalCategory": "…",
  "industry": "Technology",
  "experienceRequirements": { "@type": "OccupationalExperienceRequirements", "monthsOfExperience": 0 }
}
```

## 11. Indexing strategy

- **New jobs:**
  - each new job gets a page and enters `sitemap-jobs.xml` the same day (`lastmod` = first seen);
  - it is linked from home (if among the 24 newest), `/jobs/`, its field, company and city pages, and internships if
    relevant;
  - it is sent to IndexNow (Bing, Yandex and others) and, once you add the key, to the Google Indexing API as
    `URL_UPDATED`.
- **Updated jobs:** the job ID is stable, so the URL doesn't change.
- **Closed jobs:**
  - missing on two consecutive checks → closed;
  - the page is deleted (GitHub Pages returns 404) and dropped from the sitemap;
  - Google Indexing API `URL_DELETED` (optional).
  - Google accepts all three ways to expire a posting: 404/410, `validThrough` in the past, or removing the markup.
    `noindex` is not one of them.
- **Duplicates:**
  - one ID per source listing URL, so the same listing never gets two Rekiya pages;
  - the crawler doesn't merge the same role posted at two URLs (for example by a group and a subsidiary); add title +
    company matching if that becomes common;
  - cross-site duplicates are de-duplicated by Google.
- **Reopened jobs:** the same ID returns to open, the page reappears and is notified as `URL_UPDATED`.
- **Indexing API rules:**
  - JobPosting and livestream pages only;
  - the default quota is 200 requests a day per project;
  - multiple accounts to get around the quota are prohibited;
  - the service account must be an **owner** of the Search Console property;
  - the script sends at most 24 per sync (8 syncs a day = 192), removals first.

## 12. Automatic vacancy update strategy (implemented)

```
every 3 h → crawl (polite, robots.txt) → validate → diff vs previous data
  new job  → job page + JobPosting → hubs (field/company/city/internships) → sitemap-jobs.xml
           → deploy → live check → IndexNow + Google Indexing API URL_UPDATED
  closed   → (missing 2 checks) → page removed (404) → sitemaps/hubs drop it
           → Google Indexing API URL_DELETED
  failed   → previous data kept, nothing published, retry in 45 min
```

## 13. Internal linking

```
Home ─┬─► /jobs/ ─► field hubs ─► job pages ─► (company · city · field · internships hubs)
      ├─► field hubs, /internships/, /locations/colombo/ (new section)
      └─► top company hubs ─► job pages
Job page ─► "More jobs at <Company>" (5) · "Similar jobs in Sri Lanka" (5) · "Browse more: Jobs in Colombo ·
            Software Engineering jobs in Sri Lanka · Internships in Sri Lanka" (new)
Footer (every page) ─► All jobs · Internships in Sri Lanka · Jobs in Colombo · Companies · Insights · How Rekiya works
```

**Anchor text:**

- use descriptive anchors such as "Software Engineering jobs in Sri Lanka", "Jobs in Colombo", "Sysco LABS jobs &
  careers" and "Internships in Sri Lanka";
- never use "click here";
- avoid repeating exact-match anchors many times on one page.

## 14. Content strategy

Only pages Rekiya can make genuinely useful. Write them by hand, with data from Rekiya's own crawl wherever possible.

| Page                                                       | Target query                          | Intent        | H1                                               | Outline                                                                                    | Links to                    | Schema                                           | Index                    |
| ---------------------------------------------------------- | ------------------------------------- | ------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------ | --------------------------- | ------------------------------------------------ | ------------------------ |
| **Monthly Sri Lanka hiring report** (`/insights/2026-10/`) | Sri Lanka job market October 2026     | Informational | Who's hiring in Sri Lanka — October 2026         | New vacancies by field and company, internships, trends vs last month, method note         | Field and company hubs      | Article + Dataset (only if the CSV is published) | Yes                      |
| **Internship guide**                                       | how to get an internship in Sri Lanka | Informational | How to find an internship in Sri Lanka           | When companies hire interns (from our data), where to look, CV tips, live internships list | `/internships/`, field hubs | Article                                          | Yes                      |
| **Graduate jobs**                                          | jobs for fresh graduates Sri Lanka    | Transactional | Graduate and entry-level jobs in Sri Lanka       | Live list (intern, trainee, junior), employers with graduate programmes                    | `/internships/`, companies  | ItemList + Breadcrumb                            | Yes, when ≥10 jobs       |
| **Sri Lankan CV guide**                                    | how to write a CV Sri Lanka           | Informational | How to write a CV for Sri Lankan employers       | Format, what local employers ask for, templates                                            | `/jobs/`                    | Article                                          | Yes                      |
| **Interview preparation**                                  | interview tips Sri Lanka              | Informational | Preparing for interviews at Sri Lankan companies | Process at large employers (public info only), common questions                            | Company hubs                | Article                                          | Yes                      |
| **Avoiding job scams**                                     | fake job offers Sri Lanka             | Informational | How to spot a fake job offer in Sri Lanka        | Red flags, "never pay to apply", reporting                                                 | `/how-it-works/`            | Article                                          | Yes                      |
| Salary guides                                              | salary <role> Sri Lanka               | —             | —                                                | Only if reliable published data exists; employers here rarely publish salaries             | —                           | —                                                | **No** until data exists |

**Don't** mass-produce "<role> jobs in <city>" pages or AI-written articles without unique data.

## 15. Authority and backlink strategy (earned links only)

1. **Universities and career guidance units:** Moratuwa, Colombo, Kelaniya, Sri Jayewardenepura, Peradeniya, SLIIT,
   IIT, NSBM, APIIT, KDU. Offer the `/internships/` page and field RSS feeds as a free resource for their careers pages
   and student newsletters.
2. **Professional bodies:**
   - IT: CSSL (Computer Society of Sri Lanka), SLASSCOM;
   - engineering: IESL;
   - accounting: CA Sri Lanka, CIMA Sri Lanka, AAT Sri Lanka;
   - HR: CIPM.
     Offer field-specific feeds and the monthly hiring report.
3. **Employers:** tell each listed company it has a hiring page. Offer an optional "See our open roles on Rekiya" link
   or badge; companies often link from their careers page.
4. **Data journalism:** pitch the monthly hiring report (unique, dated data) to Daily FT, EconomyNext, ReadMe.lk,
   Roar Media and the Sunday Times business section.
5. **Communities:** student unions, Facebook and LinkedIn groups and Reddit (r/srilanka). Share the internships page
   and the WhatsApp preview cards; no spamming.
6. **Open data:** list the public repository and `jobs.json` on open-data and developer directories (GitHub topics,
   awesome-lists).

**Never:** paid links, PBNs, link exchanges or automated directory submissions.

## 16. Exact code changes

### Implemented in this PR

| #   | File                                                                                                                                                | Before                                                                                  | After                                                                                               | Why                                            | Impact                | Priority |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------- | --------------------- | -------- |
| 1   | `apps/web/src/lib/structured-data.ts` (`jobPostingLd`)                                                                                              | "…is hiring a Account Manager…"; `monthsOfExperience: 0` also for junior; no `industry` | a/an grammar; `industry`; 0 months only for intern/trainee                                          | Accurate, valid JobPosting                     | Google Jobs quality   | P0       |
| 2   | same (`websiteLd`, `organizationLd`, `ENTITY_DESCRIPTION`)                                                                                          | SearchAction (retired 2024); no alternateName on Organization                           | Single entity description; alternateName "VacancyFinder"                                            | Site-name and entity clarity for Google and AI | Brand SERP, AI        | P1       |
| 3   | `apps/web/src/lib/paths.ts` (`JOB_META`)                                                                                                            | "Account Manager — WSO2, Sri Lanka \| Rekiya"; generic description                      | "Account Manager at WSO2 — Job in Sri Lanka \| Rekiya"; facts-based description (type, level, date) | Matches "<title> job" queries; better snippets | CTR                   | P1       |
| 4   | `apps/web/build/seo.ts` (`googleIndexingUrls`, `generateSeo`), `scripts/google-indexing.mjs`, `.github/workflows/crawl-and-deploy.yml`              | No Indexing API                                                                         | URL_UPDATED/URL_DELETED per sync after the live check; off without the secret                       | Faster job indexing and removal                | Google Jobs freshness | P1       |
| 5   | `apps/web/src/lib/paths.ts` (`PLACES`, `placeSlugsOf`, `LOCATION_MIN_JOBS`), `apps/web/build/seo.ts`, `apps/web/src/pages/Location.tsx`, `main.tsx` | No location pages                                                                       | `/locations/<city>/` at ≥10 jobs (Colombo now)                                                      | "jobs in Colombo"                              | New ranking page      | P1       |
| 6   | `apps/web/src/lib/policies.ts`, `apps/web/src/pages/Policy.tsx`, `apps/web/build/seo.ts`                                                            | No methodology, privacy or terms pages                                                  | `/how-it-works/`, `/privacy/`, `/terms/`                                                            | Trust and E-E-A-T, AI provenance               | Trust                 | P1       |
| 7   | `apps/web/build/seo.ts` (`sitemapIndexXml`, `SITEMAPS`)                                                                                             | One `sitemap.xml`                                                                       | Index → `sitemap-pages.xml` + `sitemap-jobs.xml`                                                    | Per-type indexing reports in GSC               | Monitoring            | P1       |
| 8   | `apps/web/build/seo.ts` (`browseMore`, `history`, H2s)                                                                                              | Job pages linked only to company and similar jobs; list pages jumped H1→H3              | Links to city, field, internships; H2 before lists; company hiring history                          | Internal links to hubs; unique company content | Rankings of hubs      | P1       |
| 9   | `apps/web/src/pages/Internships.tsx`, `Location.tsx`, `Policy.tsx`, `components/Breadcrumbs.tsx`                                                    | App markup differed from the prerender → CLS 0.39/0.61                                  | Same markup as the prerender                                                                        | Core Web Vitals                                | Page experience       | P0       |
| 10  | `apps/web/src/pages/Landing.tsx`, `build/seo.ts` (home)                                                                                             | "Every open job from the career pages…"                                                 | "Fresh Sri Lankan job vacancies from employers' official career pages…"                             | Clear positioning                              | Entity, CTR           | P2       |

### Proposed, needs your decision — P0-1: full job descriptions for Google Jobs

- **Current:** `snippet` ≤ 300 characters, per the project spec ("keep only a short excerpt"); 195/395 jobs have none.
- **Problem:** Google requires the full description, so job pages are thin and largely ineligible for Google Jobs.
- **Option A (recommended):** store the full description only where the employer publishes it in a machine-readable
  feed meant for distribution (Workday, Oracle, Lever and SuccessFactors JSON APIs, and employers' own JobPosting
  JSON-LD). Show it on the job page with clear attribution ("Description from <Employer>'s careers page") and the
  Apply link. Keep excerpts for HTML-scraped pages.
- **Option B:** keep the current policy and accept limited Google Jobs visibility.
- **Change needed for Option A (a data-schema change, so it needs your go-ahead):**
  1. Add `description?: string` (sanitised HTML: `p`, `ul`, `li`, `br`, `strong` only; max ~10 KB) to `JobSchema` in
     `packages/shared/src/schemas.ts`.
  2. Populate it in the Workday, Oracle and JSON-LD adapters (they already fetch it).
  3. Render it in `apps/web/build/seo.ts` (job body) and `src/pages/JobDetail.tsx`.
  4. In `jobPostingLd`, use it for `description` when present.
  5. Store the closing date as `validThrough` when the source gives one.

### Other recommendations (not implemented)

- **P1-4 `/about/`:** give it its own app page, then add it to the sitemap. Today the app shows the home page at
  `/about/`.
- **P2:** a custom domain (e.g. `rekiya.lk`). Set the `SITE_URL` repo variable and Pages → Custom domain. Every
  canonical, sitemap entry and the IndexNow host follow automatically. Keep the github.io URLs redirecting, which
  GitHub Pages does for custom domains.

## 17. Google Search Console plan

- **Day 1:**
  1. Verify (the tag is live).
  2. Submit `https://vacancyfinder.github.io/sitemap.xml` (the index).
  3. Use URL Inspection → Request indexing for `/`, `/jobs/`, `/internships/`, `/locations/colombo/` and the top 5 field
     pages.
- **Optional, for the Indexing API:**
  1. Create a Google Cloud project and enable the **Web Search Indexing API**.
  2. Create a service account and JSON key.
  3. In GSC → Settings → Users and permissions, add the service-account email as an **Owner**.
  4. Add the GitHub secret `GOOGLE_INDEXING_KEY` (the JSON).
- **Weekly checklist:**
  - Page indexing:
    - filter by sitemap (`sitemap-jobs.xml` vs `sitemap-pages.xml`);
    - watch "Crawled – currently not indexed" and "Duplicate" for job pages;
    - "Not found (404)" is expected for closed jobs.
  - Enhancements → **Job postings:** errors and warnings (e.g. missing `validThrough` or `baseSalary` warnings are
    expected; errors are not).
  - Core Web Vitals: should stay "Good" (lab CLS 0; LCP < 3 s).
  - Manual actions and Security issues: should show none.
  - Crawl stats: response time, 404 rate (spikes after big closures are normal).
  - Performance: queries by page group (regex `/job/`, `/jobs/`, `/companies/`, `/locations/`, `/internships/`). Find
    pages with high impressions and CTR under 2%, then review their title and description.
- **Monthly:** compare clicks per page group, top new queries, and branded vs non-branded queries.

## 18. 30-day plan

| Week | Do                                                                                                                                                          |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Merge this PR. In GSC: verify, submit sitemap index, request indexing for the hubs. Switch Pages source to GitHub Actions. Decide P0-1 (full descriptions). |
| 2    | (If yes) implement full descriptions for ATS sources and `validThrough`. Set up the Indexing API key. Add 20–30 more employers' careers pages.              |
| 3    | First monthly hiring report (`/insights/2026-10/`). Contact 5 university career units and 3 professional bodies.                                            |
| 4    | Review GSC (indexing per sitemap, Job postings report, queries). Fix title/description CTR outliers. Publish the internship guide.                          |

## 19. 90-day plan

- **Coverage:** grow to 100+ employers with open jobs (more CSE companies, banks, hospitals, BPOs). More cities will
  pass the 10-job threshold automatically.
- **Content:**
  - monthly report;
  - graduate jobs page once it has inventory;
  - CV, interview and job-scam guides.
- **Authority:**
  - 10+ earned links from universities, associations and employers;
  - one press mention from the hiring report.
- **Domain:** move to a custom domain early (before authority builds on github.io).

## 20. Long-term strategy

Be the most trustworthy, freshest source of verified Sri Lankan vacancies, and the reference dataset for the Sri
Lankan job market:

- **Coverage:** keep growing the employer list.
- **Unique data:** hiring trends per company and field.
- **Provenance:** every job verified against its source every 3 hours.
- **Clean technical foundation:** already in place.

Rankings for head terms follow coverage and links, which takes months, not weeks. Track progress in GSC by page group,
not by one keyword.

### Sources

- Google — [JobPosting structured data](https://developers.google.com/search/docs/appearance/structured-data/job-posting)
  (required properties, full description, removing expired postings)
- Google — [Indexing API quota and approval](https://developers.google.com/search/apis/indexing-api/v3/quota-pricing),
  [Using the Indexing API](https://developers.google.com/search/apis/indexing-api/v3/using-api)
- Google Search Central blog — [Farewell, sitelinks search box (Oct 2024)](https://developers.google.com/search/blog/2024/10/sitelinks-search-box)
- Search Engine Land — [manual actions for expired job listings](https://searchengineland.com/google-may-issue-manual-actions-over-job-schema-on-expired-job-listings-296376)
- Search Engine Journal — [Google drops FAQ rich results](https://www.searchenginejournal.com/google-drops-faq-rich-results-from-search/574429/)
- Search results reviewed for competitor positions: [LinkedIn Jobs in Sri Lanka](https://www.linkedin.com/jobs/jobs-in-sri-lanka),
  [topjobs.lk](https://www.topjobs.lk/), [ikman.lk jobs](https://ikman.lk/en/ads/sri-lanka/jobs),
  [xpress.jobs](https://xpress.jobs/), [jobeka.lk Colombo](https://jobeka.lk/browse/district/Colombo),
  [jobber.lk WSO2](https://jobber.lk/organization/wso2-colombo-03-jobs-in-sri-lanka),
  [itpro.lk software engineering](https://itpro.lk/jobs/software-engineering/)
