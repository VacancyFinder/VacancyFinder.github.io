# Sharing Rekiya (WhatsApp and social)

## Link previews

Every public page has its own 1200×630 preview card, generated at build time (`apps/web/build/og.ts`) and
referenced from the page's `og:image` / `twitter:image` tags:

| Page             | Card                                                                     |
| ---------------- | ------------------------------------------------------------------------ |
| Home             | "Latest job vacancies in Sri Lanka" with open jobs, companies and fields |
| `/jobs/<field>/` | "<Field> jobs", open count and top hiring companies                      |
| `/job/<…>/`      | Job title, company badge, company · location, level / work mode / type   |
| `/companies/<…>` | Company name and badge, open jobs, fields it hires in                    |
| `/insights/`     | Market snapshot with the busiest fields                                  |

Cards are flat PNGs of about 70 KB, well under WhatsApp's ~300 KB limit, so WhatsApp shows the large preview.
Private pages (saved, settings) and filtered searches use the site-wide `og-image.png`.

**WhatsApp caches previews.** If a link was shared before the image changed, add a harmless query string to
force a fresh preview, e.g. `https://vacancyfinder.github.io/?v=2`. The Facebook Sharing Debugger
(developers.facebook.com/tools/debug) also refreshes the cache for WhatsApp.

## Share buttons in the app

- **Job page → WhatsApp**: opens WhatsApp with the job title, company, location, level and the link.
- **Home page → "Know someone looking for a job?"**: share Rekiya on WhatsApp or copy the introduction message.
- **Footer → Share Rekiya on WhatsApp** on every page.

The messages are built in `apps/web/src/lib/share.ts`, and the live job and company counts fill in automatically.

## Introduction messages

Use these when posting Rekiya in WhatsApp groups, LinkedIn, Facebook groups or university career channels.
Keep the link on its own last line so the preview card appears.

### Short (WhatsApp / chats)

```
*Rekiya: the latest job vacancies in Sri Lanka*

Rekiya brings together openings from the official career pages of Sri Lankan companies, so you can search them all in one place.

• Open jobs from leading Sri Lankan employers
• Updated every 3 hours
• Search by field, company, level or work mode
• Free, with no sign-up. You apply directly with the employer

https://vacancyfinder.github.io/
```

### One line (status, bios, comments)

```
Every open job from Sri Lankan companies' own career pages, in one search, updated every 3 hours: https://vacancyfinder.github.io/
```

### Long (LinkedIn, Facebook groups, email)

```
Looking for a job in Sri Lanka? Meet Rekiya.

Rekiya checks the official career pages of Sri Lankan employers, including every company listed on the Colombo Stock Exchange and the country's leading technology firms, and puts their open vacancies in one searchable place.

What makes it different:
• Straight from the source: every listing links to the employer's own careers page, so you apply directly
• Always current: jobs are refreshed every 3 hours and closed roles are removed automatically
• Easy to narrow down: filter by field, company, experience level, remote or hybrid work and date posted
• Free and private: no account, no ads, and your saved jobs stay on your device

Search today's openings: https://vacancyfinder.github.io/

Please share it with anyone who is job hunting.
```

### Sharing a single job

The job page's WhatsApp button writes this automatically, for example:

```
*Senior QA Engineer*
Acme PLC · Colombo
Senior · Hybrid · Full-time

Found on Rekiya. Apply directly on the company's official careers page:
https://vacancyfinder.github.io/job/senior-qa-engineer-at-acme-plc-3f2a9c1b7d4e/
```
