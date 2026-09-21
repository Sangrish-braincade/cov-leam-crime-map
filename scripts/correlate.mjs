// Links scraped news stories to police.uk records, so a story is never counted twice.
//
// Runs after every police.uk refresh (police-data.yml) and after every scrape (news.yml).
// For each story in data/news-archive/ it sets `police`:
//   unconfirmed  police.uk hasn't published the month yet
//   matched      police.uk records of the same category near the named place, that month
//   no-match     month published, but nothing of that category near the place
//   court        a court report: the incident month is unknown, so we don't guess
//   unplaced     no street or area named, nothing to match against
//
// police.uk gives a month, a category and an anonymised point, so a story maps to a
// small set of candidate records ("likely one of these 3"), never a single one.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CRIMES = join(ROOT, "data", "crimes");
const NEWS = join(ROOT, "data", "news-archive");
const COS = Math.cos((52.37 * Math.PI) / 180);
const km = (a, b) => Math.hypot((a.lat - b.lat) * 111, (a.lng - b.lng) * 111 * COS);
const RADIUS_KM = { street: 0.3, area: 1.0 };
// a stabbing can be recorded as violence or as possession of a weapon
const COMPATIBLE = { "violent-crime": ["violent-crime", "possession-of-weapons"], "possession-of-weapons": ["possession-of-weapons", "violent-crime"] };

const policeMonths = new Set(readdirSync(CRIMES).filter((f) => /^\d{4}-\d{2}\.json$/.test(f)).map((f) => f.slice(0, 7)));
const crimesCache = new Map();
const crimesFor = (ym) => {
  if (!crimesCache.has(ym)) crimesCache.set(ym, JSON.parse(readFileSync(join(CRIMES, `${ym}.json`), "utf8")).crimes);
  return crimesCache.get(ym);
};

// a story published in the first days of a month often reports the end of the previous one
function incidentMonths(published) {
  const d = new Date(published);
  const ym = published.slice(0, 7);
  if (d.getUTCDate() > 3) return [ym];
  const prev = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
  return [ym, prev];
}

function correlate(a) {
  if (a.court) return { status: "court" };
  if (!a.place) return { status: "unplaced" };
  const months = incidentMonths(a.published);
  if (!months.some((m) => policeMonths.has(m))) return { status: "unconfirmed", months };
  const cats = COMPATIBLE[a.category] ?? [a.category];
  const radius = RADIUS_KM[a.place.precision] ?? 0.3;
  const byPoint = new Map();
  for (const m of months.filter((x) => policeMonths.has(x))) {
    for (const [lat, lng, cat, street] of crimesFor(m)) {
      if (!cats.includes(cat)) continue;
      const d = km({ lat, lng }, a.place);
      if (d > radius) continue;
      const key = `${lat},${lng}`;
      const hit = byPoint.get(key) ?? { street, lat, lng, month: m, n: 0, d };
      hit.n++;
      byPoint.set(key, hit);
    }
  }
  const points = [...byPoint.values()].sort((x, y) => x.d - y.d);
  const candidates = points.reduce((s, p) => s + p.n, 0);
  if (!candidates) return { status: "no-match", months };
  return {
    status: "matched",
    months,
    candidates,
    nearest: points.slice(0, 5).map(({ street, lat, lng, month, n, d }) => ({ street, lat, lng, month, n, metres: Math.round(d * 1000) })),
  };
}

const tally = {};
for (const f of readdirSync(NEWS).filter((x) => /^\d{4}-\d{2}\.json$/.test(x))) {
  const path = join(NEWS, f);
  const file = JSON.parse(readFileSync(path, "utf8"));
  const before = JSON.stringify(file);
  for (const a of file.articles) {
    a.police = correlate(a);
    tally[a.police.status] = (tally[a.police.status] ?? 0) + 1;
  }
  if (JSON.stringify(file) !== before) writeFileSync(path, JSON.stringify(file, null, 1) + "\n");
}
console.log("news ↔ police.uk:", JSON.stringify(tally));
