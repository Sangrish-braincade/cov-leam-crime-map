// Turns "Earlsdon Avenue North, Earlsdon, Coventry" into a point, using only
// our own data: police.uk street names (with their snap-point coordinates) and
// the OpenStreetMap place names in data/places.json. No geocoding service.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const COS = Math.cos((52.37 * Math.PI) / 180);
const km = (a, b) => Math.hypot((a.lat - b.lat) * 111, (a.lng - b.lng) * 111 * COS);
const BOUNDS = { s: 52.255, w: -1.66, n: 52.475, e: -1.4 };
const PLACE_TYPE = /\/|^(Parking Area|Supermarket|Shopping Area|Petrol Station|Nightclub|Hospital|Police Station|Pedestrian Subway|Hotel|Prison)$/;

export function norm(s) {
  return (s ?? "")
    .toLowerCase()
    .replace(/[’'.]/g, "")
    .replace(/\broyal leamington spa\b/g, "leamington spa")
    .replace(/\bleamington\b(?! spa)/g, "leamington spa")
    .replace(/\bst\b/g, "saint")
    .replace(/\brd\b/g, "road")
    .replace(/\bave\b/g, "avenue")
    .replace(/\s+/g, " ")
    .trim();
}

export function loadGazetteer(root) {
  const places = JSON.parse(readFileSync(join(root, "data", "places.json"), "utf8")).map(([name, kind, lat, lng]) => ({ name, kind, lat, lng }));
  const byPlace = new Map();
  for (const p of places) {
    byPlace.set(norm(p.name.replace(/ station$/, "")), p);
    byPlace.set(norm(p.name), p);
  }
  byPlace.set("coventry", places.find((p) => p.name === "Coventry city centre") ?? byPlace.get("coventry"));
  byPlace.set("leamington spa", places.find((p) => p.name === "Leamington town centre") ?? byPlace.get("leamington spa"));

  // street -> clusters of snap points (the same name recurs across villages)
  const dir = join(root, "data", "crimes");
  const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort().slice(-12);
  const pts = new Map();
  for (const f of files) {
    for (const [lat, lng, , street] of JSON.parse(readFileSync(join(dir, f), "utf8")).crimes) {
      if (PLACE_TYPE.test(street)) continue;
      const k = norm(street);
      if (!pts.has(k)) pts.set(k, new Map());
      pts.get(k).set(`${lat},${lng}`, { lat, lng });
    }
  }
  const streets = new Map();
  for (const [k, m] of pts) {
    const clusters = [];
    for (const p of m.values()) {
      const hit = clusters.find((c) => km(c, p) < 1.5);
      if (hit) {
        hit.n++;
        hit.lat += (p.lat - hit.lat) / hit.n;
        hit.lng += (p.lng - hit.lng) / hit.n;
      } else clusters.push({ lat: p.lat, lng: p.lng, n: 1 });
    }
    streets.set(k, clusters);
  }

  const nearestArea = (pt) => {
    let best = null;
    let bestD = Infinity;
    for (const p of places) {
      if (!["suburb", "neighbourhood", "town", "village", "city"].includes(p.kind)) continue;
      const d = km(p, pt);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  };

  const inBounds = (p) => p.lat >= BOUNDS.s && p.lat <= BOUNDS.n && p.lng >= BOUNDS.w && p.lng <= BOUNDS.e;

  /** { street, area, town } -> { label, lat, lng, precision } | null */
  return function locate({ street, area, town }) {
    const hint = byPlace.get(norm(area)) ?? byPlace.get(norm(town));
    const clusters = street ? streets.get(norm(street)) : undefined;
    if (clusters?.length) {
      let pick = null;
      if (clusters.length === 1) pick = clusters[0];
      else if (hint) {
        const sorted = [...clusters].sort((a, b) => km(a, hint) - km(b, hint));
        if (km(sorted[0], hint) < 4) pick = sorted[0];
      }
      if (pick && inBounds(pick)) {
        const near = nearestArea(pick);
        return { label: `${street}${near ? `, ${near.name}` : ""}`, lat: +pick.lat.toFixed(5), lng: +pick.lng.toFixed(5), precision: "street" };
      }
    }
    const a = byPlace.get(norm(area));
    if (a && inBounds(a) && !["town", "city"].includes(a.kind)) {
      return { label: a.name, lat: a.lat, lng: a.lng, precision: "area" };
    }
    return null;
  };
}
