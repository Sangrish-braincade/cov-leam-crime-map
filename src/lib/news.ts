import type { CategorySlug } from "./categories";

export type NewsItem = {
  id: string;
  url: string;
  title: string;
  source: string;
  published: string;
  category: CategorySlug | null;
  summary: string;
  place: { label: string; lat: number; lng: number; precision: "street" | "area" } | null;
  timing: "recent" | "court" | "unknown";
};

export type NewsFeed = { updated: string | null; items: NewsItem[] };
