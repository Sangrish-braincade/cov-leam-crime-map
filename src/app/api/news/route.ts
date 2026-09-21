// Serves data/news.json. The news GitHub Action commits that file every 30
// minutes with [skip-cd], so the site doesn't rebuild; instead this route reads
// the latest committed copy from GitHub and caches it for 10 minutes.
//
// Env (Amplify, server-side only):
//   NEWS_JSON_URL  raw URL of data/news.json, e.g.
//                  https://api.github.com/repos/<owner>/<repo>/contents/data/news.json?ref=main
//   GITHUB_TOKEN   fine-grained read-only token, only needed for a private repo
// Without NEWS_JSON_URL (local dev) it falls back to the copy bundled at build time.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { NewsFeed, NewsItem } from "@/lib/news";

export const revalidate = 600;

const KEEP_DAYS = 30;

async function fromGitHub(url: string): Promise<unknown> {
  const headers: Record<string, string> = { Accept: "application/vnd.github.raw+json", "User-Agent": "cov-leam-crime-map" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(url, { headers, next: { revalidate } });
  if (!res.ok) throw new Error(`news source ${res.status}`);
  return res.json();
}

async function fromDisk(): Promise<unknown> {
  return JSON.parse(await readFile(join(process.cwd(), "data", "news.json"), "utf8"));
}

export async function GET() {
  let raw: { updated?: string; items?: NewsItem[] };
  try {
    const url = process.env.NEWS_JSON_URL;
    raw = (await (url ? fromGitHub(url).catch(fromDisk) : fromDisk())) as typeof raw;
  } catch {
    raw = { updated: undefined, items: [] };
  }
  const cutoff = Date.now() - KEEP_DAYS * 86400_000;
  const items = (raw.items ?? [])
    .filter((i) => new Date(i.published).getTime() >= cutoff)
    .sort((a, b) => b.published.localeCompare(a.published));
  const body: NewsFeed = { updated: raw.updated ?? null, items };
  return Response.json(body, { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" } });
}
