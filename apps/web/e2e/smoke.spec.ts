import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { job, JOBS, mockData } from "./fixtures";

async function noAxeViolations(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

async function noHorizontalScroll(page: Page) {
  const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(sw).toBeLessThanOrEqual(cw);
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  (page as unknown as { __errors: string[] }).__errors = errors;
  await mockData(page);
});

test.afterEach(async ({ page }) => {
  expect((page as unknown as { __errors: string[] }).__errors).toEqual([]);
});

test("first visit: landing → onboarding → personalised feed", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Latest job vacancies in Sri Lanka");
  await noAxeViolations(page);
  await noHorizontalScroll(page);

  await page.getByRole("link", { name: "Get started" }).click();
  await expect(page).toHaveURL(/\/onboarding\/$/);
  await page.locator("label", { hasText: "Software Engineering" }).first().click();
  await page.locator("label", { hasText: "QA & Testing" }).click();
  await expect(page.getByText("2 fields selected")).toBeVisible();
  await noAxeViolations(page);
  await page.getByRole("button", { name: "Show my jobs" }).click();

  await expect(page).toHaveURL(/\/jobs\/\?fields=software-engineering%2Cqa-testing/);
  await expect(page.getByRole("status").filter({ hasText: "open job" })).toHaveText("2 open jobs");
  await expect(page.getByRole("heading", { name: "Senior React Developer" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "QA Automation Intern" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Old Closed Role" })).toHaveCount(0);
  await noAxeViolations(page);

  // Returning visitor goes straight to the feed.
  await page.goto("./");
  await expect(page).toHaveURL(/\/jobs/);
});

test("filters live in the URL and combine; search is typo-tolerant", async ({ page }) => {
  await page.goto("/jobs/?workMode=remote");
  await expect(page.getByRole("status").filter({ hasText: "open job" })).toHaveText("1 open job");
  await expect(page.getByRole("heading", { name: "DevSecOps Engineer" })).toBeVisible();

  await page.goto("/jobs/");
  await page.getByLabel("Search jobs").fill("develper");
  await expect(page.getByRole("heading", { name: "Senior React Developer" })).toBeVisible();
  await expect(page).toHaveURL(/q=develper/);

  // Kandy + CSE-listed: the bank, and the John Keells Group role (a group with listed members) in "Colombo · Kandy".
  await page.goto("/jobs/?location=kandy&cse=1");
  await expect(page.getByRole("status").filter({ hasText: "open job" })).toHaveText("2 open jobs");
  await expect(page.getByRole("heading", { name: "Branch Manager" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Data Scientist" })).toBeVisible();

  await page.goto("/jobs/?seniority=principal");
  await expect(page.getByText("No jobs match these filters")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByRole("status").filter({ hasText: "open job" })).toHaveText("6 open jobs");
});

test("job card links to the original listing in a new tab", async ({ page }) => {
  await page.goto("/jobs/");
  const apply = page.getByRole("link", { name: /Apply for Senior React Developer at WSO2/ });
  await expect(apply).toHaveAttribute("href", /^https:\/\/careers\.example\.lk\/jobs\/\d+$/);
  await expect(apply).toHaveAttribute("target", "_blank");
  await expect(apply).toHaveAttribute("rel", /noopener/);
});

test("save a job, track the application and export", async ({ page }) => {
  await page.goto("/jobs/");
  await page.getByRole("button", { name: "Save Data Scientist" }).click();
  await expect(page.getByText("Saved — find it under Saved")).toBeVisible();
  await page.goto("/saved/");
  await expect(page.getByRole("heading", { name: "Data Scientist" })).toBeVisible();
  await page.getByLabel("Application status for Data Scientist").selectOption("applied");
  await page.getByRole("button", { name: "Add notes" }).click();
  await page.getByLabel("Notes for Data Scientist").fill("Call HR on Monday");
  await page.getByRole("button", { name: "Save notes" }).click();
  await page.reload();
  await expect(page.getByRole("tab", { name: /Applied\s*1/ })).toBeVisible();
  await expect(page.getByText("Call HR on Monday")).toBeVisible();
  await noAxeViolations(page);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  expect((await download).suggestedFilename()).toMatch(/^rekiya-applications-\d{4}-\d{2}-\d{2}\.csv$/);

  // Remove, then undo.
  await page.getByRole("button", { name: "Remove Data Scientist", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Data Scientist" })).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("heading", { name: "Data Scientist" })).toBeVisible();
});

test("job detail page: facts, apply, save, similar jobs, back", async ({ page }) => {
  await page.goto("/jobs/");
  await page.getByRole("link", { name: "DevSecOps Engineer", exact: true }).click();
  await expect(page).toHaveURL(/\/job\/devsecops-engineer-at-wso2-[0-9a-f]{12}\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("DevSecOps Engineer");
  await expect(page.getByRole("link", { name: /Apply on careers\.example\.lk/ })).toHaveAttribute("target", "_blank");
  await expect(page.getByText("Remote", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Cybersecurity" })).toHaveAttribute("href", "/jobs/cybersecurity/");
  await noAxeViolations(page);

  await page.getByLabel("Track your application").or(page.locator("#status")).selectOption("interviewing");
  await expect(page.getByText("Marked as “Interviewing”")).toBeVisible();
  await expect(page.getByRole("button", { name: "Saved", exact: true })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Back to jobs" }).click();
  await expect(page).toHaveURL(/\/jobs\/$/);
  // The card now shows the status and that it was viewed.
  const card = page.getByRole("article", { name: "DevSecOps Engineer" });
  await expect(card.getByText("Interviewing")).toBeVisible();
  await expect(card.getByText("Viewed")).toBeVisible();

  await page.goto("/job/does-not-exist/");
  await expect(page.getByRole("heading", { name: "This job is no longer listed" })).toBeVisible();
});

test("hide a job with undo, and manage hidden jobs", async ({ page }) => {
  await page.goto("/jobs/");
  await page.getByRole("button", { name: "Hide UI/UX Designer" }).click();
  await expect(page.getByRole("heading", { name: "UI/UX Designer" })).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "open job" })).toHaveText("5 open jobs");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("heading", { name: "UI/UX Designer" })).toBeVisible();

  await page.getByRole("button", { name: "Hide UI/UX Designer" }).click();
  await page.getByRole("link", { name: "Manage hidden jobs" }).click();
  await expect(page.getByText("UI/UX Designer")).toBeVisible();
  await page.getByRole("button", { name: "Show again" }).click();
  await expect(page.getByText("Nothing hidden.")).toBeVisible();
});

test("quick filters, sort and removable filter chips", async ({ page }) => {
  await page.goto("/jobs/");
  await page.getByRole("group", { name: "Quick filters" }).getByRole("button", { name: "Remote" }).click();
  await expect(page).toHaveURL(/workMode=remote/);
  await expect(page.getByRole("status").filter({ hasText: "open job" })).toHaveText("1 open job");
  await page.getByRole("button", { name: "Remove filter: Remote" }).click();
  await expect(page.getByRole("status").filter({ hasText: "open job" })).toHaveText("6 open jobs");

  await page.getByLabel("Sort by").selectOption("company");
  await expect(page).toHaveURL(/sort=company/);
  // 99x first alphabetically.
  await expect(page.getByRole("article").first()).toContainText("99x");
});

test("save a search and see it on the Saved page", async ({ page }) => {
  await page.goto("/jobs/?fields=software-engineering");
  await page.getByRole("button", { name: "Save search" }).click();
  await expect(page.getByRole("button", { name: "Search saved" })).toHaveAttribute("aria-pressed", "true");
  await page.goto("/saved/");
  const item = page.getByRole("button", { name: /Software Engineering\s*1 open/ });
  await expect(item).toBeVisible();
  await item.click();
  await expect(page).toHaveURL(/fields=software-engineering/);
});

test("mobile filter sheet", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phones only");
  await page.goto("/jobs/");
  await page.getByRole("button", { name: /^Filters/ }).click();
  const sheet = page.getByRole("dialog", { name: "Filters" });
  await expect(sheet).toBeVisible();
  await sheet.getByText("Last 7 days").click();
  await sheet.locator("label", { hasText: "Intern" }).first().click();
  await noAxeViolations(page);
  await sheet.getByRole("button", { name: /Show \d+ jobs?/ }).click();
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL(/posted=7/);
  await noHorizontalScroll(page);
});

test("insights page and 404", async ({ page }) => {
  await page.goto("/insights/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Job market insights");
  await expect(page.getByRole("link", { name: /Software Engineering\s*1 open jobs/ })).toHaveAttribute(
    "href",
    "/jobs/software-engineering/",
  );
  await noAxeViolations(page);
  await noHorizontalScroll(page);
  await page.goto("/nope");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

test("landing search goes to the feed", async ({ page }) => {
  await page.goto("/about/");
  await page.getByLabel("Search jobs").fill("react");
  await page.getByRole("button", { name: "Search jobs" }).click();
  await expect(page).toHaveURL(/\/jobs\/\?q=react/);
  await expect(page.getByRole("heading", { name: "Senior React Developer" })).toBeVisible();
});

test("settings: backup download", async ({ page }) => {
  await page.goto("/settings/");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download backup" }).click();
  expect((await download).suggestedFilename()).toMatch(/^rekiya-backup-.*\.json$/);
});

test("company directory: industries, groups, health and coming soon", async ({ page }) => {
  await page.goto("/companies/");
  await expect(page.getByRole("heading", { name: /Banking/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Sampath Bank PLC.*Temporarily unavailable/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Acme Plantations PLC.*Coming soon/ })).toBeVisible();
  await noAxeViolations(page);
  await noHorizontalScroll(page);

  await page.getByRole("link", { name: /John Keells Holdings PLC/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("John Keells Holdings PLC");
  await expect(page.getByRole("heading", { name: "Data Scientist" })).toBeVisible();
  await expect(page.getByText("Includes jobs posted on the shared John Keells Group careers page.")).toBeVisible();

  await page.goto("/companies/acme-plantations/");
  await expect(page.getByText("We don't know this company's website or careers page yet.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Suggest it" })).toHaveAttribute("href", /issues\/new\?template=suggest-company\.yml/);
});

test("settings: theme and RSS feeds", async ({ page }) => {
  await page.goto("/settings/");
  await page.getByRole("radio", { name: "dark" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await noAxeViolations(page);
  await page.getByRole("radio", { name: "light" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await expect(page.getByRole("link", { name: "Software Engineering" }).first()).toHaveAttribute(
    "href",
    /feeds\/software-engineering\.xml$/,
  );
});

test("dark mode passes contrast checks on the feed", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/jobs/");
  await expect(page.getByRole("heading", { name: "Data Scientist" })).toBeVisible();
  await noAxeViolations(page);
});

test("stale data shows a notice", async ({ page }) => {
  await page.unroute("**/data/**");
  await mockData(page, { generatedHoursAgo: 20 });
  await page.goto("/jobs/");
  await expect(page.getByText(/Job data may be out of date/)).toBeVisible();
});

test("RSS feed and manifest are published", async ({ request }) => {
  const feed = await request.get("feeds/software-engineering.xml");
  expect(feed.ok()).toBe(true);
  expect(await feed.text()).toContain('<rss version="2.0"');
  const manifest = await request.get("manifest.webmanifest");
  expect((await manifest.json()).theme_color).toBe("#123760");
});

test("SEO: field and job pages set title, canonical and structured data", async ({ page }) => {
  await page.goto("/jobs/qa-testing/");
  await expect(page.getByRole("heading", { name: "QA Automation Intern" })).toBeVisible();
  await expect(page).toHaveTitle(/^QA & Testing Jobs in Sri Lanka \(\d+ open\) \| Rekiya$/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://vacancyfinder.github.io/jobs/qa-testing/");
  const crumbs = await page.locator('script[data-ld="page"]').allTextContents();
  expect(crumbs.map((c) => JSON.parse(c)["@type"])).toContain("BreadcrumbList");

  await page.getByRole("link", { name: "QA Automation Intern", exact: true }).click();
  await expect(page).toHaveURL(/\/job\/qa-automation-intern-at-99x-[0-9a-f]{12}\/$/);
  await expect(page).toHaveTitle(/^QA Automation Intern — 99x, Colombo \| Rekiya$/);
  const ld = (await page.locator('script[data-ld="page"]').allTextContents()).map((t) => JSON.parse(t));
  const posting = ld.find((x) => x["@type"] === "JobPosting");
  expect(posting).toMatchObject({ title: "QA Automation Intern", employmentType: "INTERN", hiringOrganization: { name: "99x" } });
  expect(posting.jobLocation[0].address).toMatchObject({ addressLocality: "Colombo", addressCountry: "LK" });

  // Filtered views are not indexable pages.
  await page.goto("/jobs/?q=react&workMode=hybrid");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
});

test("SEO: old #/ links still work", async ({ page }) => {
  await page.goto("/#/jobs?workMode=remote");
  await expect(page).toHaveURL(/\/jobs\?workMode=remote$/);
  await expect(page.getByRole("status").filter({ hasText: "open job" })).toHaveText("1 open job");
});

test("SEO: prerendered HTML, sitemap, robots.txt and llms.txt are published", async ({ request }) => {
  const home = await (await request.get("/")).text();
  expect(home).toContain("<h1");
  expect(home).toContain("Latest job vacancies in Sri Lanka");
  expect(home).toMatch(/"@type":"WebSite".*"SearchAction"/);
  expect(home).toContain('<link rel="canonical" href="https://vacancyfinder.github.io/"');

  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("<loc>https://vacancyfinder.github.io/jobs/</loc>");
  const jobUrl = sitemap.match(/<loc>(https:\/\/vacancyfinder\.github\.io\/job\/[^<]+)<\/loc>/)![1]!;
  const job = await (await request.get(new URL(jobUrl).pathname)).text();
  expect(job).toContain('"@type":"JobPosting"');
  expect(job).toContain(`<link rel="canonical" href="${jobUrl}"`);

  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Sitemap: https://vacancyfinder.github.io/sitemap.xml");
  expect(robots).toContain("User-agent: GPTBot");
  const llms = await (await request.get("/llms.txt")).text();
  expect(llms).toMatch(/^# Rekiya — latest job vacancies in Sri Lanka/);
  expect((await request.get("/llms-full.txt")).ok()).toBe(true);
  expect((await request.get("/og-image.png")).headers()["content-type"]).toContain("image/png");
  const notFound = await (await request.get("/404.html")).text();
  expect(notFound).toContain('content="noindex, follow"');
});

test("a new 3-hourly sync appears without reloading the page", async ({ page }) => {
  await page.goto("/jobs/");
  await expect(page.getByRole("status").filter({ hasText: "open job" })).toHaveText("6 open jobs");
  await expect(page.getByText(/Updated 1 h ago · next update around \d{1,2}:\d{2} [ap]m/)).toBeVisible();

  // The crawler deploys a newer sync with one more job; the open tab picks it up when it's next checked.
  await page.unroute("**/data/**");
  await mockData(page, {
    generatedHoursAgo: 0,
    jobs: [...JOBS, job({ title: "Platform Engineer", company: "wso2", fields: ["cloud-devops"], firstSeenAt: new Date().toISOString() })],
  });
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));

  await expect(page.getByText("Jobs updated just now — 7 open (+1)")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Platform Engineer" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "open job" })).toHaveText("7 open jobs");
});
