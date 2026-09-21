// Serves the last ~3 months of scraped local crime news (data/news-archive/YYYY-MM.json).
// The news Action commits those files with [skip-cd], so the site doesn't rebuild;
// this route reads the latest committed copies from GitHub and caches them for 10 minutes.
//
// Env (Amplify, server-side only):
//   NEWS_BASE_URL  raw base of the repo, e.g. https://raw.githubusercontent.com/<owner>/<repo>/main
//                  (public repo: no token needed, and raw.githubusercontent has no 60/hour API limit)
// Without NEWS_BASE_URL (local dev) it reads the files from disk.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DATASET } from "@/generated/dataset";
import type { NewsFeed, NewsItem } from "@/lib/news";

export const revalidate = 600;

const WINDOW_DAYS = 95;

type Archived = {
  id: string;
  url: string;
  source: string;
  title: string;
  published: string;
  category: NewsItem["category"];
  court: boolean;
  place: NewsItem["place"];
  police?: NewsItem["police"];
};

function recentMonths(n: number): string[] {
  const d = new Date();
  return Array.from({ length: n }, (_, i) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1)).toISOString().slice(0, 7));
}

async function readMonth(ym: string): Promise<Archived[]> {
  const base = process.env.NEWS_BASE_URL;
  try {
    if (base) {
      const res = await fetch(`${base}/data/news-archive/${ym}.json`, { headers: { "User-Agent": "cov-leam-crime-map" }, next: { revalidate } });
      if (res.status === 404) return [];
      if (!res.ok) throw new Error(`news source ${res.status}`);
      return ((await res.json()) as { articles: Archived[] }).articles ?? [];
    }
  } catch {
    // fall through to the copy bundled at build time
  }
  try {
    return (JSON.parse(await readFile(join(process.cwd(), "data", "news-archive", `${ym}.json`), "utf8")) as { articles: Archived[] }).articles ?? [];
  } catch {
    return [];
  }
}

export async function GET() {
  const months = recentMonths(4);
  const cutoff = Date.now() - WINDOW_DAYS * 86400_000;
  const all = (await Promise.all(months.map(readMonth))).flat();
  const items: NewsItem[] = all
    .filter((a) => new Date(a.published).getTime() >= cutoff)
    .sort((a, b) => b.published.localeCompare(a.published))
    .map((a) => ({
      id: a.id,
      url: a.url,
      title: a.title,
      source: a.source,
      published: a.published,
      category: a.category,
      place: a.place,
      timing: a.court ? "court" : "recent",
      // scripts/correlate.mjs sets this; before it has run, fall back on the month alone
      police: a.police ?? { status: a.published.slice(0, 7) > DATASET.latest ? "unconfirmed" : a.court ? "court" : a.place ? "no-match" : "unplaced" },
    }));
  const updated = items[0]?.published ?? null;
  const body: NewsFeed = { updated, items };
  return Response.json(body, { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" } });
}
