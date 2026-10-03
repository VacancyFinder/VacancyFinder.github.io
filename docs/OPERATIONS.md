# Operations: the 3-hour sync, failures and status

## How the schedule stays on time

| Engine                   | What it does                                                                                                                                                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sync timer (primary)     | Every "Crawl and deploy" run ends by starting **Sync timer** with the time the next sync is due. The timer waits, then starts "Crawl and deploy". Only one timer waits at a time (a new one cancels the old one). |
| Cron (backup)            | Runs at :17 and :47 every hour. Crawls only if the last successful crawl started ≥ 170 minutes ago, and restarts the timer if none is waiting.                                                                    |
| Manual                   | Actions → Crawl and deploy → Run workflow, or `pnpm sync:remote`. Always crawls; the next timer is set from it.                                                                                                   |
| External cron (optional) | `scripts/trigger-sync.sh` from cron-job.org or any server with a token, as a third safety net. Not needed normally.                                                                                               |

Why: GitHub's scheduled events are best-effort. Between 30 Sep and 3 Oct 2026 an hourly cron fired 8 times instead of
~70, so syncs landed 4–31 hours apart and the site showed data 7+ hours old.

## What happens when something fails

| Failure                                 | Result                                                                                                                                   |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Crawl crashes or a network blip         | Retried once after 60 s. If it fails again: previous data restored and redeployed, run marked failed, retry 45 minutes later.            |
| Crawl output fails schema validation    | Same as above — invalid data is never committed or published.                                                                            |
| A few career pages can't be read        | Normal: the crawl succeeds, their previous jobs stay listed, and the status page lists them under "Career pages that couldn't be read".  |
| Pushing the data commit fails           | Retried 4 times; the site still deploys the new data from that run.                                                                      |
| Another Pages deployment is in progress | Deploy waits and retries (up to 3 attempts over ~7 minutes).                                                                             |
| The live site isn't serving the build   | Checked via `/build.json` after deploying; redeployed once, then the run fails with an error naming the cause.                           |
| Anything above ultimately fails         | The run shows red in Actions (with the reason), the status page shows it, and the next sync is scheduled anyway — the chain never stops. |

## One setting to check

**Settings → Pages → Source must be "GitHub Actions".** If it is "Deploy from a branch", GitHub runs its own
"pages build and deployment" on every data commit, which collides with this workflow's deploy (that caused the
failed run on 2 Oct 2026). The workflow tries to switch it automatically and warns in the run log; the status page
also flags it.

## Status page

`/status/` (linked as "System status" in every footer) checks, live in the visitor's browser:

- **Website** — the page loaded and which build is live (`/build.json`).
- **Job data** — age of the last sync: up to date (≤ 3 h 45 min), late (≤ 6 h), or out of date.
- **Automatic sync** — the latest "Crawl and deploy" runs from GitHub's public API: running, succeeded, failed.
- **Career pages** — how many were read on the last sync, and which ones failed and why.
- **Publishing** — whether the website serves the newest data committed to the repository.

It also lists the recent sync history with links to each run. The footer dot (green / amber / red) reflects the
data's age without calling GitHub.
