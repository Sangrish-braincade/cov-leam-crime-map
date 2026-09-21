# Cov & Leam Crime Map

Three years of police.uk street-level crime for Coventry, Leamington Spa, Warwick and Kenilworth, drawn as a hex map for students. It has filters for every police.uk category, "Personal safety" and "House hunting" views, a 36-month timeline you can play, per-area breakdowns (streets, venues, outcomes), plain-English guides for each crime type, and a live feed of local crime news.

## How it works: git is the database

```
police.uk API ──(daily GH Action)──► data/crimes/YYYY-MM.json ──(commit → Amplify build)──► public/data/crimes-<latest>.json ──► browser
publisher sitemaps + BBC RSS ──(4×/day GH Action, polite scraper)──► data/news-archive/YYYY-MM.json ──► correlate.mjs ──(commit [skip-cd])──► /api/news ──► browser
```

- **No database, no server load.** 160k crimes pack into a 1.4 MB columnar JSON file (about 360 KB gzipped) that the browser loads once and filters itself in milliseconds (`src/lib/crimeData.ts`).
- **police.uk updates monthly,** about 7 to 8 weeks after each month ends. `police-data.yml` checks daily. When a month lands it commits the new file (plus refreshed outcomes for the last 3 months), and Amplify rebuilds. Old months are never deleted, so history keeps growing past police.uk's 36-month window.
- **News, four times a day.** `news.yml` runs `jobs/news/scrape.mjs`. It reads CoventryLive's monthly article sitemap and the BBC Coventry & Warwickshire RSS, keeps local-news URLs that look like crime, and fetches each page politely: robots.txt rules are obeyed and CoventryLive's 10-second crawl delay is honoured. From the page it keeps only facts: headline, publish time, a police.uk category (keyword rules), a court-report flag, and the streets and areas it names. Those are found by string-matching against police.uk's own street names and `data/places.json`, so there's no geocoding service and pins land on police.uk's own anonymised points. **Article text is never stored and never sent to an AI model**; these publishers opt out of AI crawlers. Warwickshire World is left out because its Cloudflare challenges automated clients.
- **News ↔ police.uk.** `scripts/correlate.mjs` runs after every scrape and every police.uk refresh. For months police.uk has published, a story is *matched* to the same-category records within ~300 m of its street (~1 km of its area), "likely one of N". Matched stories are never counted again. For months police.uk hasn't published, stories show as *not yet in police data*: hollow pins and a list tag, kept out of the heat colours, because news covers well under 1% of recorded crime.
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
cd jobs/news && npm install && cd ../..
node jobs/news/scrape.mjs --backfill 3                 # every crime-looking article from the last 3 months (~1 h: 10 s crawl delay)
node jobs/news/scrape.mjs                              # daily: just the new ones
node scripts/correlate.mjs                             # link stories to police.uk records
```

## Deploying

1. **GitHub repo:** push this folder. No secrets are needed; nothing calls an AI model.
2. **Amplify:** connect the repo's `main` branch; `amplify.yml` is included (Next.js SSR). One environment variable, and it isn't a secret:
   - `NEWS_BASE_URL` = `https://raw.githubusercontent.com/<owner>/<repo>/main`
3. Run both workflows once from the Actions tab (`workflow_dispatch`) to check they work.

**Actions minutes:** the news job runs 4 times a day for a few minutes each (about 20 new articles a day at 10 s apart), roughly 400 minutes a month. That's well inside a private repo's 2,000 free minutes.

## Honest limits (also shown in the app)

- No times. police.uk gives a month only, so the map can't show "risky after 10pm".
- Locations are snapped to anonymous points (a street or a venue such as "Supermarket"). Hexes smooth this out.
- Counts show volume, not personal risk. Busy places have more crime because they have more people.
- News covers the unusual, not the everyday. Stories are never added to the counts; they link to the source and to their likely police.uk records.

## Layout

| Path | What |
|---|---|
| `data/crimes/` | one police.uk month per file, one crime per line: `[lat, lng, category, street, outcome]` |
| `data/news-archive/` | one file per month of scraped crime stories (facts + link only), plus `_seen.json` of URLs already checked |
| `data/places.json` | OpenStreetMap place names (suburbs, towns, stations) used for labels, search and news geocoding |
| `scripts/pack.mjs` | build step: compact monthly files → browser file; copies MapLibre's worker into `public/` |
| `scripts/fetch-crimes.mjs` | police.uk fetcher (tiles the area to stay under the API's 10k-per-query cap) |
| `jobs/news/` | the news scraper and street/place gazetteer (own `package.json`: one dependency, not Next.js) |
| `scripts/correlate.mjs` | links news stories to police.uk records |
| `src/lib/crimeData.ts` | typed-array store + every aggregation the UI uses |
| `src/lib/categories.ts`, `links.ts` | guide text and checked links per category |

Crime data: police.uk, Open Government Licence v3.0. Map: © OpenStreetMap contributors, tiles by OpenFreeMap.
