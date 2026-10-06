import { describe, expect, it } from "vitest";
import type { Company, Job as SharedJob } from "@rekiya/shared";
import {
  buildPages,
  googleIndexingUrls,
  llmsFullTxt,
  llmsTxt,
  ogImagePath,
  renderDocument,
  robotsTxt,
  sitemapIndexXml,
  sitemapXml,
  type SeoInput,
} from "../build/seo";
import { fieldFeed } from "../build/feeds";
import { HOME_META, JOB_META, jobKeyFromParam, jobPath, LOCATION_MIN_JOBS, matchesJobKey, placeSlugsOf, slugify } from "../src/lib/paths";
import { jobPostingLd, ldJson, organizationLd, websiteLd } from "../src/lib/structured-data";
import type { Job } from "../src/lib/types";

const SITE = "https://vacancyfinder.github.io";

interface PostingLd {
  jobLocation: { address: Record<string, string> }[];
  jobLocationType?: string;
  description: string;
}

const job = (over: Partial<Job> = {}): Job => ({
  id: "3f2a9c1b7d4e8899aabbccddeeff001122334455",
  title: "Senior QA Engineer",
  company: "acme",
  industry: "technology",
  fields: ["qa-testing"],
  seniority: "senior",
  type: "full-time",
  workMode: "hybrid",
  location: "Colombo · Kandy",
  snippet: "Own test automation for our payments platform.",
  url: "https://acme.lk/careers/123",
  source: "lever",
  postedAt: "2026-09-28T00:00:00.000Z",
  firstSeenAt: "2026-09-29T00:00:00.000Z",
  lastSeenAt: "2026-09-30T00:00:00.000Z",
  status: "open",
  missedRuns: 0,
  closedAt: null,
  ...over,
});

describe("clean URLs", () => {
  it("slugifies titles to readable ASCII", () => {
    expect(slugify("Senior Engineer – Data & AI (Colombo)")).toBe("senior-engineer-data-and-ai-colombo");
    expect(slugify("Café Manager")).toBe("cafe-manager");
    expect(slugify("a".repeat(30) + " " + "b".repeat(60)).length).toBeLessThanOrEqual(70);
  });
  it("job paths round-trip to their job", () => {
    const j = job();
    const p = jobPath(j, "Acme PLC");
    expect(p).toBe("/job/senior-qa-engineer-at-acme-plc-3f2a9c1b7d4e/");
    const key = jobKeyFromParam(p.split("/")[2]!);
    expect(matchesJobKey(j.id, key)).toBe(true);
    expect(matchesJobKey("ffff" + j.id.slice(4), key)).toBe(false);
    // Legacy links used the full 40-char id.
    expect(matchesJobKey(j.id, jobKeyFromParam(j.id))).toBe(true);
  });
  it("page copy stays within search-result limits and never says 'Sri Lanka, Sri Lanka'", () => {
    expect(HOME_META(419, 31).description.length).toBeLessThanOrEqual(160);
    const m = JOB_META(job({ location: "Sri Lanka", snippet: "" }), "WSO2");
    expect(m.description).not.toMatch(/Sri Lanka, Sri Lanka/);
    expect(m.title).toBe("Senior QA Engineer at WSO2 — Job in Sri Lanka | Rekiya");
    expect(m.description).toBe(
      "Senior QA Engineer job at WSO2, Sri Lanka. Full-time, Senior level. Posted 28 Sept 2026. Apply on WSO2's official careers page.",
    );
  });
});

