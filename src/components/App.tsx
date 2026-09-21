"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DATASET } from "@/generated/dataset";
import { CATEGORIES, CATEGORY, GROUPS, LENSES, type CategorySlug } from "@/lib/categories";
import { CrimeData, classBreaks, classOf, loadCrimeData, type SearchEntry } from "@/lib/crimeData";
import { dec, month, num, range as fmtRange } from "@/lib/format";
import { acrossMetres, levelForZoom } from "@/lib/hex";
import type { NewsFeed } from "@/lib/news";
import { HEAT, type Theme } from "@/lib/theme";
import AboutDialog, { publishMonth } from "./AboutDialog";
import GuideDrawer from "./GuideDrawer";
import MapView, { type HexFeatures, type NewsFeatures } from "./MapView";
import NewsPanel from "./NewsPanel";
import { AreaPanel, OverviewPanel, type TopHex } from "./panels";
import SearchBox from "./SearchBox";
import Timeline from "./Timeline";

type Dataset = typeof DATASET;
type Tab = "overview" | "area" | "news";
const ALL = CATEGORIES.map((c) => c.slug);

function useTheme(): [Theme, (t: Theme) => void, boolean] {
  const [theme, set] = useState<Theme>("light");
  const [resolved, setResolved] = useState(false);
  useEffect(() => {
    const stamped = document.documentElement.dataset.theme;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    set(stamped === "light" || stamped === "dark" ? stamped : mq.matches ? "dark" : "light");
    setResolved(true);
    const onChange = () => {
      if (!document.documentElement.dataset.theme) set(mq.matches ? "dark" : "light");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const choose = (t: Theme) => {
    document.documentElement.dataset.theme = t;
    try {
      localStorage.setItem("theme", t);
    } catch {}
    set(t);
  };
  return [theme, choose, resolved];
}

export default function App({ dataset }: { dataset: Dataset }) {
  const nMonths = dataset.months.length;
  const [data, setData] = useState<CrimeData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cats, setCats] = useState<Set<CategorySlug>>(() => new Set(ALL));
  const [range, setRange] = useState<[number, number]>([Math.max(0, nMonths - 12), nMonths - 1]);
  const [level, setLevel] = useState(levelForZoom(11.3));
  const [selected, setSelected] = useState<{ level: number; key: string } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [mode3d, setMode3d] = useState(false);
  const [showNews, setShowNews] = useState(true);
  const [guide, setGuide] = useState<CategorySlug | null>(null);
  const [about, setAbout] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [catsOpen, setCatsOpen] = useState(true);
  const [flyTo, setFlyTo] = useState<{ lng: number; lat: number; zoom: number; seq: number } | null>(null);
  const [news, setNews] = useState<NewsFeed | null>(null);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [theme, setTheme, themeReady] = useTheme();
  const detailsRef = useRef<HTMLElement>(null);
  const beforePlay = useRef<[number, number] | null>(null);
  const lockedBreaks = useRef<number[] | null>(null);

  // on phones the category list starts folded so the map comes first
  useEffect(() => {
    if (window.matchMedia("(max-width: 899px)").matches) setCatsOpen(false);
  }, []);

  useEffect(() => {
    loadCrimeData(dataset.file).then(setData, (e: Error) => setLoadError(e.message));
  }, [dataset.file]);

  useEffect(() => {
    fetch("/api/news")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`status ${r.status}`))))
      .then(setNews, (e: Error) => setNewsError(e.message));
  }, []);

  const mask = useMemo(() => (data ? data.catMask(cats) : null), [data, cats]);
  const [r0, r1] = range;

  const counts = useMemo(() => (data && mask ? data.hexCounts(level, mask, r0, r1) : null), [data, mask, level, r0, r1]);

  const breaks = useMemo(() => {
    if (!counts) return [1];
    if (playing && lockedBreaks.current) return lockedBreaks.current;
    return classBreaks(counts);
  }, [counts, playing]);

  const hexes: HexFeatures = useMemo(() => {
    if (!data || !counts) return { type: "FeatureCollection", features: [] };
    let max = 1;
    for (const c of counts) if (c > max) max = c;
    const features: HexFeatures["features"] = [];
    counts.forEach((n, id) => {
      if (!n) return;
      features.push({
        type: "Feature",
        id,
        properties: { n, k: classOf(n, breaks), h: Math.round(40 + 2600 * Math.sqrt(n / max)) },
        geometry: { type: "Polygon", coordinates: [data.ring(level, id)] },
      });
    });
    return { type: "FeatureCollection", features };
  }, [data, counts, breaks, level]);

  const overview = useMemo(() => (data && mask ? data.scan(mask, r0, r1) : null), [data, mask, r0, r1]);

  const selIdx = useMemo(() => {
    if (!data || !selected) return -1;
    return data.hex(selected.level).keys.indexOf(selected.key);
  }, [data, selected]);

  const areaScan = useMemo(() => {
    if (!data || !mask || !selected || selIdx < 0) return null;
    return data.scan(mask, r0, r1, data.pointsOfHex(selected.level, selIdx));
  }, [data, mask, selected, selIdx, r0, r1]);

  const areaLabel = useMemo(() => {
    if (!data || !selected || selIdx < 0) return null;
    return data.hexLabel(selected.level, selIdx, areaScan?.streets);
  }, [data, selected, selIdx, areaScan]);

  // share of areas (with any reports, same hex size) that are quieter than the selected one
  const areaRank = useMemo(() => {
    if (!data || !mask || !selected || !areaScan) return null;
    const c = selected.level === level && counts ? counts : data.hexCounts(selected.level, mask, r0, r1);
    let nonzero = 0;
    let below = 0;
    for (const v of c) {
      if (!v) continue;
      nonzero++;
      if (v < areaScan.total) below++;
    }
    return nonzero ? below / nonzero : null;
  }, [data, mask, selected, level, counts, r0, r1, areaScan]);

  const topHexes: TopHex[] = useMemo(() => {
    if (!data || !counts) return [];
    const ids = Array.from(counts.keys()).sort((a, b) => counts[b] - counts[a]).slice(0, 8);
    return ids.filter((id) => counts[id] > 0).map((id) => ({ id, n: counts[id], ...data.hexLabel(level, id) }));
  }, [data, counts, level]);

  const newsFeatures: NewsFeatures = useMemo(() => {
    const feats: NewsFeatures["features"] = [];
    for (const it of news?.items ?? []) {
      if (!it.place) continue;
      feats.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [it.place.lng, it.place.lat] },
        properties: {
          id: it.id,
          title: it.title,
          source: it.source,
          when: new Date(it.published).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
          cat: it.category ? CATEGORY[it.category]?.label ?? "Crime" : "Crime",
          url: it.url,
          area: it.place.precision === "area" ? 1 : 0,
          u: it.police.status === "unconfirmed" ? 1 : 0,
        },
      });
    }
    return { type: "FeatureCollection", features: feats };
  }, [news]);

  // month-by-month playback with a colour scale fixed across all months
  useEffect(() => {
    if (!playing) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setInterval(() => {
      setRange(([a]) => {
        const next = a + 1;
        if (next > nMonths - 1) {
          setPlaying(false);
          return [nMonths - 1, nMonths - 1];
        }
        return [next, next];
      });
    }, reduce ? 1600 : 850);
    return () => clearInterval(t);
  }, [playing, nMonths]);

  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      if (beforePlay.current) setRange(beforePlay.current);
      return;
    }
    if (!data || !mask) return;
    beforePlay.current = range;
    lockedBreaks.current = classBreaks(data.hexMonthlyValues(level, mask));
    setRange([0, 0]);
    setPlaying(true);
  };

  const fly = useCallback((lng: number, lat: number, zoom: number) => setFlyTo((f) => ({ lng, lat, zoom, seq: (f?.seq ?? 0) + 1 })), []);

  const selectHex = useCallback(
    (lvl: number, id: number) => {
      if (!data) return;
      setSelected({ level: lvl, key: data.hex(lvl).keys[id] });
      setTab("area");
      if (window.matchMedia("(max-width: 899px)").matches) {
        setTimeout(() => detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      }
    },
    [data],
  );

  const onSearch = (e: SearchEntry) => {
    const zoom = e.kind === "place" ? (["town", "city"].includes(e.area) ? 13 : 14.2) : 15.2;
    fly(e.lng, e.lat, zoom);
    if (data) {
      const lvl = levelForZoom(zoom);
      const id = data.hexOfPoint(lvl, e.lng, e.lat);
      if (id >= 0) selectHex(lvl, id);
    }
  };

  const lens = LENSES.find((l) => l.cats.length === cats.size && l.cats.every((c) => cats.has(c)))?.id ?? "custom";

  const toggleCat = (slug: CategorySlug) =>
    setCats((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next.size ? next : prev;
    });

  const toggleGroup = (ids: CategorySlug[]) =>
    setCats((prev) => {
      const allOn = ids.every((i) => prev.has(i));
      const next = new Set(prev);
      for (const i of ids) {
        if (allOn) next.delete(i);
        else next.add(i);
      }
      return next.size ? next : prev;
    });

  const renderTooltip = (id: number) => {
    if (!data || !counts) return null;
    const n = counts[id];
    const label = data.hexLabel(level, id);
    return (
      <>
        <strong>{label.title}</strong>
        <span>
          <span className="mono">{num(n)}</span> reports · {dec(n / (r1 - r0 + 1))}/month
        </span>
        <small>near {label.area} · select for details</small>
      </>
    );
  };

  const selectedRing = data && selected && selIdx >= 0 ? data.ring(selected.level, selIdx) : null;
  const catCounts = overview?.cats;
  const compact = (v: number) => (v >= 1000 ? `${dec(v / 1000)}k` : num(v));
  const legendRanges = breaks.map((b, i) => (i === breaks.length - 1 ? `${compact(b)}+` : compact(b)));
  const palette = HEAT[theme];

  return (
    <div className="app">
      <aside className="rail">
        <header className="brand">
          <div className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 28 28">
              <path d="M14 2.5 24 8.25v11.5L14 25.5 4 19.75V8.25Z" fill={palette[4]} />
              <path d="M14 8.5 19 11.4v5.2L14 19.5 9 16.6v-5.2Z" fill={palette[1]} />
            </svg>
          </div>
          <div>
            <h1>
              Cov &amp; Leam <span>Crime Map</span>
            </h1>
            <p className="brand-sub">
              {num(dataset.total)} police.uk reports, {month(dataset.months[0])} – {month(dataset.latest)}
            </p>
          </div>
        </header>

        <p className="update-line">
          <span className="dot" aria-hidden="true" /> Data to <strong>{month(dataset.latest)}</strong>. {month(dataset.nextMonth)} is due in the second half of{" "}
          {publishMonth(dataset.nextMonth)}.
        </p>

        <section className="lens" aria-label="What to show">
          <h2 className="rail-h">Show me</h2>
          <div className="lens-grid" role="radiogroup" aria-label="Lens">
            {LENSES.map((l) => (
              <button key={l.id} type="button" role="radio" aria-checked={lens === l.id} className={lens === l.id ? "on" : ""} onClick={() => setCats(new Set(l.cats))}>
                <strong>{l.label}</strong>
                <span>{l.hint}</span>
              </button>
            ))}
          </div>
          {lens === "custom" ? <p className="note">Custom mix · {cats.size} of 14 categories</p> : null}
        </section>

        <details className="cats" open={catsOpen} onToggle={(e) => setCatsOpen(e.currentTarget.open)}>
          <summary>
            <h2 className="rail-h">Categories</h2>
            <span className="note">
              {cats.size} of 14 on <span className="chev" aria-hidden="true" />
            </span>
          </summary>
          {GROUPS.map((g) => {
            const ids = CATEGORIES.filter((c) => c.group === g.id).map((c) => c.slug);
            const allOn = ids.every((i) => cats.has(i));
            return (
              <fieldset key={g.id} className="cat-group">
                <legend>
                  <span>{g.label}</span>
                  <button type="button" className="linkish small" onClick={() => toggleGroup(ids)}>
                    {allOn ? "Hide all" : "Show all"}
                  </button>
                </legend>
                {ids.map((slug) => {
                  const c = CATEGORY[slug];
                  const idx = data ? data.cats.indexOf(slug) : -1;
                  return (
                    <div key={slug} className={`cat-row ${cats.has(slug) ? "" : "off"}`}>
                      <label htmlFor={`cat-${slug}`}>
                        <input id={`cat-${slug}`} type="checkbox" checked={cats.has(slug)} onChange={() => toggleCat(slug)} />
                        <span className="cat-name">{c.label}</span>
                        <span className="cat-count mono">{catCounts && idx >= 0 ? num(catCounts[idx]) : ""}</span>
                      </label>
                      <button type="button" className="guide-btn" onClick={() => setGuide(slug)} aria-label={`Guide: ${c.label}`} title="What is this, and how do I protect myself?">
                        <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.25" /><path d="M8 7.2v4M8 4.9v.1" /></svg>
                      </button>
                    </div>
                  );
                })}
              </fieldset>
            );
          })}
          <p className="note">Counts are for {fmtRange(dataset.months, r0, r1)} across the whole map.</p>
        </details>

        <footer className="rail-foot">
          <button type="button" className="linkish" onClick={() => setAbout(true)}>
            How to read this map
          </button>
          <span className="note">
            Data: <a href="https://data.police.uk/" target="_blank" rel="noopener">police.uk</a> · OGL v3.0
          </span>
        </footer>
      </aside>

      <main className="stage">
        {themeReady ? <MapView
          theme={theme}
          hexes={hexes}
          selected={selectedRing}
          news={newsFeatures}
          showNews={showNews}
          mode3d={mode3d}
          flyTo={flyTo}
          onLevel={setLevel}
          onHexClick={(id) => selectHex(level, id)}
          renderTooltip={renderTooltip}
        >
          <div className="map-top">
            <SearchBox data={data} onPick={onSearch} />
            <div className="map-tools" role="group" aria-label="Map options">
              <button type="button" className={mode3d ? "on" : ""} aria-pressed={mode3d} onClick={() => setMode3d((v) => !v)}>
                3D
              </button>
              <button type="button" className={showNews ? "on" : ""} aria-pressed={showNews} onClick={() => setShowNews((v) => !v)} title="Show news pins">
                News
              </button>
              <button type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} map`}>
                {theme === "dark" ? (
                  <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3" /><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" /></svg>
                ) : (
                  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13 9.6A5.5 5.5 0 0 1 6.4 3a5.5 5.5 0 1 0 6.6 6.6Z" /></svg>
                )}
              </button>
            </div>
          </div>

          <div className="jump" role="group" aria-label="Jump to">
            {dataset.jumpTo
              .filter((j) => ["University of Warwick", "Coventry University", "Coventry city centre", "Canley", "Earlsdon", "Tile Hill", "Leamington town centre", "Kenilworth"].includes(j.name))
              .map((j) => (
                <button key={j.name} type="button" onClick={() => fly(j.lng, j.lat, j.kind === "town" ? 13.2 : 14.2)}>
                  {j.name.replace("University of Warwick", "Warwick uni").replace("Coventry University", "Coventry uni").replace(" town centre", "").replace("Coventry city centre", "City centre")}
                </button>
              ))}
          </div>

          {playing ? (
            <div className="play-month" aria-live="polite">
              {month(dataset.months[r0], true)}
            </div>
          ) : null}

          {!data && !loadError ? <div className="map-status">Loading {num(dataset.total)} reports…</div> : null}
          {loadError ? <div className="map-status error">{loadError}. Refresh to try again.</div> : null}

          <div className="legend" aria-label="Colour key">
            <p>
              Reports per hex · {fmtRange(dataset.months, r0, r1)}
              {playing ? " · scale fixed while playing" : ""}
            </p>
            <ol>
              {legendRanges.map((r, i) => (
                <li key={r}>
                  <span className="swatch" style={{ background: palette[i] }} aria-hidden="true" />
                  <span className="mono">{r}</span>
                </li>
              ))}
            </ol>
            <p className="note">Hexes about {num(acrossMetres(level))} m across · zoom in for smaller hexes</p>
          </div>
        </MapView> : <div className="map-wrap" />}

        <Timeline
          months={dataset.months}
          values={overview?.series ?? dataset.monthTotals}
          range={range}
          playing={playing}
          onRange={(r) => {
            if (playing) setPlaying(false);
            setRange(r);
          }}
          onPlay={togglePlay}
        />
      </main>

      <aside className="details" ref={detailsRef}>
        <div className="tabs" role="tablist" aria-label="Details">
          {(
            [
              ["overview", "Overview"],
              ["area", "Selected area"],
              ["news", `Latest news${news?.items.length ? ` (${news.items.length})` : ""}`],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button key={id} type="button" role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls={`panel-${id}`} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>
        <div className="panel" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {tab === "overview" && data && overview ? (
            <OverviewPanel
              data={data}
              scan={overview}
              selected={cats}
              range={range}
              topHexes={topHexes}
              level={level}
              onPickHex={(id) => {
                const [lng, lat] = data.hex(level).centers[id];
                selectHex(level, id);
                fly(lng, lat, Math.max(13.2, [10.5, 12.2, 13.6, 15][level]));
              }}
              onGuide={setGuide}
              onAbout={() => setAbout(true)}
            />
          ) : null}
          {tab === "area" ? (
            data && areaScan && areaLabel && selected ? (
              <AreaPanel
                data={data}
                scan={areaScan}
                label={areaLabel}
                level={selected.level}
                rank={areaRank}
                selected={cats}
                range={range}
                onGuide={setGuide}
                onClose={() => {
                  setSelected(null);
                  setTab("overview");
                }}
              />
            ) : (
              <div className="panel-body empty">
                <p>Select a hex on the map, search for a street, or pick one of the busiest areas in the overview.</p>
                <p className="note">You&rsquo;ll see how many reports it had each month, which categories, the exact streets and venues, and what happened next.</p>
              </div>
            )
          ) : null}
          {tab === "news" ? (
            <NewsPanel
              feed={news}
              error={newsError}
              latestPoliceMonth={dataset.latest}
              showPins={showNews}
              onTogglePins={() => setShowNews((v) => !v)}
              onShow={(lng, lat) => fly(lng, lat, 15)}
            />
          ) : null}
          {tab === "overview" && !data ? <div className="panel-body empty"><p>Loading…</p></div> : null}
        </div>
      </aside>

      {guide ? <GuideDrawer slug={guide} data={data} range={range} onClose={() => setGuide(null)} /> : null}
      {about ? (
        <AboutDialog onClose={() => setAbout(false)} latest={dataset.latest} nextMonth={dataset.nextMonth} total={dataset.total} first={dataset.months[0]} />
      ) : null}
    </div>
  );
}
