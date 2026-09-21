// Address search over every named street in the area (OpenStreetMap), so people can
// type their own address. police.uk has no house-level data, so an address resolves
// to its street: "10 Weeden Close, Coventry CV2" -> "Weeden Close".

export type Street = {
  key: string;
  name: string;
  norm: string;
  area: string;
  town: string;
  lat: number;
  lng: number;
  pts: [number, number][]; // [lat, lng] points along the street
};

export type StreetSearch = {
  query: string; // the street part we searched for, after stripping number / postcode / town
  results: Street[];
  suggestions: Street[]; // close spellings, when nothing matched
};

const ABBREV: Record<string, string> = {
  rd: "road", st: "street", ave: "avenue", av: "avenue", ln: "lane", cl: "close", dr: "drive", cres: "crescent", cr: "crescent",
  gdns: "gardens", gdn: "gardens", pl: "place", ct: "court", sq: "square", gr: "grove", gro: "grove", ter: "terrace", terr: "terrace",
  pde: "parade", wk: "walk", hl: "hill", pk: "park", mws: "mews",
};
const TOWN_WORDS = "coventry|royal leamington spa|leamington spa|leamington|leam|warwick|kenilworth|whitnash|west midlands|warwickshire|uk|united kingdom|england";
const TOWNS = new RegExp(`\\b(${TOWN_WORDS})\\b`, "g");
const TRAILING_TOWN = new RegExp(`\\s+(${TOWN_WORDS})\\s*$`);

export function normStreet(s: string): string {
  const words = s
    .toLowerCase()
    .replace(/[’'`.]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  // expand abbreviations anywhere ("earlsdon ave north"), except a leading "st", which is Saint
  return words.map((w, i) => (w === "saint" ? "st" : i === 0 && w === "st" ? "st" : ABBREV[w] ?? w)).join(" ");
}

/** "Flat 2, 10a Weeden Cl, Coventry CV2 1AB" -> { street: "weeden close", locality: "" } */
export function parseAddress(input: string): { street: string; locality: string } {
  let s = input.toLowerCase();
  s = s.replace(/\b[a-z]{1,2}\d[a-z\d]?\s*\d[a-z]{2}\b/g, " "); // full postcode
  s = s.replace(/\bcv\d{1,2}\b/g, " "); // postcode district
  s = s.replace(/\b(flat|apartment|apt|unit|room|house)\s*\w+\b,?/g, " ");
  s = s.replace(/^\s*\d+[a-z]?(\s*[-/]\s*\d+[a-z]?)?\b[\s,]*/, ""); // leading house number / range
  const parts = s.split(",").map((p) => p.trim()).filter(Boolean);
  let street = (parts[0] ?? "").trim();
  let locality = parts.slice(1).join(" ");
  // drop a town only when it trails the street ("weeden close coventry"), never inside it ("warwick road")
  for (;;) {
    const m = street.match(TRAILING_TOWN);
    if (!m || m.index === 0) break;
    street = street.slice(0, m.index).trim();
  }
  return { street: normStreet(street), locality: normStreet(locality) };
}

function lev(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 3) return 9;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

export class StreetIndex {
  readonly streets: Street[];

  constructor(raw: [string, [number, number][]][], areas: { name: string; kind: string; lat: number; lng: number }[]) {
    const named = areas.filter((a) => ["suburb", "neighbourhood", "village", "town"].includes(a.kind));
    const towns = areas.filter((a) => ["town", "city"].includes(a.kind));
    this.streets = raw.map(([name, pts], i) => {
      const p = pts.map(([la, ln]) => [la / 1e5, ln / 1e5] as [number, number]);
      const lat = p.reduce((s, x) => s + x[0], 0) / p.length;
      const lng = p.reduce((s, x) => s + x[1], 0) / p.length;
      let area = "";
      let best = Infinity;
      for (const a of named) {
        const d = (a.lat - lat) ** 2 + ((a.lng - lng) * 0.61) ** 2;
        if (d < best) {
          best = d;
          area = a.name;
        }
      }
      let town = "";
      best = Infinity;
      for (const t of towns) {
        const d = (t.lat - lat) ** 2 + ((t.lng - lng) * 0.61) ** 2;
        if (d < best) {
          best = d;
          town = t.name;
        }
      }
      return { key: `${i}`, name, norm: normStreet(name), area, town, lat, lng, pts: p };
    });
  }

  search(input: string, limit = 8): StreetSearch {
    const { street, locality } = parseAddress(input);
    if (street.length < 2) return { query: street, results: [], suggestions: [] };
    const exact: Street[] = [];
    const starts: Street[] = [];
    const contains: Street[] = [];
    for (const s of this.streets) {
      if (s.norm === street) exact.push(s);
      else if (s.norm.startsWith(street)) starts.push(s);
      else if (s.norm.includes(street)) contains.push(s);
    }
    // within each tier, longer streets (more mapped segments) first: the main Warwick Road before a lane
    const bySize = (a: Street, b: Street) => b.pts.length - a.pts.length;
    let results = [...exact.sort(bySize), ...starts.sort(bySize), ...contains.sort(bySize)];
    // "Church Lane, Eastern Green" / "Warwick Road, Kenilworth": prefer the one in that area or town
    if (locality) {
      const hit = (r: Street) => [r.area, r.town].some((a) => {
        const n = normStreet(a);
        return n && (n.includes(locality) || locality.includes(n));
      });
      const inArea = results.filter(hit);
      if (inArea.length) results = [...inArea, ...results.filter((r) => !inArea.includes(r))];
    }
    results = results.slice(0, limit);
    let suggestions: Street[] = [];
    if (!results.length) {
      const seen = new Set<string>();
      suggestions = this.streets
        .map((s) => ({ s, d: lev(street, s.norm) }))
        .filter((x) => x.d <= 3)
        .sort((a, b) => a.d - b.d)
        .filter((x) => (seen.has(x.s.norm) ? false : (seen.add(x.s.norm), true)))
        .slice(0, 4)
        .map((x) => x.s);
    }
    return { query: street, results, suggestions };
  }
}

export async function loadStreetIndex(url: string, areas: { name: string; kind: string; lat: number; lng: number }[]): Promise<StreetIndex> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Couldn't load the street list (${res.status})`);
  return new StreetIndex(await res.json(), areas);
}
