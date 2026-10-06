/**
 * Trust pages — how Rekiya works, privacy, terms. Plain data shared by the prerenderer (crawlers, AI assistants)
 * and the app, so both always say the same thing. Keep every statement true to how the code actually behaves.
 */
import { SITE_NAME } from "./paths";

/** Mirrors CLOSE_AFTER_MISSED_RUNS (= 2) in packages/crawler/src/pipeline/diff.ts. */
const CLOSE_AFTER_TEXT =
  "A vacancy is marked closed once it has been missing from the employer's page on two checks in a row (about 6 hours).";

export const REPO = "https://github.com/VacancyFinder/VacancyFinder.github.io";
export const REPORT_URL = `${REPO}/issues/new`;

export interface PolicySection {
  heading: string;
  /** Paragraphs; a string starting with "• " is rendered as a list item. */
  body: string[];
}

export interface PolicyPage {
  path: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  sections: PolicySection[];
}

export const HOW_IT_WORKS: PolicyPage = {
  path: "/how-it-works/",
  title: `How Rekiya Works — Sources, Updates and Removal Policy | ${SITE_NAME}`,
  description:
    "Where Rekiya's Sri Lankan job vacancies come from, how often they're checked, how closed jobs are removed and how employers can correct or remove a listing.",
  h1: "How Rekiya works",
  intro:
    "Rekiya (VacancyFinder) is a free Sri Lankan job search site. It collects open vacancies from employers' official career pages and sends you to the employer's own listing to apply. This page explains exactly where the jobs come from and how they are kept up to date.",
  sections: [
    {
      heading: "Where the vacancies come from",
      body: [
        "Only from employers' own career pages and the official recruiting systems those employers use (for example Workday, Oracle, SAP SuccessFactors, Lever, Teamtailor and PeoplesHR).",
        "The list of employers covers companies on the Colombo Stock Exchange and leading Sri Lankan technology firms. Anyone can suggest another employer's careers page; a maintainer checks each suggestion before it is added.",
        "Rekiya does not copy listings from job boards, newspapers, social media or recruitment agencies, and it does not accept paid or sponsored job posts.",
      ],
    },
    {
      heading: "How often they are checked",
      body: [
        "Every career page is checked every 3 hours. The time of the last check is shown on every page and on the system status page.",
        "Rekiya respects each site's robots.txt, sends at most one request at a time to any one site and waits between requests, so it never puts load on an employer's website.",
      ],
    },
    {
      heading: "What Rekiya shows — and what it doesn't",
      body: [
        "• The job title, employer, location and the facts the listing states (job type, level, work mode, posting date).",
        "• At most a short excerpt of the description. The full description, requirements and closing date are always on the employer's own page.",
        "• The field (for example Software Engineering or Finance & Accounting) and experience level are assigned automatically from the job title and can occasionally be wrong.",
        "Rekiya never handles applications, never asks job seekers for money and never asks for personal documents. Genuine employers never charge you to apply.",
      ],
    },
    {
      heading: "Closed and expired vacancies",
      body: [
        `${CLOSE_AFTER_TEXT} Its page is then removed from the site and from the sitemap, so search engines drop it too.`,
        "If an employer reposts the same job, it reappears with its new posting date.",
      ],
    },
    {
      heading: "Corrections and removal",
      body: [
        "Every job page has a “Report a problem” link for wrong details, a closed job or a duplicate. Employers can ask for a listing or their whole careers page to be corrected or removed the same way.",
        `Reports are handled publicly on GitHub: ${REPORT_URL}`,
      ],
    },
    {
      heading: "Who runs Rekiya",
      body: [
        "Rekiya is an independent project; its source code and the job data are public on GitHub. It is not affiliated with any employer, job board or recruitment agency listed on the site.",
        `Contact: open an issue at ${REPORT_URL}`,
      ],
    },
  ],
};

export const PRIVACY: PolicyPage = {
  path: "/privacy/",
  title: `Privacy Policy | ${SITE_NAME}`,
  description: "Rekiya has no accounts, no tracking and no ads. Saved jobs and settings stay in your own browser.",
  h1: "Privacy policy",
  intro: "Rekiya is built to work without knowing who you are.",
  sections: [
    {
      heading: "What Rekiya does not collect",
      body: [
        "There are no accounts, no sign-up, no advertising, no analytics or tracking scripts and no third-party cookies.",
        "Rekiya never sees your job applications: when you press Apply you go to the employer's own website, whose privacy policy then applies.",
      ],
    },
    {
      heading: "What stays on your device",
      body: [
        "Saved jobs, application notes, saved searches, hidden jobs and settings are stored only in your browser (local storage). Clearing your browser data deletes them; the Settings page lets you export or delete them at any time.",
        "The site can work offline: your browser keeps a copy of recently loaded pages and job data.",
      ],
    },
    {
      heading: "Hosting",
      body: [
        "Rekiya is hosted on GitHub Pages. Like any web host, GitHub receives standard request information such as your IP address; see GitHub's privacy statement. The system status page also asks GitHub's public API for the latest sync runs.",
      ],
    },
    {
      heading: "Questions",
      body: [`Open an issue at ${REPORT_URL}.`],
    },
  ],
};

export const TERMS: PolicyPage = {
  path: "/terms/",
  title: `Terms of Use and Disclaimer | ${SITE_NAME}`,
  description:
    "Rekiya lists vacancies from employers' career pages as information only. Always check the details and apply on the employer's own website.",
  h1: "Terms of use and disclaimer",
  intro: "Rekiya is a free information service that helps you find vacancies published by Sri Lankan employers.",
  sections: [
    {
      heading: "Information only",
      body: [
        "Listings are collected automatically from employers' websites and may be incomplete, out of date or wrong. The employer's own listing is the authoritative version — always check it before applying.",
        "Rekiya is not an employer, recruiter or agency, does not take part in any hiring decision and does not guarantee that any vacancy is still open.",
      ],
    },
    {
      heading: "Employers' content",
      body: [
        "Job titles, excerpts, company names and trademarks belong to their owners and are shown only to point job seekers to the original listing.",
        `Employers can ask for corrections or removal at ${REPORT_URL}.`,
      ],
    },
    {
      heading: "Safety",
      body: [
        "Genuine employers never charge you to apply. Never pay a fee or share bank details to get a job; report any listing that asks for money.",
      ],
    },
    {
      heading: "Changes",
      body: ["These terms can change as the service changes; the current version is always on this page."],
    },
  ],
};

export const POLICY_PAGES = [HOW_IT_WORKS, PRIVACY, TERMS];
