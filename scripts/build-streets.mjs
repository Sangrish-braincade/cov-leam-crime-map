// OpenStreetMap street names → data/streets.json, the list behind address search.
// police.uk only names ~4,700 streets (the ones with an anonymised snap point);
// people search for their own street, so we need every named road.
//
//   node scripts/build-streets.mjs            # re-download from Overpass, then build
//   node scripts/build-streets.mjs --cached   # build from data/raw/osm_streets.tsv
//
// Each OSM road is split into many "ways"; ways with the same name within 800 m are
// one street. We keep up to 24 way-centres per street, which traces its shape well
// enough to find police.uk points along it. Map data © OpenStreetMap contributors (ODbL).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RAW = join(ROOT, "data", "raw", "osm_streets.tsv");
const OUT = join(ROOT, "data", "streets.json");
const BOUNDS = { s: 52.255, w: -1.66, n: 52.475, e: -1.4 };
const COS = Math.cos((52.37 * Math.PI) / 180);
const km = (a, b) => Math.hypot((a[0] - b[0]) * 111, (a[1] - b[1]) * 111 * COS);

if (!process.argv.includes("--cached") || !existsSync(RAW)) {
  const q = `[out:csv(name,highway,::lat,::lon;false;"\\t")][timeout:150];way["highway"]["name"]["highway"!~"^(footway|cycleway|path|bridleway|steps|track|corridor|proposed|construction)$"](52.235,-1.69,52.495,-1.37);out center qt;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "User-Agent": "cov-leam-crime-map/1.0", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ data: q }),
  });
  if (!res.ok) throw new Error(`overpass ${res.status}`);
  mkdirSync(dirname(RAW), { recursive: true });
  writeFileSync(RAW, await res.text());
}

const byName = new Map();
for (const line of readFileSync(RAW, "utf8").split("\n")) {
  const [name, , lat, lng] = line.split("\t");
  const la = Number(lat);
  const ln = Number(lng);
  if (!name || !Number.isFinite(la) || la < BOUNDS.s || la > BOUNDS.n || ln < BOUNDS.w || ln > BOUNDS.e) continue;
  if (!byName.has(name)) byName.set(name, []);
  byName.get(name).push([la, ln]);
}

const streets = [];
for (const [name, pts] of byName) {
  const clusters = [];
  for (const p of pts) {
    const hit = clusters.find((c) => c.some((q) => km(p, q) < 0.8));
    if (hit) hit.push(p);
    else clusters.push([p]);
  }
  for (const c of clusters) {
    const step = Math.max(1, Math.ceil(c.length / 24));
    const kept = c.filter((_, i) => i % step === 0);
    streets.push([name, kept.map(([a, b]) => [Math.round(a * 1e5), Math.round(b * 1e5)])]);
  }
}
streets.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1][0][0] - b[1][0][0]));
writeFileSync(OUT, `{"source":"OpenStreetMap contributors (ODbL)","streets":[\n${streets.map((s) => JSON.stringify(s)).join(",\n")}\n]}\n`);
console.log(`${byName.size} street names, ${streets.length} distinct streets -> data/streets.json`);
