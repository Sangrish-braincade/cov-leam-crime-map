// Build step: data/crimes/*.json  ->  public/data/crimes-<latest>.json (what the
// browser loads) + src/generated/dataset.ts (what the server components import).
//
// The packed file is columnar so it gzips well and loads straight into typed arrays:
//   points      flat [lat*1e5, lng*1e5, ...] — police.uk "snap points"
//   pointStreet street index per point; pointArea nearest place index per point
//   monthOffsets row index where each month starts (rows are grouped by month)
//   p           point index per row, delta-encoded within each month
//   c, o        category / outcome index per row
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "data", "crimes");
const PUB = join(ROOT, "public", "data");
const GEN = join(ROOT, "src", "generated");

// Fixed order — the client keys everything by slug, never by index.
const CATS = [
  "violent-crime", "robbery", "theft-from-the-person", "public-order", "possession-of-weapons",
  "burglary", "vehicle-crime", "bicycle-theft", "criminal-damage-arson",
  "shoplifting", "other-theft",
  "anti-social-behaviour", "drugs", "other-crime",
];
// police.uk replaces the street with a place type when the location is a venue.
const PLACE_TYPE = /\/|^(Parking Area|Supermarket|Shopping Area|Petrol Station|Nightclub|Hospital|Police Station|Pedestrian Subway|Hotel|Prison)$/;

const files = readdirSync(SRC).filter((f) => /^\d{4}-\d{2}\.json$/.test(f)).sort();
const months = files.map((f) => f.slice(0, 7));
const places = JSON.parse(readFileSync(join(ROOT, "data", "places.json"), "utf8"));
const areaPlaces = places.filter((p) => ["suburb", "neighbourhood", "town", "village", "city"].includes(p[1]));

const pointIdx = new Map();
const points = [];
const pointStreet = [];
const streetIdx = new Map();
const streets = [];
const outcomes = [null];
const outcomeIdx = new Map([[null, 0]]);
const catIdx = new Map(CATS.map((c, i) => [c, i]));
const monthOffsets = [0];
const P = [];
const C = [];
const O = [];
const monthTotals = [];
let btp = 0;

for (const f of files) {
  const { crimes } = JSON.parse(readFileSync(join(SRC, f), "utf8"));
  const rows = [];
  for (const [lat, lng, cat, street, outcome, force] of crimes) {
    if (!catIdx.has(cat)) throw new Error(`unknown category ${cat} in ${f}`);
    const key = `${lat},${lng}`;
    let pi = pointIdx.get(key);
    if (pi === undefined) {
      pi = points.length / 2;
      pointIdx.set(key, pi);
      points.push(Math.round(lat * 1e5), Math.round(lng * 1e5));
      let si = streetIdx.get(street);
      if (si === undefined) {
        si = streets.length;
        streetIdx.set(street, si);
        streets.push(street);
      }
      pointStreet.push(si);
    }
    let oi = outcomeIdx.get(outcome);
    if (oi === undefined) {
      oi = outcomes.length;
      outcomeIdx.set(outcome, oi);
      outcomes.push(outcome);
    }
    if (force === "BTP") btp++;
    rows.push([pi, catIdx.get(cat), oi]);
  }
  rows.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  let prev = 0;
  for (const [pi, ci, oi] of rows) {
    P.push(pi - prev);
    prev = pi;
    C.push(ci);
    O.push(oi);
  }
  monthOffsets.push(P.length);
  monthTotals.push(rows.length);
}

// nearest named place for every point (for "Around Earlsdon" style labels)
const nPoints = points.length / 2;
const cosLat = Math.cos((52.37 * Math.PI) / 180);
const pointArea = new Array(nPoints);
for (let i = 0; i < nPoints; i++) {
  const lat = points[2 * i] / 1e5;
  const lng = points[2 * i + 1] / 1e5;
  let best = 0;
  let bestD = Infinity;
  for (let j = 0; j < areaPlaces.length; j++) {
    const dy = areaPlaces[j][2] - lat;
    const dx = (areaPlaces[j][3] - lng) * cosLat;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = j;
    }
  }
  pointArea[i] = best;
}

