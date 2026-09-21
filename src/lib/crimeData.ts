// Loads the packed police.uk file (see scripts/pack.mjs) into typed arrays and
// answers every question the UI asks with a single linear scan — 160k rows
// take a couple of milliseconds, so there is no server and no database.
import { HEX_LEVELS, hexCenter, hexKey, hexRing } from "./hex";
import { OUTCOME_GROUPS, outcomeGroup } from "./outcomes";

type Packed = {
  months: string[];
  cats: string[];
  outcomes: (string | null)[];
  streets: string[];
  placeTypes: number[];
  areas: [string, string, number, number][];
  points: number[];
  pointStreet: number[];
  pointArea: number[];
  monthOffsets: number[];
  p: number[];
  c: number[];
  o: number[];
  search: [string, number, number, number, number][];
};

export type SearchEntry = { name: string; area: string; lat: number; lng: number; n: number; kind: "street" | "place" };

type HexIndex = {
  keys: string[];
  pointHex: Uint32Array;
  hexPoints: number[][];
  centers: [number, number][];
  rings: ([number, number][] | undefined)[];
};

export type Scan = {
  total: number;
  series: Int32Array; // per month, ignores the month range
  cats: Int32Array; // per category, within range
  outcomes: Int32Array; // per outcome group, within range
  withOutcome: number;
  streets: Map<number, number>; // street index -> count, within range
};

export class CrimeData {
  readonly months: string[];
  readonly cats: string[];
  readonly streets: string[];
  readonly placeType: Uint8Array;
  readonly areas: { name: string; kind: string; lat: number; lng: number }[];
  readonly nPoints: number;
  readonly lat: Float64Array;
  readonly lng: Float64Array;
  readonly pointStreet: Uint32Array;
  readonly pointArea: Uint16Array;
  readonly monthOffsets: number[];
  readonly P: Uint16Array | Uint32Array;
  readonly C: Uint8Array;
  readonly O: Uint8Array;
  readonly outcomeToGroup: Int8Array;
  readonly search: SearchEntry[];
  private hexIndexes: HexIndex[] = [];

  constructor(d: Packed) {
    this.months = d.months;
    this.cats = d.cats;
    this.streets = d.streets;
    this.placeType = Uint8Array.from(d.placeTypes);
    this.areas = d.areas.map(([name, kind, lat, lng]) => ({ name, kind, lat: lat / 1e5, lng: lng / 1e5 }));
    this.nPoints = d.points.length / 2;
    this.lat = new Float64Array(this.nPoints);
    this.lng = new Float64Array(this.nPoints);
    for (let i = 0; i < this.nPoints; i++) {
      this.lat[i] = d.points[2 * i] / 1e5;
      this.lng[i] = d.points[2 * i + 1] / 1e5;
    }
    this.pointStreet = Uint32Array.from(d.pointStreet);
    this.pointArea = Uint16Array.from(d.pointArea);
    this.monthOffsets = d.monthOffsets;
    const n = d.p.length;
    this.P = this.nPoints < 65536 ? new Uint16Array(n) : new Uint32Array(n);
    for (let m = 0; m < this.months.length; m++) {
      let pi = 0;
      for (let r = d.monthOffsets[m]; r < d.monthOffsets[m + 1]; r++) {
        pi += d.p[r];
        this.P[r] = pi;
      }
    }
    this.C = Uint8Array.from(d.c);
    this.O = Uint8Array.from(d.o);
    const groupIds: string[] = OUTCOME_GROUPS.map((g) => g.id);
    this.outcomeToGroup = Int8Array.from(d.outcomes.map((o) => {
      const g = outcomeGroup(o);
      return g === null ? -1 : groupIds.indexOf(g);
    }));
    const streets: SearchEntry[] = d.search.map(([name, area, lat, lng, count]) => ({
      name,
      area: this.areas[area]?.name ?? "",
      lat: lat / 1e5,
      lng: lng / 1e5,
      n: count,
      kind: "street",
    }));
    const places: SearchEntry[] = this.areas.map((a) => ({ name: a.name, area: a.kind, lat: a.lat, lng: a.lng, n: 1e9, kind: "place" }));
    this.search = [...places, ...streets];
  }

  get rows(): number {
    return this.C.length;
  }

  catMask(selected: Iterable<string>): Uint8Array {
    const set = new Set(selected);
    return Uint8Array.from(this.cats.map((c) => (set.has(c) ? 1 : 0)));
  }

  hex(level: number): HexIndex {
    let idx = this.hexIndexes[level];
    if (idx) return idx;
    const keyToIdx = new Map<string, number>();
    const keys: string[] = [];
    const hexPoints: number[][] = [];
    const pointHex = new Uint32Array(this.nPoints);
    for (let i = 0; i < this.nPoints; i++) {
      const k = hexKey(this.lng[i], this.lat[i], level);
      let h = keyToIdx.get(k);
      if (h === undefined) {
        h = keys.length;
        keyToIdx.set(k, h);
        keys.push(k);
        hexPoints.push([]);
      }
      pointHex[i] = h;
      hexPoints[h].push(i);
    }
    idx = { keys, pointHex, hexPoints, centers: keys.map((k) => hexCenter(k, level)), rings: [] };
    this.hexIndexes[level] = idx;
    return idx;
  }

