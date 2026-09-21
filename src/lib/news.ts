import type { CategorySlug } from "./categories";

export type NewsItem = {
  id: string;
  url: string;
  title: string;
  source: string;
  published: string;
  category: CategorySlug | null;
  place: { label: string; lat: number; lng: number; precision: "street" | "area" } | null;
  timing: "recent" | "court";
  /** How the story lines up with police.uk (see scripts/correlate.mjs). */
  police: PoliceLink;
};

export type PoliceLink = {
  status: "unconfirmed" | "matched" | "no-match" | "court" | "unplaced";
  candidates?: number;
  nearest?: { street: string; month: string; n: number; metres: number }[];
};

export type NewsFeed = { updated: string | null; items: NewsItem[] };
