// Shared police.uk helpers: tiled fetch of one month + the compact on-disk format.
//
// data/crimes/YYYY-MM.json holds one crime per line so git diffs stay readable:
//   [lat, lng, category, street, outcome|null]            (+ "BTP" for British Transport Police)
import { readFileSync, writeFileSync } from "node:fs";

export const API = "https://data.police.uk/api";

// south, west, north, east — Coventry, Warwick uni, Kenilworth, Warwick, Leamington
export const BBOX = [52.255, -1.66, 52.475, -1.4];
const GRID = 4;
const UA = { "User-Agent": "cov-leam-crime-map/1.0 (+https://github.com)" };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(url, body, tries = 6) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { ...UA, "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: AbortSignal.timeout(90_000),
      });
      if (res.status === 503) return null; // more than 10k crimes in this polygon
      if (res.status === 429 || res.status >= 500) {
        await sleep(1500 * (i + 1));
        continue;
      }
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return await res.json();
    } catch (err) {
      if (i === tries - 1) throw err;
      await sleep(2000 * (i + 1));
    }
  }
  throw new Error(`gave up on ${url}`);
}

export async function availableMonths() {
  const res = await fetch(`${API}/crimes-street-dates`, { headers: UA });
  if (!res.ok) throw new Error(`crimes-street-dates ${res.status}`);
  return (await res.json()).map((d) => d.date).sort();
}

async function tile(s, w, n, e, month, depth = 0) {
  const poly = `${s},${w}:${s},${e}:${n},${e}:${n},${w}`;
  const body = new URLSearchParams({ poly, date: month }).toString();
  const crimes = await post(`${API}/crimes-street/all-crime`, body);
  if (crimes) return crimes;
  if (depth > 4) throw new Error(`tile still over 10k at depth ${depth}: ${poly} ${month}`);
  const ms = (s + n) / 2;
  const mw = (w + e) / 2;
  const out = [];
  for (const b of [[s, w, ms, mw], [s, mw, ms, e], [ms, w, n, mw], [ms, mw, n, e]]) {
    out.push(...(await tile(...b, month, depth + 1)));
  }
  return out;
}

export async function fetchMonth(month) {
  const [s, w, n, e] = BBOX;
  const dy = (n - s) / GRID;
  const dx = (e - w) / GRID;
  const byId = new Map();
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const crimes = await tile(s + r * dy, w + c * dx, s + (r + 1) * dy, w + (c + 1) * dx, month);
      for (const crime of crimes) byId.set(crime.id, crime);
    }
  }
  return [...byId.values()];
}

export function compactRow(c) {
  const row = [
    Number(c.location.latitude),
    Number(c.location.longitude),
    c.category,
    c.location.street.name.replace(/^On or near /, ""),
    c.outcome_status?.category ?? null,
  ];
  if (c.location_type === "BTP") row.push("BTP");
  return row;
}

export function writeMonth(path, month, rows) {
  rows.sort((a, b) => (a[3] < b[3] ? -1 : a[3] > b[3] ? 1 : a[0] - b[0] || a[1] - b[1] || (a[2] < b[2] ? -1 : 1)));
  const lines = rows.map((r) => JSON.stringify(r));
  const head = `{"month":${JSON.stringify(month)},"count":${rows.length},"source":"data.police.uk street-level crimes","crimes":[\n`;
  writeFileSync(path, head + lines.join(",\n") + "\n]}\n");
}

export function readMonth(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}
