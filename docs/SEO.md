# SEO, AI search and discoverability

What the site does to rank for "jobs in Sri Lanka" searches and to be quoted by AI assistants, and the one-time
steps only the site owner can take.

## What's built in

| Area              | What Rekiya does                                                                                                                                                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Crawlable URLs    | Clean paths instead of `#/…`: `/jobs/`, `/jobs/<field>/`, `/job/<title>-at-<company>-<id>/`, `/companies/<slug>/`, `/insights/`. Old `#/` links redirect.                                                                                                                |
| Prerendered pages | Every public page is written as real HTML at build time (≈760 pages), so Google, Bing and AI crawlers that don't run JavaScript see the full content. The app takes over on load.                                                                                        |
| Google for Jobs   | Each job page has `JobPosting` structured data (title, description, date posted, employer, location, employment type, remote flag), which makes it eligible for the Google jobs panel.                                                                                   |
| Structured data   | `WebSite` with a sitelinks search box, `Organization`, `BreadcrumbList` on every inner page, `ItemList` on field and company pages, `FAQPage` on the home page.                                                                                                          |
| Titles & snippets | Unique, keyword-first titles and ≤160-character descriptions per page, e.g. "Software Engineering Jobs in Sri Lanka (56 open)". The same copy is used by the prerenderer and the live app (`src/lib/paths.ts`).                                                          |
| Index hygiene     | One canonical URL per page. Search results, filter combinations, personal pages (saved, settings) and thin pages (companies or fields with no open jobs) are `noindex` and left out of the sitemap. Closed jobs lose their page and leave the sitemap on the next crawl. |
| Sitemap & robots  | `sitemap.xml` (every indexable page with `lastmod`) and `robots.txt` pointing to it, regenerated on every deploy.                                                                                                                                                        |
| AI assistants     | `llms.txt` (what the site is, facts to quote, where things are) and `llms-full.txt` (every open job, one line each). `robots.txt` explicitly welcomes GPTBot, ClaudeBot, PerplexityBot, Google-Extended and others.                                                      |
| Freshness signals | After every deploy, new job pages and hub pages are submitted to IndexNow (Bing, Yandex, Seznam, Naver). Google picks changes up from the sitemap.                                                                                                                       |
| Social sharing    | Open Graph and Twitter cards on every page, each with its own 1200×630 preview image (see `docs/SHARE.md`).                                                                                                                                                              |
| Speed & UX        | Lighthouse mobile: 97–98 performance, 100 accessibility / best practices / SEO on the home, field and job pages. Branded boot preloader and loading bars; no layout shift.                                                                                               |

## One-time steps for the site owner

1. **Pages → Source: GitHub Actions** (Settings → Pages). Without it the old branch build can overwrite the site.
2. **Google Search Console** — add the property `https://vacancyfinder.github.io/` (URL prefix), choose "HTML tag",
   and put the `content` value in a repository variable named `GOOGLE_SITE_VERIFICATION` (Settings → Secrets and
   variables → Actions → Variables). The next deploy adds the tag; press Verify, then submit `sitemap.xml`.
3. **Bing Webmaster Tools** — import from Search Console, or use the `msvalidate.01` value as `BING_SITE_VERIFICATION`.
   Bing also powers ChatGPT search and Copilot results.
4. **Own domain (recommended)** — a `.lk` or `.com` domain ranks and gets clicked more than a `github.io` subdomain.
   Point it at GitHub Pages (Settings → Pages → Custom domain) and set the repository variable `SITE_URL`
   (e.g. `https://rekiya.lk`); canonical URLs, the sitemap, `llms.txt` and IndexNow all follow.
5. **Links from others** — rankings for competitive terms depend heavily on other sites linking to you: university
   career services, IT and professional associations, Reddit/Facebook groups for Sri Lankan job seekers, and
   the companies listed (their careers pages can link to their Rekiya page).

## What no code can promise

Search engines decide rankings from hundreds of signals, including a site's age, reputation and links from others.
Established boards (topjobs.lk, ikman.lk, xpress.jobs, LinkedIn) have years of those signals. Rekiya's edge is that it
is fresher (every 3 hours), comes straight from employers, and is technically clean. Expect Google to take weeks to
index most job pages and months to rank for broad terms. Specific searches ("QA jobs Colombo", "<company> careers")
usually rank first.
