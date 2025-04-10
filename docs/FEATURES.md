# Rekiya features

What a job seeker in Sri Lanka needs from a job site, and where Rekiya stands. ✅ = shipped, 🔜 = planned (with the reason it
isn't in yet).

## Must-have

| Feature                                                                                                     | Status | Where                            |
| ----------------------------------------------------------------------------------------------------------- | ------ | -------------------------------- |
| Real vacancies from employers' own career pages, refreshed every 3 hours                                    | ✅     | crawler + `crawl-and-deploy.yml` |
| Closed jobs disappear automatically (two missed checks)                                                     | ✅     | pipeline                         |
| Fast, typo-tolerant search (title, skill, company, location)                                                | ✅     | Jobs                             |
| Filters: field, experience level, work mode, job type, location, company, industry, CSE-listed, date posted | ✅     | Jobs → Filters                   |
| One-tap quick filters (this week, remote, hybrid, entry level, internships, senior & lead, CSE-listed)      | ✅     | Jobs                             |
| Removable chips for every active filter, "Clear all"                                                        | ✅     | Jobs                             |
| Sort: best match, newest, date posted, company A–Z                                                          | ✅     | Jobs                             |
| Shareable URLs for every search and every job                                                               | ✅     | everywhere                       |
| Job detail page: facts, excerpt, big Apply button to the original listing                                   | ✅     | `#/job/:id`                      |
| Clear "no longer listed" page for closed jobs                                                               | ✅     | Job detail                       |
| Save jobs                                                                                                   | ✅     | bookmark on every card           |
| Personalised feed from chosen fields and level (onboarding)                                                 | ✅     | Onboarding / Settings            |
| "New since your last visit" badges and count                                                                | ✅     | Jobs                             |
| Company directory with tracking status, and company pages                                                   | ✅     | Companies                        |
| Mobile-first layout, bottom navigation, full-screen filter sheet                                            | ✅     | all pages                        |
| Accessible (WCAG 2.1 AA checked with axe in light and dark mode, keyboard, screen readers)                  | ✅     | CI e2e                           |
| Dark mode                                                                                                   | ✅     | Settings                         |
| Loading placeholders, error recovery, offline support                                                       | ✅     | all pages                        |
| Safety: never handles applications; "never pay to apply" notice                                             | ✅     | Job detail                       |

## Nice-to-have

| Feature                                                                                | Status | Where                                                                                                            |
| -------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------- |
| Application tracker (Saved → Applied → Interviewing → Offer / Not selected) with notes | ✅     | Saved, Job detail                                                                                                |
| Export applications as CSV                                                             | ✅     | Saved                                                                                                            |
| Saved searches with "N new" counts                                                     | ✅     | Jobs → Save search, Saved                                                                                        |
| Hide a job or a whole company ("Not interested"), with Undo                            | ✅     | cards, Company, Settings                                                                                         |
| Undo for every destructive action (toasts)                                             | ✅     | everywhere                                                                                                       |
| Recently viewed jobs; viewed jobs marked in lists                                      | ✅     | Saved, cards                                                                                                     |
| Similar jobs and more jobs at the same company                                         | ✅     | Job detail                                                                                                       |
| Share a job (native share sheet or copy link)                                          | ✅     | Job detail                                                                                                       |
| Report a problem with a listing (pre-filled GitHub issue)                              | ✅     | Job detail                                                                                                       |
| Job market insights: jobs by field, level, work mode, type, industry, top employers    | ✅     | Insights                                                                                                         |
| Backup / restore / clear all personal data (no accounts needed)                        | ✅     | Settings                                                                                                         |
| RSS feed per field                                                                     | ✅     | Jobs, Settings                                                                                                   |
| Installable app (PWA) with update prompt                                               | ✅     | Settings, landing                                                                                                |
| Keyboard shortcut: `/` to search                                                       | ✅     | everywhere                                                                                                       |
| Company suggestions via an issue form → draft PR                                       | ✅     | footer, Companies                                                                                                |
| Push / email alerts                                                                    | 🔜     | Needs a backend or paid service; the spec asks to decide this first. RSS + saved-search counts cover it for now. |
| Sinhala and Tamil interface                                                            | 🔜     | Needs reviewed translations, not machine output.                                                                 |
| Salary and closing date on cards                                                       | 🔜     | Most career pages don't publish salaries; closing dates need a data-schema change (spec: ask first).             |
| Job boards (topjobs.lk, LinkedIn, rooster.jobs)                                        | 🔜     | Phase-2 decision in the spec — employers' own pages only in v1.                                                  |
| Company logos                                                                          | 🔜     | Opt-in only per the spec (trademark); initials badges are used instead.                                          |
