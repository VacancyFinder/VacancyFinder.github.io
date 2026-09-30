# VacancyFinder

A directory of Sri Lankan employers (Colombo Stock Exchange-listed companies and tech firms) with links to each
company's own careers page or website.

**Live site:** https://vacancyfinder.github.io/

## Repository layout

| Path | What it is |
|---|---|
| `index.html`, `assets/` | The static site. GitHub Pages serves it straight from the root of `main` (no build step). |
| `data/companies.json`, `data/groups.json` | The directory data. The site loads these at runtime, so it always matches what's committed. |
| `data/sources/` | Hand-maintained source lists that the importer reads. |
| `data/crawl-targets.json`, `data/reports/` | Importer output for the (future) careers-page crawler. |
| `packages/shared` | Zod schemas and shared helpers (industries, URLs). |
| `packages/crawler` | The importer (`src/import`) and its tests. |
| `apps/web` | Tests for the site's logic (`assets/lib.js`) and its consistency with the data. |

## Development

Requires Node 20+ and pnpm 9 (`corepack enable`).

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm import:cse                     # regenerate data/*.json from data/sources/
python3 -m http.server 8000         # preview the site at http://localhost:8000
```

To change the directory, edit `data/sources/*.json` (or hand-editable fields in `data/companies.json`), run
`pnpm import:cse`, and commit the regenerated files. CI fails if the committed data doesn't match the importer's
output. Once merged to `main`, GitHub Pages republishes the site automatically.
