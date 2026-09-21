"use client";

import { CATEGORY } from "@/lib/categories";
import { ago } from "@/lib/format";
import type { NewsFeed } from "@/lib/news";

export default function NewsPanel({
  feed,
  error,
  showPins,
  onTogglePins,
  onShow,
}: {
  feed: NewsFeed | null;
  error: string | null;
  showPins: boolean;
  onTogglePins: () => void;
  onShow: (lng: number, lat: number) => void;
}) {
  const items = feed?.items ?? [];
  return (
    <div className="panel-body">
      <section className="news-intro">
        <p>
          Crime stories from local news feeds, checked every 30 minutes. A story is pinned only when it names a street or area we can place.
        </p>
        <p className="note">
          News covers the unusual, not the everyday, so it isn&rsquo;t a measure of risk. Use the map for the full picture. Headlines link to the original article.
        </p>
        <label className="switch">
          <input type="checkbox" id="news-pins" checked={showPins} onChange={onTogglePins} />
          <span>Show news pins on the map</span>
        </label>
        {feed?.updated ? <p className="note mono">Last new story {ago(feed.updated)}</p> : null}
      </section>

      {error ? <p className="note">Couldn&rsquo;t load the news feed just now. {error}</p> : null}
      {!error && feed && items.length === 0 ? <p className="note">No local crime stories in the last few weeks yet. The feed fills up as stories are published.</p> : null}
      {!feed && !error ? <p className="note">Loading news…</p> : null}

      <ol className="news-list">
        {items.map((it) => (
          <li key={it.id}>
            <p className="news-meta">
              {it.category ? <span className="tag">{CATEGORY[it.category]?.short ?? it.category}</span> : null}
              <span>{it.source}</span>
              <span aria-hidden="true">·</span>
              <time dateTime={it.published}>{ago(it.published)}</time>
              {it.timing === "court" ? <span className="tag quiet">Court report</span> : null}
            </p>
            <a className="news-title" href={it.url} target="_blank" rel="noopener">
              {it.title}
            </a>
            {it.summary ? <p className="news-summary">{it.summary}</p> : null}
            {it.place ? (
              <button type="button" className="linkish small" onClick={() => onShow(it.place!.lng, it.place!.lat)}>
                Show {it.place.label} on the map{it.place.precision === "area" ? " (approximate)" : ""}
              </button>
            ) : (
              <p className="note small">No street or area named, so it isn&rsquo;t on the map</p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