describe("JobPosting", () => {
  it("has what Google for Jobs needs", () => {
    const ld = jobPostingLd(SITE, job(), { name: "Acme PLC", website: "https://acme.lk" }) as unknown as PostingLd;
    expect(ld).toMatchObject({
      "@type": "JobPosting",
      title: "Senior QA Engineer",
      datePosted: "2026-09-28",
      employmentType: "FULL_TIME",
      directApply: false,
      hiringOrganization: { name: "Acme PLC", sameAs: "https://acme.lk" },
      url: `${SITE}/job/senior-qa-engineer-at-acme-plc-3f2a9c1b7d4e/`,
    });
    expect(ld.jobLocation.map((l) => l.address.addressLocality)).toEqual(["Colombo", "Kandy"]);
    expect(ld.description).toContain("Experience level: Senior");
  });
  it("marks remote roles and skips non-places", () => {
    const ld = jobPostingLd(SITE, job({ workMode: "remote", location: "Head Office" }), { name: "Acme" }) as unknown as PostingLd;
    expect(ld.jobLocationType).toBe("TELECOMMUTE");
    expect(ld.jobLocation[0]!.address).toEqual({ "@type": "PostalAddress", addressCountry: "LK" });
  });
  it("adds industry, uses correct grammar and only claims 0 months' experience for intern/trainee roles", () => {
    const ld = jobPostingLd(SITE, job({ title: "Account Manager", snippet: "", seniority: "junior" }), {
      name: "WSO2",
    }) as unknown as Record<string, unknown>;
    expect(ld.industry).toBe("Technology");
    expect(ld.description).toContain("WSO2 is hiring an Account Manager in Sri Lanka.");
    expect(ld.experienceRequirements).toBeUndefined();
    const intern = jobPostingLd(SITE, job({ seniority: "intern" }), { name: "WSO2" }) as unknown as Record<string, unknown>;
    expect(intern.experienceRequirements).toMatchObject({ monthsOfExperience: 0 });
  });
  it("describes the site as one entity, without the retired sitelinks search box", () => {
    const site = websiteLd(SITE);
    expect(site.potentialAction).toBeUndefined();
    expect(site.alternateName).toContain("VacancyFinder");
    expect(organizationLd(SITE)).toMatchObject({ name: "Rekiya", alternateName: "VacancyFinder" });
    expect(String(organizationLd(SITE).description)).toMatch(/employers' official career pages/);
  });
  it("JSON-LD can't close its script tag", () => {
    expect(ldJson({ t: "</script><script>alert(1)</script>" })).not.toContain("</script>");
  });
});

describe("prerendered site", () => {
  const companies = [
    {
      slug: "acme",
      name: "Acme PLC",
      website: "https://acme.lk",
      careersUrl: "https://acme.lk/careers",
      adapter: "lever",
      adapterConfig: {},
      industry: "technology",
      cseSymbol: "ACME.N0000",
      parentGroup: null,
      sourceLists: ["cse"],
      status: "ready",
      active: true,
    },
    {
      slug: "quiet",
      name: "Quiet Ltd",
      website: null,
      careersUrl: null,
      adapter: "none",
      adapterConfig: {},
      industry: "banking",
      cseSymbol: null,
      parentGroup: null,
      sourceLists: ["cse"],
      status: "needs-research",
      active: true,
    },
  ] as Company[];
  const inp: SeoInput = {
    outDir: "/tmp/none",
    siteUrl: SITE,
    jobs: [job(), job({ id: "aa" + job().id.slice(2), title: "Closed Role", status: "closed" })] as unknown as SharedJob[],
    companies,
    groups: [],
    generatedAt: "2026-09-30T06:00:00.000Z",
  };
  const pages = buildPages(inp);
  const byPath = new Map(pages.map((p) => [p.path, p]));

  it("has an internships landing page that is empty-safe and indexable once there are internships", () => {
    const p = byPath.get("/internships/")!;
    expect(p.title).toMatch(/^Internships in Sri Lanka \d{4} — Open Internships & Trainee Jobs \| Rekiya$/);
    expect(p.noindex).toBe(true); // the fixture has no internships
    const jobs2 = [
      ...inp.jobs,
      job({ id: "bb" + job().id.slice(2), title: "Software Engineering Intern", seniority: "intern", type: "internship" }),
    ] as unknown as SharedJob[];
    const withIntern = buildPages({ ...inp, jobs: jobs2 });
    const ip = withIntern.find((x) => x.path === "/internships/")!;
    expect(ip.noindex).toBe(false);
    expect(ip.title).toContain("— 1 Open Internships");
    expect(ip.body).toContain("Software Engineering Intern");
    expect(ip.body).not.toContain("Senior QA Engineer");
    expect(JSON.stringify(ip.jsonLd)).toContain('"@type":"FAQPage"');
    expect(sitemapXml(SITE, withIntern)).toContain(`<loc>${SITE}/internships/</loc>`);
    expect(llmsTxt({ ...inp, jobs: jobs2 }, withIntern)).toContain(`[Internships in Sri Lanka](${SITE}/internships/): 1 open internships`);
  });

  it("gives a city a page only once it has enough open jobs, and links its jobs to it", () => {
    expect(placeSlugsOf("Colombo 03 · Kandy")).toEqual(["colombo", "kandy"]);
    expect(placeSlugsOf("Head Office")).toEqual([]);
    expect(byPath.has("/locations/colombo/")).toBe(false); // the fixture has only one Colombo job
    const many = Array.from({ length: LOCATION_MIN_JOBS }, (_, i) =>
      job({ id: (i + 10).toString(16).padStart(2, "0") + job().id.slice(2), title: `Role ${i}`, location: "Colombo" }),
    );
    const withCity = buildPages({ ...inp, jobs: many as unknown as SharedJob[] });
    const city = withCity.find((p) => p.path === "/locations/colombo/")!;
    expect(city.title).toBe(`Jobs in Colombo — ${LOCATION_MIN_JOBS} Latest Vacancies | Rekiya`);
    expect(city.noindex).toBeFalsy();
    expect(city.body).toContain("<h2");
    const jobPage = withCity.find((p) => p.path.startsWith("/job/"))!;
    expect(jobPage.body).toContain('href="/locations/colombo/">Jobs in Colombo</a>');
    expect(withCity.find((p) => p.path === "/")!.body).toContain('href="/locations/colombo/"');
  });

  it("publishes how-it-works, privacy and terms pages and splits the sitemap", () => {
    for (const path of ["/how-it-works/", "/privacy/", "/terms/"]) {
      const p = byPath.get(path)!;
      expect(p.noindex).toBeFalsy();
      expect(p.body).toMatch(/<h1[^>]*>/);
    }
    expect(byPath.get("/how-it-works/")!.body).toContain("two checks in a row");
    expect(sitemapIndexXml(SITE, "2026-09-30")).toContain(
      `<sitemap><loc>${SITE}/sitemap-jobs.xml</loc><lastmod>2026-09-30</lastmod></sitemap>`,
    );
  });

  it("tells Google's Indexing API exactly which job pages this sync added and removed", () => {
    const live = new Set([`${SITE}/job/senior-qa-engineer-at-acme-plc-3f2a9c1b7d4e/`]);
    const change = {
      at: inp.generatedAt,
      added: [{ id: job().id, title: "Senior QA Engineer", company: "acme" }],
      closed: [{ id: "cc" + job().id.slice(2), title: "Closed Role", company: "acme" }],
    };
    const urls = googleIndexingUrls(SITE, change, inp.generatedAt, () => "Acme PLC", live);
    expect(urls).toEqual({ updated: [...live], deleted: [`${SITE}/job/closed-role-at-acme-plc-cc2a9c1b7d4e/`] });
    // A change log from another sync (or none) sends nothing.
    expect(googleIndexingUrls(SITE, { ...change, at: "2026-01-01T00:00:00Z" }, inp.generatedAt, () => "Acme PLC", live)).toEqual({
      updated: [],
      deleted: [],
    });
  });

  it("builds a page per open job, field and company — closed jobs get none", () => {
    expect(byPath.has("/job/senior-qa-engineer-at-acme-plc-3f2a9c1b7d4e/")).toBe(true);
    expect([...byPath.keys()].some((p) => p.includes("closed-role"))).toBe(false);
    expect(byPath.get("/jobs/qa-testing/")!.noindex).toBeFalsy();
    expect(byPath.get("/jobs/healthcare/")!.noindex).toBe(true); // no jobs: thin page
    expect(byPath.get("/companies/acme/")!.noindex).toBeFalsy();
    expect(byPath.get("/companies/quiet/")!.noindex).toBe(true);
    expect(byPath.get("/saved/")!.noindex).toBe(true);
  });

  it("sitemap lists only indexable pages", () => {
    const xml = sitemapXml(SITE, pages);
    expect(xml).toContain(`<loc>${SITE}/job/senior-qa-engineer-at-acme-plc-3f2a9c1b7d4e/</loc><lastmod>2026-09-29</lastmod>`);
    expect(xml).not.toContain("/jobs/healthcare/");
    expect(xml).not.toContain("/saved/");
    expect(xml).not.toContain("/companies/quiet/");
  });

  it("renders head tags and body into the template", () => {
    const template = `<html lang="en"><head><title>x</title><meta name="description" content="x" /><meta name="robots" content="x" /><link rel="canonical" href="x" /><meta property="og:title" content="x" /><meta property="og:description" content="x" /><meta property="og:url" content="x" /><meta name="twitter:title" content="x" /><meta name="twitter:description" content="x" /></head><body><div id="root"></div></body></html>`;
    const p = byPath.get("/job/senior-qa-engineer-at-acme-plc-3f2a9c1b7d4e/")!;
    const html = renderDocument(template, SITE, p, { google: "abc123" });
    expect(html).toContain('data-pr="/job/senior-qa-engineer-at-acme-plc-3f2a9c1b7d4e/"');
    expect(html).toContain("<title>Senior QA Engineer at Acme PLC — Job in Colombo | Rekiya</title>");
    expect(html).toContain(`<link rel="canonical" href="${SITE}/job/senior-qa-engineer-at-acme-plc-3f2a9c1b7d4e/"`);
    expect(html).toContain('<meta name="google-site-verification" content="abc123" />');
    expect(html).toContain('"@type":"JobPosting"');
    expect(html).toMatch(/<h1[^>]*>Senior QA Engineer<\/h1>/);
    const noindex = renderDocument(template, SITE, byPath.get("/saved/")!);
    expect(noindex).toContain('content="noindex, follow"');
    expect(noindex).not.toContain('rel="canonical"');
  });

  it("gives every shareable page its own WhatsApp / social preview image", () => {
    expect(ogImagePath("/")).toBe("/og/home.png");
    expect(ogImagePath("/job/senior-qa-engineer-at-acme-plc-3f2a9c1b7d4e/")).toBe(
      "/og/job/senior-qa-engineer-at-acme-plc-3f2a9c1b7d4e.png",
    );
    const p = byPath.get("/job/senior-qa-engineer-at-acme-plc-3f2a9c1b7d4e/")!;
    expect(p.og).toMatchObject({
      title: "Senior QA Engineer",
      subtitle: "Acme PLC · Colombo, Kandy",
      chips: ["Senior", "Hybrid", "Full-time"],
    });
    expect(p.og!.badge!.text).toBe("AC"); // same initials as the in-app company badge
    const template = `<html><head><meta property="og:image" content="x" /><meta property="og:image:secure_url" content="x" /><meta property="og:image:alt" content="x" /><meta name="twitter:image" content="x" /></head><body></body></html>`;
    const img = `${SITE}/og/job/senior-qa-engineer-at-acme-plc-3f2a9c1b7d4e.png`;
    const html = renderDocument(template, SITE, p);
    expect(html).toContain(`<meta property="og:image" content="${img}" />`);
    expect(html).toContain(`<meta property="og:image:secure_url" content="${img}" />`);
    expect(html).toContain(`<meta name="twitter:image" content="${img}" />`);
    expect(html).toContain('<meta property="og:image:alt" content="Senior QA Engineer" />');
    // Private pages keep the site-wide image.
    expect(renderDocument(template, SITE, byPath.get("/saved/")!)).toContain('<meta property="og:image" content="x" />');
  });

  it("robots.txt and llms.txt point crawlers and AI assistants at the content", () => {
    expect(robotsTxt(SITE)).toContain(`Sitemap: ${SITE}/sitemap.xml`);
    const llms = llmsTxt(inp, pages);
    expect(llms).toMatch(/^# Rekiya — latest job vacancies in Sri Lanka\n\n> /);
    expect(llms).toContain(`[QA & Testing jobs in Sri Lanka](${SITE}/jobs/qa-testing/): 1 open vacancies`);
    const full = llmsFullTxt(inp);
    expect(full).toContain(
      `- [Senior QA Engineer](${SITE}/job/senior-qa-engineer-at-acme-plc-3f2a9c1b7d4e/) — Acme PLC · Colombo · Kandy · Senior`,
    );
    expect(full).not.toContain("Closed Role");
  });

  it("RSS channel links to the field page", () => {
    expect(fieldFeed("qa-testing", [], (s) => s, inp.generatedAt, SITE)).toContain(`<link>${SITE}/jobs/qa-testing/</link>`);
  });
});
