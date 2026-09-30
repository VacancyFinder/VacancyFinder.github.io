import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { mockData } from "./fixtures";

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
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Let us do the searching. You do the applying.");
  await noAxeViolations(page);
  await noHorizontalScroll(page);

  await page.getByRole("link", { name: "Get started" }).click();
  await expect(page).toHaveURL(/#\/onboarding$/);
  await page.locator("label", { hasText: "Software Engineering" }).first().click();
  await page.locator("label", { hasText: "QA & Testing" }).click();
  await expect(page.getByText("2 fields selected")).toBeVisible();
  await noAxeViolations(page);
  await page.getByRole("button", { name: "Show my jobs" }).click();

  await expect(page).toHaveURL(/#\/jobs\?fields=software-engineering%2Cqa-testing/);
  await expect(page.getByRole("status").filter({ hasText: "open job" })).toHaveText("2 open jobs");
  await expect(page.getByRole("heading", { name: "Senior React Developer" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "QA Automation Intern" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Old Closed Role" })).toHaveCount(0);
  await noAxeViolations(page);

  // Returning visitor goes straight to the feed.
  await page.goto("./");
  await expect(page).toHaveURL(/#\/jobs/);
});

test("filters live in the URL and combine; search is typo-tolerant", async ({ page }) => {
  await page.goto("./#/jobs?workMode=remote");
  await expect(page.getByRole("status").filter({ hasText: "open job" })).toHaveText("1 open job");
  await expect(page.getByRole("heading", { name: "DevSecOps Engineer" })).toBeVisible();

  await page.goto("./#/jobs");
  await page.getByLabel("Search jobs").fill("develper");
  await expect(page.getByRole("heading", { name: "Senior React Developer" })).toBeVisible();
  await expect(page).toHaveURL(/q=develper/);

  // Kandy + CSE-listed: the bank, and the John Keells Group role (a group with listed members) in "Colombo · Kandy".
  await page.goto("./#/jobs?location=kandy&cse=1");
  await expect(page.getByRole("status").filter({ hasText: "open job" })).toHaveText("2 open jobs");
  await expect(page.getByRole("heading", { name: "Branch Manager" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Data Scientist" })).toBeVisible();

  await page.goto("./#/jobs?seniority=principal");
  await expect(page.getByText("No jobs match these filters")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByRole("status").filter({ hasText: "open job" })).toHaveText("6 open jobs");
});

test("job card links to the original listing in a new tab", async ({ page }) => {
  await page.goto("./#/jobs");
  const apply = page.getByRole("link", { name: /Apply for Senior React Developer at WSO2/ });
  await expect(apply).toHaveAttribute("href", /^https:\/\/careers\.example\.lk\/jobs\/\d+$/);
  await expect(apply).toHaveAttribute("target", "_blank");
  await expect(apply).toHaveAttribute("rel", /noopener/);
});

test("save a job and mark it applied", async ({ page }) => {
  await page.goto("./#/jobs");
  await page.getByRole("button", { name: "Save Data Scientist" }).click();
  await page.goto("./#/saved");
  await expect(page.getByRole("heading", { name: "Data Scientist" })).toBeVisible();
  await page.getByRole("button", { name: "Mark as applied" }).click();
  await expect(page.getByRole("button", { name: "Applied" })).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.getByText("1 saved · 1 marked as applied")).toBeVisible();
  await noAxeViolations(page);
});

test("company directory: industries, groups, health and coming soon", async ({ page }) => {
  await page.goto("./#/companies");
  await expect(page.getByRole("heading", { name: /Banking/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Sampath Bank PLC.*Temporarily unavailable/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Acme Plantations PLC.*Coming soon/ })).toBeVisible();
  await noAxeViolations(page);
  await noHorizontalScroll(page);

  await page.getByRole("link", { name: /John Keells Holdings PLC/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("John Keells Holdings PLC");
  await expect(page.getByRole("heading", { name: "Data Scientist" })).toBeVisible();
  await expect(page.getByText("Includes jobs posted on the shared John Keells Group careers page.")).toBeVisible();

  await page.goto("./#/companies/acme-plantations");
  await expect(page.getByText("We don't know this company's website or careers page yet.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Suggest it" })).toHaveAttribute("href", /issues\/new\?template=suggest-company\.yml/);
});

test("settings: theme and RSS feeds", async ({ page }) => {
  await page.goto("./#/settings");
  await page.getByRole("radio", { name: "dark" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await noAxeViolations(page);
  await page.getByRole("radio", { name: "light" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await expect(page.getByRole("link", { name: "Software Engineering" }).first()).toHaveAttribute("href", /feeds\/software-engineering\.xml$/);
});

test("dark mode passes contrast checks on the feed", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("./#/jobs");
  await expect(page.getByRole("heading", { name: "Data Scientist" })).toBeVisible();
  await noAxeViolations(page);
});

test("stale data shows a notice", async ({ page }) => {
  await page.unroute("**/data/**");
  await mockData(page, { generatedHoursAgo: 20 });
  await page.goto("./#/jobs");
  await expect(page.getByText(/Job data may be out of date/)).toBeVisible();
});

test("RSS feed and manifest are published", async ({ request }) => {
  const feed = await request.get("feeds/software-engineering.xml");
  expect(feed.ok()).toBe(true);
  expect(await feed.text()).toContain("<rss version=\"2.0\"");
  const manifest = await request.get("manifest.webmanifest");
  expect((await manifest.json()).theme_color).toBe("#123760");
});
