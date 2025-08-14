import { describe, expect, it } from "vitest";
import type { Company, Job as SharedJob } from "@rekiya/shared";
import { buildPages, llmsFullTxt, llmsTxt, ogImagePath, renderDocument, robotsTxt, sitemapXml, type SeoInput } from "../build/seo";
import { fieldFeed } from "../build/feeds";
import { HOME_META, JOB_META, jobKeyFromParam, jobPath, matchesJobKey, slugify } from "../src/lib/paths";
import { jobPostingLd, ldJson } from "../src/lib/structured-data";
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
    expect(m.title).toBe("Senior QA Engineer — WSO2, Sri Lanka | Rekiya");
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
    expect(html).toContain("<title>Senior QA Engineer — Acme PLC, Colombo | Rekiya</title>");
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
