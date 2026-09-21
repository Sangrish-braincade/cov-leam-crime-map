const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const nf = new Intl.NumberFormat("en-GB");
export const num = (n: number) => nf.format(Math.round(n));
export const dec = (n: number) => (n >= 10 ? num(n) : n.toFixed(1).replace(/\.0$/, ""));

export function month(ym: string, long = false): string {
  const [y, m] = ym.split("-").map(Number);
  return `${(long ? MONTHS_LONG : MONTHS)[m - 1]} ${y}`;
}

export function monthShort(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS[m - 1]} ’${String(y).slice(2)}`;
}

export function range(months: readonly string[], r0: number, r1: number): string {
  if (r0 === r1) return month(months[r0]);
  const a = months[r0].split("-");
  const b = months[r1].split("-");
  if (a[0] === b[0]) return `${MONTHS[Number(a[1]) - 1]} – ${month(months[r1])}`;
  return `${month(months[r0])} – ${month(months[r1])}`;
}

export function pct(part: number, whole: number): string {
  if (!whole) return "0%";
  const p = (100 * part) / whole;
  return p < 1 && p > 0 ? "<1%" : `${Math.round(p)}%`;
}

export function change(now: number, before: number): { text: string; dir: "up" | "down" | "flat" } | null {
  if (before < 20) return null; // small counts swing wildly; a % would mislead
  const d = (now - before) / before;
  if (Math.abs(d) < 0.03) return { text: "about the same", dir: "flat" };
  return { text: `${d > 0 ? "+" : "−"}${Math.round(Math.abs(d) * 100)}%`, dir: d > 0 ? "up" : "down" };
}

export function ago(iso: string, now = Date.now()): string {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  const d = Math.round(s / 86400);
  if (d < 14) return `${d} day${d === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
