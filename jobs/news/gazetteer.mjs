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
    .replace(/\bshopping cent(re|er)\b/g, "")
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
  const original = new Map(); // normalised -> name as police.uk writes it
  for (const f of files) {
    for (const [lat, lng, , street] of JSON.parse(readFileSync(join(dir, f), "utf8")).crimes) {
      if (PLACE_TYPE.test(street)) continue;
      const k = norm(street);
      if (!pts.has(k)) pts.set(k, new Map());
      if (!original.has(k)) original.set(k, street);
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

  /** True when a named place is inside the map area (a town, suburb, village or landmark we know). */
  const isLocal = (name) => {
    const p = byPlace.get(norm(name));
    return Boolean(p && inBounds(p));
  };

  /** { street, area, town } -> { label, lat, lng, precision } | null */
  const locate = function locate({ street, area, town }) {
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
    // a landmark named as the "street" ("Lower Precinct Shopping Centre"), then the area
    for (const name of [street, area]) {
      const a = byPlace.get(norm(name));
      if (a && inBounds(a) && !["town", "city"].includes(a.kind)) {
        return { label: a.name, lat: a.lat, lng: a.lng, precision: "area" };
      }
    }
    return null;
  };
  // ---- free-text extraction (for scraped articles) ----
  // Street names are matched case-sensitively as police.uk writes them ("Clay Lane"),
  // multi-word only, and never "The ..." (The Green Party, The Square Mile).
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // names that are also areas ("Tile Hill", "Far Gosford Street") are matched as areas, not streets
  const matchable = [...original.values()].filter((n) => /\s/.test(n) && !/^The /.test(n) && !/^[A-Z]\d/.test(n) && !byPlace.has(norm(n)));
  matchable.sort((a, b) => b.length - a.length);
  const streetRe = new RegExp(`\\b(${matchable.map(esc).join("|")})\\b`, "g");
  const AREA_STOP = new Set(["Paradise", "St John's", "Green Lane", "Mill End"]);
  const areaNames = places
    .filter((p) => ["suburb", "neighbourhood", "village", "landmark", "campus", "centre"].includes(p.kind) && !AREA_STOP.has(p.name))
    .map((p) => p.name)
    .sort((a, b) => b.length - a.length);
  const areaRe = new RegExp(`\\b(${areaNames.map(esc).join("|")})\\b`, "g");
  const TOWN_CENTRES = [
    [/\bCoventry\b/, byPlace.get("coventry")],
    [/\bLeamington\b/, byPlace.get("leamington spa")],
    [/\bKenilworth\b/, byPlace.get("kenilworth")],
    [/\bWarwick\b(?! Crown Court| University)/, byPlace.get("warwick")],
  ];

  /** text -> { streets: [{name, lat, lng, mentions}], areas: [{name, lat, lng}], place } */
  const extract = (text) => {
    const areaHits = new Map();
    for (const m of text.matchAll(areaRe)) {
      const p = byPlace.get(norm(m[1]));
      if (p && inBounds(p)) areaHits.set(p.name, p);
    }
    const areas = [...areaHits.values()].map((p) => ({ name: p.name, lat: p.lat, lng: p.lng }));
    const towns = TOWN_CENTRES.filter(([re, p]) => p && re.test(text)).map(([, p]) => p);

    const counts = new Map();
    for (const m of text.matchAll(streetRe)) counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
    const streetsOut = [];
    for (const [name, mentions] of counts) {
      const clusters = streets.get(norm(name)) ?? [];
      let pick = null;
      if (clusters.length === 1) pick = clusters[0];
      else if (clusters.length > 1) {
        // same name in several places: use a named area, then a named town, and only if one cluster is clearly nearest
        for (const hints of [areas, towns]) {
          if (pick || !hints.length) continue;
          const scored = clusters.map((c) => ({ c, d: Math.min(...hints.map((h) => km(c, h))) })).sort((a, b) => a.d - b.d);
          if (scored[0].d < 3 && (scored.length === 1 || scored[1].d > scored[0].d + 1.5)) pick = scored[0].c;
        }
      }
      if (pick && inBounds(pick)) streetsOut.push({ name, lat: +pick.lat.toFixed(5), lng: +pick.lng.toFixed(5), mentions });
    }
    streetsOut.sort((a, b) => b.mentions - a.mentions);

    let place = null;
    if (streetsOut.length) {
      const s0 = streetsOut[0];
      const near = nearestArea(s0);
      place = { label: `${s0.name}${near ? `, ${near.name}` : ""}`, lat: s0.lat, lng: s0.lng, precision: "street" };
    } else if (areas.length) {
      place = { label: areas[0].name, lat: areas[0].lat, lng: areas[0].lng, precision: "area" };
    }
    return { streets: streetsOut, areas, place };
  };

  return { locate, isLocal, extract };
}
