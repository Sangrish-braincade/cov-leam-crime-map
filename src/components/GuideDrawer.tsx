"use client";

import { useEffect, useRef } from "react";
import { CATEGORY, GROUPS, googleNewsUrl, type CategorySlug } from "@/lib/categories";
import type { CrimeData } from "@/lib/crimeData";
import { num, pct, range as fmtRange } from "@/lib/format";
import { LINKS } from "@/lib/links";
import { MonthBars } from "./charts";

export default function GuideDrawer({
  slug,
  data,
  range,
  onClose,
}: {
  slug: CategorySlug;
  data: CrimeData | null;
  range: [number, number];
  onClose: () => void;
}) {
  const c = CATEGORY[slug];
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  let series: Int32Array | null = null;
  let inRange = 0;
  let allInRange = 0;
  if (data) {
    const scan = data.scan(data.catMask([slug]), range[0], range[1]);
    series = scan.series;
    inRange = scan.total;
    allInRange = Array.from(scan.cats).reduce((a, b) => a + b, 0);
  }
  const group = GROUPS.find((g) => g.id === c.group)!;
  const general = [
    ...LINKS.reporting,
    ...(c.group === "people" ? [LINKS.general.streetsafe] : []),
    ...(slug === "violent-crime" || slug === "public-order" ? [LINKS.general.askForAngela] : []),
    LINKS.general.crimestoppers,
    LINKS.general.victimSupport,
  ];

  return (
    <dialog ref={ref} className="drawer" aria-labelledby="guide-title" onClose={onClose} onClick={(e) => e.target === ref.current && ref.current?.close()}>
      <div className="drawer-inner">
        <header className="drawer-head">
          <div>
            <p className="eyebrow">{group.label}</p>
            <h2 id="guide-title">{c.label}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={() => ref.current?.close()} aria-label="Close guide">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
          </button>
        </header>

        {data && series ? (
          <section className="guide-stat">
            <p>
              <strong className="mono">{num(inRange)}</strong> reports across the map, {fmtRange(data.months, range[0], range[1])}, which is{" "}
              <strong>{pct(inRange, allInRange)}</strong> of everything reported.
            </p>
            <MonthBars months={data.months} values={series} range={range} label={`${c.label} per month`} />
          </section>
        ) : null}

        <section>
          <h3>What it covers</h3>
          <p>{c.what}</p>
        </section>
        <section className="callout">
          <h3>Reading it on the map</h3>
          <p>{c.onTheMap}</p>
        </section>
        <section>
          <h3>Protect yourself</h3>
          <ul className="ticks">
            {c.tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
        <section>
          <h3>If it happens</h3>
          <ul className="ticks">
            {c.ifItHappens.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>

        {c.links.length ? (
          <section>
            <h3>Read more</h3>
            <ul className="links">
              {c.links.map((l) => (
                <li key={l.url}>
                  <a href={l.url} target="_blank" rel="noopener">
                    {l.title} ↗
                  </a>
                  <span>
                    {l.source} · {l.blurb}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section>
          <h3>In the news</h3>
          <ul className="links">
            <li>
              <a href={googleNewsUrl(`${c.newsTerm} Coventry`)} target="_blank" rel="noopener">
                {c.label} in Coventry news ↗
              </a>
            </li>
            <li>
              <a href={googleNewsUrl(`${c.newsTerm} Leamington OR Warwick OR Kenilworth`)} target="_blank" rel="noopener">
                {c.label} in Leamington, Warwick &amp; Kenilworth news ↗
              </a>
            </li>
          </ul>
        </section>

        <section>
          <h3>Help and reporting</h3>
          <ul className="links">
            {general.map((l) => (
              <li key={l.url}>
                <a href={l.url} target="_blank" rel="noopener">
                  {l.title} ↗
                </a>
                <span>{l.blurb}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3>For students</h3>
          <ul className="links">
            {LINKS.students.map((l) => (
              <li key={l.url}>
                <a href={l.url} target="_blank" rel="noopener">
                  {l.source}: {l.title} ↗
                </a>
                <span>{l.blurb}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </dialog>
  );
}
