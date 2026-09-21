"use client";

import { CATEGORY, type CategorySlug, googleNewsUrl } from "@/lib/categories";
import type { CrimeData, Scan } from "@/lib/crimeData";
import { change, dec, num, pct, range as fmtRange } from "@/lib/format";
import { acrossMetres } from "@/lib/hex";
import { OUTCOME_GROUPS } from "@/lib/outcomes";
import { NEAR_METRES, type StreetFocus } from "@/lib/streetFocus";
import { BarList, MonthBars } from "./charts";

export type TopHex = { id: number; title: string; area: string; n: number };

function Delta({ now, before, label }: { now: number; before: number; label: string }) {
  const c = change(now, before);
  if (!c) return null;
  return (
    <p className={`delta ${c.dir}`}>
      <span aria-hidden="true">{c.dir === "up" ? "▲" : c.dir === "down" ? "▼" : "●"}</span> {c.text}{" "}
      <span className="delta-label">{label}</span>
    </p>
  );
}

function Outcomes({ scan }: { scan: Scan }) {
  if (scan.withOutcome === 0) return <p className="note">No outcomes for this selection. Anti-social behaviour isn't a crime, so it doesn't get one.</p>;
  return (
    <BarList
      items={OUTCOME_GROUPS.map((g, i) => ({
        key: g.id,
        label: g.label,
        value: scan.outcomes[i],
        note: pct(scan.outcomes[i], scan.withOutcome),
      })).filter((i) => i.value > 0)}
    />
  );
}

