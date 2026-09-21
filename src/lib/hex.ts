// Pointy-top hex grid laid out in Web Mercator, so hexes look regular on the map.
// Sizes are ground circumradii; Mercator stretches by 1/cos(lat) at Coventry.
const R = 6378137;
const K = 1 / Math.cos((52.37 * Math.PI) / 180);
const SQRT3 = Math.sqrt(3);

export const HEX_LEVELS = [
  { radius: 900, minZoom: 0 },
  { radius: 450, minZoom: 10 },
  { radius: 225, minZoom: 12 },
  { radius: 120, minZoom: 13.5 },
] as const;

export function levelForZoom(zoom: number): number {
  let lvl = 0;
  HEX_LEVELS.forEach((l, i) => {
    if (zoom >= l.minZoom) lvl = i;
  });
  return lvl;
}

export function acrossMetres(level: number): number {
  return Math.round((HEX_LEVELS[level].radius * SQRT3) / 10) * 10;
}

function project(lng: number, lat: number): [number, number] {
  const x = (R * lng * Math.PI) / 180;
  const y = R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  return [x, y];
}

function unproject(x: number, y: number): [number, number] {
  const lng = (x / R) * (180 / Math.PI);
  const lat = (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * (180 / Math.PI);
  return [lng, lat];
}

/** Axial hex key "q,r" for a point at the given level. */
export function hexKey(lng: number, lat: number, level: number): string {
  const s = HEX_LEVELS[level].radius * K;
  const [x, y] = project(lng, lat);
  const qf = ((SQRT3 / 3) * x - y / 3) / s;
  const rf = ((2 / 3) * y) / s;
  // cube rounding
  const xf = qf;
  const zf = rf;
  const yf = -xf - zf;
  let rx = Math.round(xf);
  let ry = Math.round(yf);
  let rz = Math.round(zf);
  const dx = Math.abs(rx - xf);
  const dy = Math.abs(ry - yf);
  const dz = Math.abs(rz - zf);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;
  return `${rx},${rz}`;
}

export function hexCenter(key: string, level: number): [number, number] {
  const [q, r] = key.split(",").map(Number);
  const s = HEX_LEVELS[level].radius * K;
  return unproject(s * SQRT3 * (q + r / 2), s * 1.5 * r);
}

export function hexRing(key: string, level: number): [number, number][] {
  const [q, r] = key.split(",").map(Number);
  const s = HEX_LEVELS[level].radius * K;
  const cx = s * SQRT3 * (q + r / 2);
  const cy = s * 1.5 * r;
  const ring: [number, number][] = [];
  for (let i = 0; i <= 6; i++) {
    const a = (Math.PI / 180) * (60 * (i % 6) - 30);
    ring.push(unproject(cx + s * Math.cos(a), cy + s * Math.sin(a)));
  }
  return ring;
}
