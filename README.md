# Cov & Leam Crime Map

Three years of police.uk street-level crime for Coventry, Leamington Spa, Warwick and Kenilworth, drawn as a hex map for students. It has filters for every police.uk category, "Personal safety" and "House hunting" views, a 36-month timeline you can play, per-area breakdowns (streets, venues, outcomes), plain-English guides for each crime type, and a live feed of local crime news.

## How it works: git is the database

```
police.uk API ──(daily GH Action)──► data/crimes/YYYY-MM.json ──(commit → Amplify build)──► public/data/crimes-<latest>.json ──► browser
local RSS ──(every 30 min GH Action + Claude)──► data/news.json ──(commit [skip-cd])──► /api/news reads it from GitHub ──► browser
```

- **No database, no server load.** 160k crimes pack into a 1.4 MB columnar JSON file (about 360 KB gzipped) that the browser loads once and filters itself in milliseconds (`src/lib/crimeData.ts`).
- **police.uk updates monthly,** about 7 to 8 weeks after each month ends. `police-data.yml` checks daily. When a month lands it commits the new file (plus refreshed outcomes for the last 3 months), and Amplify rebuilds. Old months are never deleted, so history keeps growing past police.uk's 36-month window.
- **News runs every 30 minutes.** `news.yml` reads five RSS feeds (BBC Coventry & Warwickshire, CoventryLive crime/Coventry/Leamington, Leamington Courier). It sends only unseen stories to Claude, which decides whether each is local crime and extracts the category and street or area. The job then places the story using our own police.uk street list (`jobs/news/gazetteer.mjs`, no geocoding service). It commits with `[skip-cd]`, so the site doesn't rebuild; `/api/news` reads the committed file from GitHub and caches it for 10 minutes.
- The browser never talks to police.uk, and the site holds no secrets.

## Local development

```bash
npm install
npm run dev          # packs data/crimes → public/data, then next dev
npm run build        # production build (prebuild runs the packer)
```

Refresh data by hand:

```bash
node scripts/fetch-crimes.mjs                          # adds any new police.uk month
cd jobs/news && npm install && node fetch-news.mjs     # needs ANTHROPIC_API_KEY
node jobs/news/fetch-news.mjs --dry-run                # feeds + geocoder check, no Claude call
```

## Deploying

1. **GitHub repo:** push this folder. Add the repo secret `ANTHROPIC_API_KEY` (Settings → Secrets → Actions), used only by the news job.
2. **Amplify:** connect the repo's `main` branch; `amplify.yml` is included (Next.js SSR). Environment variables:
   - `NEWS_JSON_URL` = `https://api.github.com/repos/<owner>/<repo>/contents/data/news.json?ref=main`
   - `GITHUB_TOKEN` = a fine-grained token with **read-only Contents** access to this repo (only needed if the repo is private)
3. Run both workflows once from the Actions tab (`workflow_dispatch`) to check they work.

**Actions minutes:** the news job runs 48 times a day, and each run is billed as at least 1 minute, so about 1,450 minutes a month. That fits inside a private repo's 2,000 free minutes; a public repo has no limit. To halve it, change the cron in `news.yml` to hourly.

## Honest limits (also shown in the app)

- No times. police.uk gives a month only, so the map can't show "risky after 10pm".
- Locations are snapped to anonymous points (a street or a venue such as "Supermarket"). Hexes smooth this out.
- Counts show volume, not personal risk. Busy places have more crime because they have more people.
- News pins cover the unusual, not the everyday. They're kept separate from the counts and always link to the source.

## Layout

| Path | What |
|---|---|
| `data/crimes/` | one police.uk month per file, one crime per line: `[lat, lng, category, street, outcome]` |
| `data/news.json` | news feed + ids already classified |
| `data/places.json` | OpenStreetMap place names (suburbs, towns, stations) used for labels, search and news geocoding |
| `scripts/pack.mjs` | build step: compact monthly files → browser file; copies MapLibre's worker into `public/` |
| `scripts/fetch-crimes.mjs` | police.uk fetcher (tiles the area to stay under the API's 10k-per-query cap) |
| `jobs/news/` | the news job (own `package.json` so the Action installs two packages, not Next.js) |
| `src/lib/crimeData.ts` | typed-array store + every aggregation the UI uses |
| `src/lib/categories.ts`, `links.ts` | guide text and checked links per category |

Crime data: police.uk, Open Government Licence v3.0. Map: © OpenStreetMap contributors, tiles by OpenFreeMap.