// search index: one entry per street per cluster (Church Lane exists in five villages)
const crimesPerPoint = new Array(nPoints).fill(0);
{
  let r = 0;
  for (let m = 0; m < months.length; m++) {
    let pi = 0;
    for (; r < monthOffsets[m + 1]; r++) {
      pi += P[r];
      crimesPerPoint[pi]++;
    }
  }
}
const byStreet = new Map();
for (let i = 0; i < nPoints; i++) {
  const name = streets[pointStreet[i]];
  if (PLACE_TYPE.test(name) || /^[A-Z]\d+$/.test(name)) continue;
  if (!byStreet.has(name)) byStreet.set(name, []);
  byStreet.get(name).push(i);
}
const search = [];
for (const [name, pts] of byStreet) {
  const clusters = [];
  for (const i of pts) {
    const lat = points[2 * i] / 1e5;
    const lng = points[2 * i + 1] / 1e5;
    const hit = clusters.find((c) => Math.hypot((c.lat - lat) * 111, (c.lng - lng) * 111 * cosLat) < 1.5);
    if (hit) {
      hit.members.push(i);
      hit.lat = (hit.lat * (hit.members.length - 1) + lat) / hit.members.length;
      hit.lng = (hit.lng * (hit.members.length - 1) + lng) / hit.members.length;
    } else clusters.push({ lat, lng, members: [i] });
  }
  for (const c of clusters) {
    const n = c.members.reduce((s, i) => s + crimesPerPoint[i], 0);
    search.push([name, pointArea[c.members[0]], Math.round(c.lat * 1e5), Math.round(c.lng * 1e5), n]);
  }
}
search.sort((a, b) => b[4] - a[4]);

const latest = months.at(-1);
const file = `crimes-${latest}.json`;
const packed = {
  months,
  cats: CATS,
  outcomes,
  streets,
  placeTypes: streets.map((s) => (PLACE_TYPE.test(s) ? 1 : 0)),
  areas: areaPlaces.map(([name, kind, lat, lng]) => [name, kind, Math.round(lat * 1e5), Math.round(lng * 1e5)]),
  points,
  pointStreet,
  pointArea,
  monthOffsets,
  p: P,
  c: C,
  o: O,
  search,
};

rmSync(PUB, { recursive: true, force: true });
mkdirSync(PUB, { recursive: true });
mkdirSync(GEN, { recursive: true });
const json = JSON.stringify(packed);
writeFileSync(join(PUB, file), json);

const [y, mo] = latest.split("-").map(Number);
const next = new Date(Date.UTC(y, mo, 1)); // the month after `latest`
const dataset = {
  file: `/data/${file}`,
  bytes: json.length,
  months,
  latest,
  nextMonth: next.toISOString().slice(0, 7),
  total: P.length,
  btp,
  points: nPoints,
  monthTotals,
  jumpTo: places
    .filter((p) => ["campus", "centre", "town"].includes(p[1]) || ["Canley", "Earlsdon", "Tile Hill", "Cannon Park", "Hillfields", "Lillington", "Chapelfields", "Stoke Aldermoor"].includes(p[0]))
    .map(([name, kind, lat, lng]) => ({ name, kind, lat, lng })),
  packedAt: new Date().toISOString(),
};
writeFileSync(
  join(GEN, "dataset.ts"),
  `// Generated by scripts/pack.mjs — do not edit.\nexport const DATASET = ${JSON.stringify(dataset, null, 2)} as const;\n`,
);
// MapLibre v6 starts its web worker from a URL next to its own module, which a
// bundled chunk doesn't have. Serve the worker (and the shared chunk it imports)
// from public/ under a versioned path, and point MapLibre at it.
const mlDir = join(ROOT, "node_modules", "maplibre-gl");
const mlVersion = JSON.parse(readFileSync(join(mlDir, "package.json"), "utf8")).version;
const mlOut = join(ROOT, "public", "maplibre", mlVersion);
rmSync(join(ROOT, "public", "maplibre"), { recursive: true, force: true });
mkdirSync(mlOut, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) copyFileSync(join(mlDir, "dist", f), join(mlOut, f));
writeFileSync(
  join(GEN, "assets.ts"),
  `// Generated by scripts/pack.mjs — do not edit.\nexport const MAPLIBRE_WORKER_URL = "/maplibre/${mlVersion}/maplibre-gl-worker.mjs";\n`,
);

console.log(`packed ${P.length} crimes, ${nPoints} points, ${months.length} months -> public/data/${file} (${(json.length / 1e6).toFixed(2)} MB)`);