  ring(level: number, h: number): [number, number][] {
    const idx = this.hex(level);
    return (idx.rings[h] ??= hexRing(idx.keys[h], level));
  }

  /** Crimes per hex for the selected categories and month range [m0, m1]. */
  hexCounts(level: number, mask: Uint8Array, m0: number, m1: number): Int32Array {
    const { pointHex, keys } = this.hex(level);
    const out = new Int32Array(keys.length);
    const { P, C } = this;
    for (let r = this.monthOffsets[m0]; r < this.monthOffsets[m1 + 1]; r++) {
      if (mask[C[r]]) out[pointHex[P[r]]]++;
    }
    return out;
  }

  /** Hex counts for every single month — used to fix the colour scale while playing. */
  hexMonthlyValues(level: number, mask: Uint8Array): number[] {
    const { pointHex, keys } = this.hex(level);
    const values: number[] = [];
    const counts = new Int32Array(keys.length);
    for (let m = 0; m < this.months.length; m++) {
      counts.fill(0);
      for (let r = this.monthOffsets[m]; r < this.monthOffsets[m + 1]; r++) {
        if (mask[this.C[r]]) counts[pointHex[this.P[r]]]++;
      }
      for (let h = 0; h < counts.length; h++) if (counts[h]) values.push(counts[h]);
    }
    return values;
  }

  /** Everything the overview / area panels need, in one pass. `points` limits it to a hex. */
  scan(mask: Uint8Array, m0: number, m1: number, points?: Uint8Array): Scan {
    const series = new Int32Array(this.months.length);
    const cats = new Int32Array(this.cats.length);
    const outcomes = new Int32Array(OUTCOME_GROUPS.length);
    const streets = new Map<number, number>();
    let total = 0;
    let withOutcome = 0;
    const { P, C, O } = this;
    for (let m = 0; m < this.months.length; m++) {
      const inRange = m >= m0 && m <= m1;
      for (let r = this.monthOffsets[m]; r < this.monthOffsets[m + 1]; r++) {
        const p = P[r];
        if (points && !points[p]) continue;
        const c = C[r];
        if (inRange) cats[c]++;
        if (!mask[c]) continue;
        series[m]++;
        if (!inRange) continue;
        total++;
        const g = this.outcomeToGroup[O[r]];
        if (g >= 0) {
          outcomes[g]++;
          withOutcome++;
        }
        if (points) {
          const s = this.pointStreet[p];
          streets.set(s, (streets.get(s) ?? 0) + 1);
        }
      }
    }
    return { total, series, cats, outcomes, withOutcome, streets };
  }

  pointsOfHex(level: number, h: number): Uint8Array {
    const f = new Uint8Array(this.nPoints);
    for (const p of this.hex(level).hexPoints[h]) f[p] = 1;
    return f;
  }

  /** "Burges & Cloister Croft" — the two busiest real streets in a hex. */
  hexLabel(level: number, h: number, streets?: Map<number, number>): { title: string; area: string } {
    const idx = this.hex(level);
    const pts = idx.hexPoints[h];
    let counts = streets;
    if (!counts || counts.size === 0) {
      counts = new Map();
      for (const p of pts) counts.set(this.pointStreet[p], (counts.get(this.pointStreet[p]) ?? 0) + 1);
    }
    const named = [...counts.entries()]
      .filter(([s]) => !this.placeType[s] && !/^[A-Z]\d+$/.test(this.streets[s]))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([s]) => this.streets[s]);
    // nearest named place to the hex centre
    const [lng, lat] = idx.centers[h];
    let best = this.areas[0];
    let bestD = Infinity;
    for (const a of this.areas) {
      const d = (a.lat - lat) ** 2 + ((a.lng - lng) * 0.61) ** 2;
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    return { title: named.length ? named.join(" & ") : best.name, area: best.name };
  }

  hexOfPoint(level: number, lng: number, lat: number): number {
    const key = hexKey(lng, lat, level);
    return this.hex(level).keys.indexOf(key);
  }

  levels(): number {
    return HEX_LEVELS.length;
  }
}

export async function loadCrimeData(url: string): Promise<CrimeData> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Couldn't load crime data (${res.status})`);
  return new CrimeData(await res.json());
}

/** Class breaks from quantiles of the non-zero values, rounded to readable numbers. */
export function classBreaks(values: ArrayLike<number>, classes = 6): number[] {
  const v = Array.from(values).filter((x) => x > 0).sort((a, b) => a - b);
  if (v.length === 0) return [1];
  const qs = [0.4, 0.65, 0.82, 0.93, 0.98].slice(0, classes - 1);
  const nice = (x: number) => {
    if (x <= 10) return Math.max(1, Math.round(x));
    const mag = 10 ** Math.floor(Math.log10(x));
    const steps = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 10];
    const f = x / mag;
    const s = steps.find((st) => st >= f) ?? 10;
    return s * mag;
  };
  const out = [1];
  for (const q of qs) {
    const b = nice(v[Math.min(v.length - 1, Math.floor(q * v.length))]);
    if (b > out[out.length - 1]) out.push(b);
  }
  return out; // lower bound of each class
}

export function classOf(n: number, breaks: number[]): number {
  let k = 0;
  for (let i = 0; i < breaks.length; i++) if (n >= breaks[i]) k = i;
  return k;
}
