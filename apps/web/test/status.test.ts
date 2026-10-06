import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildInfo } from "../build/data-plugin";
import { computeStatus, duration, freshnessLevel, meaningfulRuns, type StatusInput, type WorkflowRun } from "../src/lib/status";

const H = 3600_000;
const NOW = Date.parse("2026-10-03T06:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

const run = (over: Partial<WorkflowRun> & { took?: number; at?: number } = {}): WorkflowRun => {
  const { took = 4 * 60_000, at = H, ...rest } = over;
  return {
    id: Math.floor(Math.random() * 1e9),
    status: "completed",
    conclusion: "success",
    event: "workflow_dispatch",
    created_at: ago(at),
    run_started_at: ago(at),
    updated_at: ago(at - took),
    html_url: "https://github.com/x/y/actions/runs/1",
    ...rest,
  };
};

const input = (over: Partial<StatusInput> = {}): StatusInput => ({
  now: NOW,
  syncEveryMs: 3 * H,
  build: {
    id: "1-1",
    builtAt: ago(H),
    commit: "abc",
    runUrl: null,
    event: "workflow_dispatch",
    sync: "ok",
    dataGeneratedAt: ago(H),
    pagesSource: "workflow",
  },
  meta: { generatedAt: ago(H), totals: { targets: 27, targetsOk: 27 } },
  health: {},
  runs: [run()],
  repoGeneratedAt: ago(H),
  ...over,
});

const level = (s: ReturnType<typeof computeStatus>, key: string) => s.components.find((c) => c.key === key)!.level;

describe("system status", () => {
  it("is all green when the sync is on time and the site serves the latest data", () => {
    const s = computeStatus(input());
    expect(s.overall).toBe("ok");
    expect(s.headline).toBe("All systems operational");
    expect(s.components.map((c) => c.level)).toEqual(["ok", "ok", "ok", "ok", "ok"]);
    expect(s.components[1]!.detail).toMatch(/^Last updated 1 h ago \(10:30 am Sri Lanka time\)\. Next update around 1:30 pm\.$/);
  });

  it("flags late and missing syncs from the data's age", () => {
    expect(level(computeStatus(input({ meta: { generatedAt: ago(3.5 * H), totals: { targets: 1, targetsOk: 1 } } })), "freshness")).toBe(
      "ok",
    );
    expect(level(computeStatus(input({ meta: { generatedAt: ago(4 * H), totals: { targets: 1, targetsOk: 1 } } })), "freshness")).toBe(
      "warn",
    );
    const old = computeStatus(
      input({ meta: { generatedAt: ago(7 * H), totals: { targets: 1, targetsOk: 1 } }, repoGeneratedAt: ago(7 * H) }),
    );
    expect(level(old, "freshness")).toBe("down");
    expect(old.overall).toBe("down");
    expect(old.headline).toBe("Problem: job data — out of date");
  });

  it("reports failed sync runs, ignoring the quick backup checks", () => {
    const check = run({ event: "schedule", took: 20_000, at: 0.2 * H });
    expect(meaningfulRuns([check, run()])).toHaveLength(1);
    expect(level(computeStatus(input({ runs: [check, run({ conclusion: "failure" }), run({ at: 4 * H })] })), "automation")).toBe("warn");
    const twice = computeStatus(input({ runs: [run({ conclusion: "failure" }), run({ conclusion: "failure", at: 2 * H })] }));
    expect(level(twice, "automation")).toBe("down");
    expect(twice.components.find((c) => c.key === "automation")!.summary).toBe("The last 2 sync attempts failed");
    const running = computeStatus(input({ runs: [run({ status: "in_progress", conclusion: null, at: 0.05 * H }), run()] }));
    expect(running.components.find((c) => c.key === "automation")!.summary).toBe("Syncing now");
    expect(level(computeStatus(input({ runs: null })), "automation")).toBe("unknown");
  });

  it("notices when the website is behind the latest committed data", () => {
    const s = computeStatus(input({ meta: { generatedAt: ago(4 * H), totals: { targets: 1, targetsOk: 1 } }, repoGeneratedAt: ago(H) }));
    expect(level(s, "publishing")).toBe("down");
    expect(s.components.find((c) => c.key === "publishing")!.summary).toBe("Website is 3 h behind the latest data");
    const legacy = computeStatus(input({ build: { ...input().build!, pagesSource: "legacy" } }));
    expect(level(legacy, "publishing")).toBe("warn");
  });

  it("rates career-page coverage", () => {
    expect(level(computeStatus(input({ meta: { generatedAt: ago(H), totals: { targets: 10, targetsOk: 7 } } })), "sources")).toBe("warn");
    expect(level(computeStatus(input({ meta: { generatedAt: ago(H), totals: { targets: 10, targetsOk: 4 } } })), "sources")).toBe("down");
  });

  it("footer dot and durations", () => {
    expect(freshnessLevel(ago(2 * H), 3 * H, NOW)).toBe("ok");
    expect(freshnessLevel(ago(7 * H), 3 * H, NOW)).toBe("down");
    expect(freshnessLevel(new Date(0).toISOString(), 3 * H, NOW)).toBe("unknown");
    expect(duration(45 * 60_000)).toBe("45 min");
    expect(duration(3 * H + 5 * 60_000)).toBe("3 h 5 min");
  });
});

describe("build.json", () => {
  it("records the build and its sync result for the status page and the deploy check", () => {
    const b = buildInfo(
      "2026-10-03T05:00:00.000Z",
      { BUILD_ID: "42-1", BUILD_SYNC: "failed", BUILD_PAGES_SOURCE: "legacy" },
      new Date(NOW),
    );
    expect(b).toMatchObject({ id: "42-1", sync: "failed", pagesSource: "legacy", builtAt: "2026-10-03T06:00:00.000Z" });
    expect(buildInfo("x", {}, new Date(NOW))).toMatchObject({ id: `local-${NOW}`, sync: "local", commit: null });
  });
});

describe("sync workflows", () => {
  const crawl = readFileSync(resolve(process.cwd(), "../../.github/workflows/crawl-and-deploy.yml"), "utf8");
  const timer = readFileSync(resolve(process.cwd(), "../../.github/workflows/sync-timer.yml"), "utf8");
  it("chains every run to the next one through the sync timer", () => {
    expect(crawl).toContain("gh workflow run sync-timer.yml");
    expect(crawl).toMatch(/next-sync:\n\s+needs: \[gate, crawl-build, deploy\]\n\s+if: always\(\)/);
    expect(timer).toContain("gh workflow run crawl-and-deploy.yml");
    expect(timer).toMatch(/concurrency:\n\s+group: sync-timer\n\s+cancel-in-progress: true/);
  });
  it("never publishes a failed crawl and verifies the live site", () => {
    expect(crawl).toContain("git checkout -- data && git clean -fdq data");
    expect(crawl).toContain("if: steps.result.outputs.sync == 'ok' && steps.crawl.outputs.changed == 'true'");
    expect(crawl).toContain("$SITE/build.json?check=");
  });
  it("redeploys after every push to main, so a legacy branch build never stays live", () => {
    expect(crawl).toMatch(/\n {2}push:\n {4}branches: \[main\]\n\n/);
  });
});
