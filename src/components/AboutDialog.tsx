"use client";

import { useEffect, useRef } from "react";
import { month, num } from "@/lib/format";
import { LINKS } from "@/lib/links";

/** police.uk publishes a month's data roughly two calendar months later. */
export function publishMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m + 1, 1)).toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" });
}

export default function AboutDialog({
  onClose,
  latest,
  nextMonth,
  total,
  first,
}: {
  onClose: () => void;
  latest: string;
  nextMonth: string;
  total: number;
  first: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);
  const about = LINKS.general.policeData;

  return (
    <dialog ref={ref} className="drawer" aria-labelledby="about-title" onClose={onClose} onClick={(e) => e.target === ref.current && ref.current?.close()}>
      <div className="drawer-inner">
        <header className="drawer-head">
          <div>
            <p className="eyebrow">About the data</p>
            <h2 id="about-title">How to read this map</h2>
          </div>
          <button type="button" className="icon-btn" onClick={() => ref.current?.close()} aria-label="Close">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
          </button>
        </header>

        <section>
          <h3>Where it comes from</h3>
          <p>
            Every report is from <a href="https://data.police.uk/" target="_blank" rel="noopener">police.uk</a>, the official open crime data for England, Wales and
            Northern Ireland: {num(total)} reports from {month(first, true)} to {month(latest, true)}. Coventry is policed by West Midlands Police; Leamington, Warwick
            and Kenilworth by Warwickshire Police. A few reports come from British Transport Police at stations.
          </p>
        </section>

        <section>
          <h3>When it updates</h3>
          <p>
            police.uk publishes once a month, about seven to eight weeks after the month ends. This site checks every day and adds each new month as soon as it
            appears. <strong>{month(nextMonth, true)}</strong> should arrive in the second half of {publishMonth(nextMonth)}.
            Past months are kept here even after police.uk drops them from its 36-month window.
          </p>
        </section>

        <section className="callout">
          <h3>What the data can&rsquo;t tell you</h3>
          <ul className="ticks">
            <li>
              <strong>No times.</strong> Reports carry a month only, never a day or an hour. Nobody can honestly show you &ldquo;risky after 10pm&rdquo; from this data.
            </li>
            <li>
              <strong>Approximate places.</strong> Each crime is moved to the nearest of a fixed set of points, a street or a venue such as &ldquo;Supermarket&rdquo;, so
              victims can&rsquo;t be identified. Hexes smooth this out; don&rsquo;t read meaning into a single building.
            </li>
            <li>
              <strong>Counts, not risk.</strong> The city centre is busiest because that&rsquo;s where people and shops are. A high count doesn&rsquo;t mean a high chance
              that something happens to you.
            </li>
            <li>
              <strong>Reported crime only.</strong> Much crime never gets reported, especially bike theft, harassment and sexual offences.
            </li>
            <li>
              <strong>Some counts show where police were active.</strong> Drugs and weapons offences rise where police search people.
            </li>
          </ul>
        </section>

        <section>
          <h3>Reading the map</h3>
          <p>
            Each hex adds up every report inside it for the categories and months you&rsquo;ve chosen. Colours are relative: the palest class is the quietest fifth or so
            of areas with any reports, and the darkest is the top two per cent. Hexes get smaller as you zoom in. The <strong>3D</strong> button raises each hex by
            its count.
          </p>
        </section>

        <section>
          <h3>News pins</h3>
          <p>
            Local news stories are read every 30 minutes. Claude, an AI model, sorts out which ones are about crime in this area, and picks out the street or area
            named. Pins are approximate, never merged into the counts, and always link to the original article.
          </p>
        </section>

        <section>
          <h3>Credits</h3>
          <p className="note">
            Contains public sector information licensed under the Open Government Licence v3.0. Map data © OpenStreetMap contributors, tiles by OpenFreeMap.
            {about ? (
              <>
                {" "}
                <a href={about.url} target="_blank" rel="noopener">
                  {about.title} ↗
                </a>
              </>
            ) : null}
          </p>
        </section>
      </div>
    </dialog>
  );
}
