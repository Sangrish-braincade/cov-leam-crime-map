// Everything recorded "on" a searched street. police.uk moves each crime to the nearest
// of a fixed set of anonymous points, so a street's crimes are:
//   - points police.uk names after the street ("On or near Earlsdon Avenue North"), and
//   - for streets with no point of their own (most closes), the points just beside it.
import type { CrimeData, Scan } from "./crimeData";
import type { NewsItem } from "./news";
import { normStreet, type Street } from "./streets";

const COS = Math.cos((52.37 * Math.PI) / 180);
const km = (aLat: number, aLng: number, bLat: number, bLng: number) => Math.hypot((aLat - bLat) * 111, (aLng - bLng) * 111 * COS);

export const NEAR_METRES = 150;

export type StreetPoint = { i: number; street: string; lat: number; lng: number; n: number; metres: number; own: boolean };

export type StreetFocus = {
  street: Street;
  /** own points when the street has any, otherwise the neighbouring ones */
  scan: Scan;
  basis: "own" | "near";
  own: StreetPoint[]; // points police.uk names after this street
  near: StreetPoint[]; // other points within NEAR_METRES
  news: NewsItem[];
};

export function focusStreet(data: CrimeData, street: Street, news: NewsItem[]): StreetFocus {
  const norm = normStreet(street.name);
  const all = data.catMask(data.cats);
  const counts = data.pointCounts(all, 0, data.months.length - 1);
  const ownFilter = new Uint8Array(data.nPoints);
  const nearFilter = new Uint8Array(data.nPoints);
  const own: StreetPoint[] = [];
  const near: StreetPoint[] = [];
  for (let i = 0; i < data.nPoints; i++) {
    const lat = data.lat[i];
    const lng = data.lng[i];
    let d = Infinity;
    for (const [la, ln] of street.pts) d = Math.min(d, km(lat, lng, la, ln));
    const name = data.streets[data.pointStreet[i]];
    const sameName = normStreet(name) === norm && d < 1.2;
    if (!sameName && d * 1000 > NEAR_METRES) continue;
    (sameName ? ownFilter : nearFilter)[i] = 1;
    const p = { i, street: name, lat, lng, n: counts[i], metres: Math.round(d * 1000), own: sameName };
    (sameName ? own : near).push(p);
  }
  near.sort((a, b) => a.metres - b.metres);
  own.sort((a, b) => b.n - a.n);
  // a street's own police.uk points are the honest count; neighbours (a supermarket 60 m away)
  // would swamp it. Only streets with no point of their own fall back on their neighbours.
  const basis = own.length ? "own" : "near";
  const scan = data.scan(all, 0, data.months.length - 1, basis === "own" ? ownFilter : nearFilter);

  const mentions = news.filter((it) => {
    if ((it.streets ?? []).some((s) => normStreet(s) === norm) && it.place && street.pts.some(([la, ln]) => km(la, ln, it.place!.lat, it.place!.lng) < 1.2)) return true;
    return it.place ? street.pts.some(([la, ln]) => km(la, ln, it.place!.lat, it.place!.lng) * 1000 < NEAR_METRES) : false;
  });
  return { street, scan, basis, own, near, news: mentions };
}
