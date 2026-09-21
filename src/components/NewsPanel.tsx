"use client";

import { useState } from "react";
import { CATEGORY } from "@/lib/categories";
import { ago, month } from "@/lib/format";
import type { NewsFeed } from "@/lib/news";

type Filter = "all" | "unconfirmed" | "pinned";

export default function NewsPanel({
  feed,
  error,
  latestPoliceMonth,
  showPins,
  onTogglePins,
  onShow,
}: {
  feed: NewsFeed | null;
  error: string | null;
  latestPoliceMonth: string;
  showPins: boolean;
  onTogglePins: () => void;
  onShow: (lng: number, lat: number) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const all = feed?.items ?? [];
  const unconfirmed = all.filter((i) => i.police.status === "unconfirmed").length;
  const items = all.filter((i) => (filter === "unconfirmed" ? i.police.status === "unconfirmed" : filter === "pinned" ? i.place : true));

  return (
    <div className="panel-body">
      <section className="news-intro">
        <p>
          Crime stories from CoventryLive and BBC News over the last three months, checked every 20 minutes. A story is pinned when the article names a street or
          area we can place.
        </p>
        <p className="note">
          police.uk runs about two months behind, so stories after {month(latestPoliceMonth)} are marked <strong>not yet in police data</strong>. News covers the
          unusual, not the everyday, so it isn&rsquo;t a measure of risk. Headlines link to the original article.
        </p>
        <label className="switch">
          <input type="checkbox" id="news-pins" checked={showPins} onChange={onTogglePins} />
          <span>Show news pins on the map</span>
        </label>
        <div className="presets" role="group" aria-label="Filter stories">
          {(
            [
              ["all", `All ${all.length}`],
              ["unconfirmed", `Not yet in police data (${unconfirmed})`],
              ["pinned", "On the map"],
            ] as [Filter, string][]
          ).map(([id, label]) => (
            <button key={id} type="button" className={filter === id ? "on" : ""} aria-pressed={filter === id} onClick={() => setFilter(id)}>
              {label}
            </button>
          ))}
        </div>
        {feed?.updated ? <p className="note mono">Newest story {ago(feed.updated)}</p> : null}
      </section>

      {error ? <p className="note">Couldn&rsquo;t load the news feed just now. {error}</p> : null}
      {!error && feed && items.length === 0 ? <p className="note">No stories match this filter yet.</p> : null}
      {!feed && !error ? <p className="note">Loading news…</p> : null}

      <ol className="news-list">
        {items.map((it) => (
          <li key={it.id}>
            <p className="news-meta">
              {it.category ? <span className="tag">{CATEGORY[it.category]?.short ?? it.category}</span> : null}
              {it.police.status === "unconfirmed" ? <span className="tag warn">Not yet in police data</span> : null}
              {it.police.status === "matched" ? <span className="tag ok">In police data</span> : null}
              {it.timing === "court" ? <span className="tag quiet">Court report</span> : null}
              <span>{it.source}</span>
              <span aria-hidden="true">·</span>
              <time dateTime={it.published}>{ago(it.published)}</time>
            </p>
            <a className="news-title" href={it.url} target="_blank" rel="noopener">
              {it.title}
            </a>
            {it.police.status === "matched" && it.police.nearest?.length ? (
              it.place?.precision === "street" ? (
                <p className="note small">
                  Likely one of {it.police.candidates} police.uk report{it.police.candidates === 1 ? "" : "s"} nearby, e.g. on or near {it.police.nearest[0].street} (
                  {month(it.police.nearest[0].month)}). Already counted on the map.
                </p>
              ) : (
                <p className="note small">
                  police.uk has {it.police.candidates} report{it.police.candidates === 1 ? "" : "s"} of this kind in {it.place?.label ?? "that area"} that month; this story is probably
                  among them. Already counted on the map.
                </p>
              )
            ) : null}
            {it.police.status === "no-match" ? <p className="note small">No matching police.uk report of this kind nearby that month.</p> : null}
            {it.place ? (
              <button type="button" className="linkish small" onClick={() => onShow(it.place!.lng, it.place!.lat)}>
                Show {it.place.label} on the map{it.place.precision === "area" ? " (approximate area)" : ""}
              </button>
            ) : (
              <p className="note small">No street or area named in the article, so it isn&rsquo;t pinned</p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