export function OverviewPanel(props: {
  data: CrimeData;
  scan: Scan;
  selected: Set<CategorySlug>;
  range: [number, number];
  topHexes: TopHex[];
  level: number;
  onPickHex: (id: number) => void;
  onGuide: (slug: CategorySlug) => void;
  onAbout: () => void;
}) {
  const { data, scan, range, selected } = props;
  const [r0, r1] = range;
  const len = r1 - r0 + 1;
  const series = Array.from(scan.series);
  const prev = r0 - len >= 0 ? series.slice(r0 - len, r0).reduce((a, b) => a + b, 0) : 0;
  const cats = data.cats
    .map((slug, i) => ({ slug: slug as CategorySlug, n: scan.cats[i] }))
    .filter((c) => selected.has(c.slug))
    .sort((a, b) => b.n - a.n);

  return (
    <div className="panel-body">
      <section className="stat-block">
        <p className="eyebrow">{fmtRange(data.months, r0, r1)} · whole map</p>
        <p className="big">{num(scan.total)}</p>
        <p className="big-sub">
          reports, about {num(scan.total / len)} a month
        </p>
        {r0 - len >= 0 ? <Delta now={scan.total} before={prev} label={`vs the previous ${len === 1 ? "month" : `${len} months`}`} /> : null}
      </section>

      <section>
        <h3>Every month, {selected.size === 14 ? "all categories" : "selected categories"}</h3>
        <MonthBars months={data.months} values={scan.series} range={range} label="Reports per month" />
      </section>

      <section>
        <h3>What&rsquo;s being reported</h3>
        <BarList
          items={cats.map((c) => ({
            key: c.slug,
            label: CATEGORY[c.slug].label,
            value: c.n,
            note: pct(c.n, scan.total),
            onClick: () => props.onGuide(c.slug),
            action: `Read the guide to ${CATEGORY[c.slug].label.toLowerCase()}`,
          }))}
        />
        <p className="note">Select a category to read what it covers and how to protect yourself.</p>
      </section>

      <section>
        <h3>Busiest areas</h3>
        <p className="note">Hexes about {num(acrossMetres(props.level))}&nbsp;m across at this zoom. Busy often means busy with people: town centres, shops, stations.</p>
        <ol className="tophex">
          {props.topHexes.map((h, i) => (
            <li key={h.id}>
              <button type="button" onClick={() => props.onPickHex(h.id)}>
                <span className="tophex-rank mono">{i + 1}</span>
                <span className="tophex-name">
                  {h.title}
                  <small>{h.area}</small>
                </span>
                <span className="mono">{num(h.n)}</span>
              </button>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h3>What happened next</h3>
        <Outcomes scan={scan} />
        <p className="note">
          The latest outcome police.uk has for each crime. Recent months are still being worked on, so they show more &ldquo;under investigation&rdquo;.
        </p>
      </section>

      <button type="button" className="linkish" onClick={props.onAbout}>
        How to read this map, and what the data can&rsquo;t tell you
      </button>
    </div>
  );
}

export function StreetPanel(props: {
  data: CrimeData;
  focus: StreetFocus;
  typed: string;
  onGuide: (slug: CategorySlug) => void;
  onClose: () => void;
}) {
  const { data, focus } = props;
  const { street, scan, own, near } = focus;
  const n = data.months.length;
  const series = Array.from(scan.series);
  const last12 = series.slice(n - 12).reduce((a, b) => a + b, 0);
  const prev12 = series.slice(n - 24, n - 12).reduce((a, b) => a + b, 0);
  const cats = data.cats
    .map((slug, i) => ({ slug: slug as CategorySlug, n: scan.cats[i] }))
    .filter((c) => c.n > 0)
    .sort((a, b) => b.n - a.n);
  const where = street.area && street.area !== street.town ? `${street.area}, ${street.town}` : street.town || street.area;
  const typedNumber = /^\s*(flat|apartment|\d)/i.test(props.typed);

  return (
    <div className="panel-body">
      <header className="area-head">
        <div>
          <p className="eyebrow">Street · all categories · {fmtRange(data.months, 0, n - 1)}</p>
          <h2>{street.name}</h2>
          <p className="area-sub">{where}</p>
        </div>
        <button type="button" className="icon-btn" onClick={props.onClose} aria-label="Close street">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
        </button>
      </header>
      {typedNumber ? (
        <p className="note">
          You searched &ldquo;{props.typed}&rdquo;. police.uk works street by street and never below that, so the house number isn&rsquo;t used.
        </p>
      ) : null}

      <section className="stat-block">
        <p className="big">{num(scan.total)}</p>
        <p className="big-sub">
          {focus.basis === "own"
            ? `police.uk reports recorded on ${street.name} in ${n} months`
            : `police.uk reports at the points nearest ${street.name} (within ${NEAR_METRES} m) in ${n} months`}
        </p>
        <Delta now={last12} before={prev12} label="last 12 months vs the 12 before" />
      </section>

      <section>
        <h3>Where police.uk records them</h3>
        {focus.basis === "own" ? (
          <p className="note">
            police.uk moves every crime to the nearest of a fixed set of anonymous points. {own.length === 1 ? "One is" : `${own.length} are`} named after{" "}
            {street.name}; that&rsquo;s what&rsquo;s counted above. Points on neighbouring streets within {NEAR_METRES} m are listed for context but not counted.
          </p>
        ) : (
          <p className="note">
            police.uk has no point of its own on {street.name}, which is normal for smaller streets. Crimes here are recorded at the nearest points, so the count
            above uses those within {NEAR_METRES} m. Some of them will be from the neighbouring streets.
          </p>
        )}
        <BarList
          items={[...own, ...near].slice(0, 8).map((p) => ({
            key: String(p.i),
            label: `${data.placeType[data.pointStreet[p.i]] ? p.street + " (venue)" : "On or near " + p.street}${p.own ? "" : ` · ${p.metres} m away`}`,
            value: p.n,
            muted: focus.basis === "own" && !p.own,
            note: focus.basis === "own" && !p.own ? "(not counted)" : undefined,
          }))}
        />
      </section>

      {scan.total ? (
        <>
          <section>
            <h3>Every month</h3>
            <MonthBars months={data.months} values={scan.series} range={[n - 12, n - 1]} label={`Reports per month on or near ${street.name}`} />
          </section>
          <section>
            <h3>By category</h3>
            <BarList
              items={cats.map((c) => ({
                key: c.slug,
                label: CATEGORY[c.slug].label,
                value: c.n,
                onClick: () => props.onGuide(c.slug),
                action: `Read the guide to ${CATEGORY[c.slug].label.toLowerCase()}`,
              }))}
            />
          </section>
          <section>
            <h3>What happened next</h3>
            <Outcomes scan={scan} />
          </section>
        </>
      ) : (
        <p className="note">Nothing recorded on or right beside this street in the last {n} months.</p>
      )}

      <section className="read-more">
        <h3>In the news</h3>
        {focus.news.length ? (
          <ul className="links">
            {focus.news.map((it) => (
              <li key={it.id}>
                <a href={it.url} target="_blank" rel="noopener">
                  {it.title} ↗
                </a>
                <span>
                  {it.source} · {new Date(it.published).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  {it.category ? ` · ${CATEGORY[it.category]?.label}` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="note">No local news stories name this street in the news archive so far.</p>
        )}
        <p className="note">
          <a href={googleNewsUrl(`"${street.name}" ${street.town}`)} target="_blank" rel="noopener">
            Search older news about {street.name} ↗
          </a>
        </p>
      </section>
    </div>
  );
}

function Rank({ rank }: { rank: number }) {
  const pctBusier = Math.round(rank * 100);
  const text =
    pctBusier >= 99
      ? "Among the busiest 1% of areas on the map"
      : pctBusier >= 50
        ? `Busier than ${pctBusier}% of areas on the map`
        : `Quieter than ${100 - pctBusier}% of areas on the map`;
  return (
    <p className="compare">
      <strong>{text}</strong> <span className="note">(areas of the same size with any reports)</span>
    </p>
  );
}

export function AreaPanel(props: {
  data: CrimeData;
  scan: Scan;
  label: { title: string; area: string };
  level: number;
  rank: number | null;
  selected: Set<CategorySlug>;
  range: [number, number];
  onGuide: (slug: CategorySlug) => void;
  onClose: () => void;
}) {
  const { data, scan, range, selected } = props;
  const [r0, r1] = range;
  const len = r1 - r0 + 1;
  const n = data.months.length;
  const series = Array.from(scan.series);
  const last12 = series.slice(n - 12).reduce((a, b) => a + b, 0);
  const prev12 = series.slice(n - 24, n - 12).reduce((a, b) => a + b, 0);
  const cats = data.cats
    .map((slug, i) => ({ slug: slug as CategorySlug, n: scan.cats[i] }))
    .filter((c) => c.n > 0)
    .sort((a, b) => Number(selected.has(b.slug)) - Number(selected.has(a.slug)) || b.n - a.n);
  const topCat = cats.find((c) => selected.has(c.slug));
  const places = [...scan.streets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const street = props.label.title.split(" & ")[0];

  return (
    <div className="panel-body">
      <header className="area-head">
        <div>
          <p className="eyebrow">Selected area · about {num(acrossMetres(props.level))}&nbsp;m across</p>
          <h2>{props.label.title}</h2>
          <p className="area-sub">near {props.label.area}</p>
        </div>
        <button type="button" className="icon-btn" onClick={props.onClose} aria-label="Close selected area">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
        </button>
      </header>

      <section className="stat-block">
        <p className="eyebrow">{fmtRange(data.months, r0, r1)}</p>
        <p className="big">{num(scan.total)}</p>
        <p className="big-sub">reports, about {dec(scan.total / len)} a month</p>
        {props.rank !== null && scan.total > 0 ? <Rank rank={props.rank} /> : null}
        <Delta now={last12} before={prev12} label="last 12 months vs the 12 before" />
      </section>

      <section>
        <h3>Every month here</h3>
        <MonthBars months={data.months} values={scan.series} range={range} label="Reports per month in this area" />
      </section>

      <section>
        <h3>By category</h3>
        <BarList
          items={cats.map((c) => ({
            key: c.slug,
            label: CATEGORY[c.slug].label,
            value: c.n,
            muted: !selected.has(c.slug),
            note: selected.has(c.slug) ? undefined : "(hidden)",
            onClick: () => props.onGuide(c.slug),
            action: `Read the guide to ${CATEGORY[c.slug].label.toLowerCase()}`,
          }))}
        />
      </section>

      <section>
        <h3>Where exactly</h3>
        <p className="note">police.uk moves every crime to the nearest of a fixed set of points, a street or a venue, to protect people&rsquo;s privacy.</p>
        <BarList
          items={places.map(([s, v]) => ({
            key: String(s),
            label: data.placeType[s] ? `${data.streets[s]} (venue)` : `On or near ${data.streets[s]}`,
            value: v,
          }))}
        />
      </section>

      <section>
        <h3>What happened next</h3>
        <Outcomes scan={scan} />
      </section>

      <section className="read-more">
        <h3>Read more</h3>
        <ul>
          {topCat ? (
            <li>
              <button type="button" className="linkish" onClick={() => props.onGuide(topCat.slug)}>
                Guide: {CATEGORY[topCat.slug].label}, the most reported here
              </button>
            </li>
          ) : null}
          <li>
            <a href={googleNewsUrl(`"${street}" ${props.label.area}`)} target="_blank" rel="noopener">
              Local news mentioning {street} ↗
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}
