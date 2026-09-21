"use client";

import { useId, useMemo, useState } from "react";
import type { CrimeData, SearchEntry } from "@/lib/crimeData";
import { loadStreetIndex, type Street, type StreetIndex } from "@/lib/streets";

type Option = { kind: "street"; street: Street } | { kind: "place"; place: SearchEntry };

const PLACE_KIND: Record<string, string> = { campus: "University", centre: "Town centre", station: "Station", town: "Town", city: "City", suburb: "Area", neighbourhood: "Area", village: "Village", landmark: "Landmark" };
const titleCase = (s: string) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
const streetWhere = (s: Street) => (s.area && s.area !== s.town ? `${s.area}, ${s.town}` : s.town || s.area);

export default function SearchBox({
  data,
  streetsUrl,
  onPickStreet,
  onPickPlace,
}: {
  data: CrimeData | null;
  streetsUrl: string;
  onPickStreet: (s: Street, typed: string) => void;
  onPickPlace: (p: SearchEntry) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [index, setIndex] = useState<StreetIndex | null>(null);
  const [loading, setLoading] = useState(false);
  const listId = useId();

  const ensureIndex = () => {
    if (index || loading || !data) return;
    setLoading(true);
    loadStreetIndex(streetsUrl, data.areas)
      .then(setIndex)
      .finally(() => setLoading(false));
  };

  const found = useMemo(() => {
    const text = q.trim();
    if (text.length < 2) return { options: [] as Option[], missing: "", suggestions: [] as Street[] };
    const lower = text.toLowerCase();
    const places: Option[] = (data?.search ?? [])
      .filter((e) => e.kind === "place" && e.name.toLowerCase().startsWith(lower))
      .slice(0, 3)
      .map((place) => ({ kind: "place", place }));
    const s = index?.search(text, 8);
    const streets: Option[] = (s?.results ?? []).map((street) => ({ kind: "street", street }));
    return {
      options: [...(/^\d/.test(text) ? [] : places), ...streets],
      missing: s && !s.results.length ? s.query : "",
      suggestions: s?.suggestions ?? [],
    };
  }, [q, index, data]);

  const choose = (o: Option) => {
    if (o.kind === "street") {
      onPickStreet(o.street, q.trim());
      setQ(o.street.name);
    } else {
      onPickPlace(o.place);
      setQ(o.place.name);
    }
    setOpen(false);
  };

  const showList = open && (found.options.length > 0 || found.missing || loading);

  return (
    <div className="search">
      <svg viewBox="0 0 16 16" aria-hidden="true" className="search-icon"><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5 14 14" /></svg>
      <input
        id="street-search"
        type="search"
        placeholder={data ? "Search an address, street or area" : "Loading…"}
        value={q}
        disabled={!data}
        autoComplete="off"
        role="combobox"
        aria-expanded={Boolean(showList)}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && found.options[active] ? `${listId}-${active}` : undefined}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
          ensureIndex();
        }}
        onFocus={() => {
          setOpen(true);
          ensureIndex();
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(found.options.length - 1, a + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === "Enter" && found.options[active]) {
            e.preventDefault();
            choose(found.options[active]);
          } else if (e.key === "Escape") setOpen(false);
        }}
      />
      {showList ? (
        <div className="search-results">
          {loading && !index ? <p className="search-note">Loading the street list…</p> : null}
          {found.options.length ? (
            <ul id={listId} role="listbox">
              {found.options.map((o, i) => (
                <li
                  key={o.kind === "street" ? `s${o.street.key}` : `p${o.place.name}`}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(o);
                  }}
                  onMouseEnter={() => setActive(i)}
                >
                  <span>{o.kind === "street" ? o.street.name : o.place.name}</span>
                  <small>{o.kind === "street" ? streetWhere(o.street) : PLACE_KIND[o.place.area] ?? "Place"}</small>
                </li>
              ))}
            </ul>
          ) : null}
          {found.missing ? (
            <div className="search-note">
              <p>
                No street called <strong>&ldquo;{titleCase(found.missing)}&rdquo;</strong> in Coventry, Leamington, Warwick or Kenilworth.
              </p>
              {found.suggestions.length ? (
                <>
                  <p>Did you mean:</p>
                  <ul className="search-suggest">
                    {found.suggestions.map((s) => (
                      <li key={s.key}>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => choose({ kind: "street", street: s })}>
                          {s.name} <small>{streetWhere(s)}</small>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
