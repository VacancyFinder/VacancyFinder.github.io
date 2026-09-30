#!/usr/bin/env bash
# Start a job sync now (crawl → build → deploy) on GitHub Actions, outside the 3-hour schedule.
#
#   scripts/trigger-sync.sh                 # everything
#   scripts/trigger-sync.sh wso2,dialog     # only these crawl targets
#
# Uses the GitHub CLI when it's installed and logged in; otherwise a token in GITHUB_TOKEN (or GH_TOKEN)
# with the "Actions: read and write" permission for this repository. Also usable from an external
# scheduler (e.g. cron-job.org or a server's crontab) as a backup to GitHub's own schedule.
set -euo pipefail

REPO="${REPO:-VacancyFinder/VacancyFinder.github.io}"
WORKFLOW="crawl-and-deploy.yml"
REF="${REF:-main}"
ONLY="${1:-}"

if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  gh workflow run "$WORKFLOW" --repo "$REPO" --ref "$REF" -f only="$ONLY"
  echo "Sync started. Follow it with: gh run watch --repo $REPO \$(gh run list --repo $REPO --workflow $WORKFLOW -L1 --json databaseId -q '.[0].databaseId')"
  exit 0
fi

TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-}}"
if [ -z "$TOKEN" ]; then
  echo "Needs the GitHub CLI (gh auth login) or a token in GITHUB_TOKEN." >&2
  exit 1
fi

code=$(curl -sS -o /dev/stderr -w "%{http_code}" -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "https://api.github.com/repos/$REPO/actions/workflows/$WORKFLOW/dispatches" \
  -d "{\"ref\":\"$REF\",\"inputs\":{\"only\":\"$ONLY\"}}")
if [ "$code" = "204" ]; then
  echo "Sync started: https://github.com/$REPO/actions/workflows/$WORKFLOW"
else
  echo "GitHub refused the request (HTTP $code)." >&2
  exit 1
fi
