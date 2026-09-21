"use client";

import { useId, useMemo, useState } from "react";
import type { CrimeData, SearchEntry } from "@/lib/crimeData";

const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "").replace(/\bst\b/g, "saint");

export default function SearchBox({ data, onPick }: { data: CrimeData | null; onPick: (e: SearchEntry) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();

  const results = useMemo(() => {
    if (!data || q.trim().length < 2) return [];
    const nq = norm(q.trim());
    const starts: SearchEntry[] = [];
    const contains: SearchEntry[] = [];
    for (const e of data.search) {
      const n = norm(e.name);
      if (n.startsWith(nq)) starts.push(e);
      else if (n.includes(nq)) contains.push(e);
      if (starts.length > 12) break;
    }
    return [...starts, ...contains].slice(0, 8);
  }, [data, q]);

  const pick = (e: SearchEntry) => {
    onPick(e);
    setQ(e.name);
    setOpen(false);
  };

  return (
    <div className="search">
      <svg viewBox="0 0 16 16" aria-hidden="true" className="search-icon"><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5 14 14" /></svg>
      <input
        id="street-search"
        type="search"
        placeholder={data ? "Search a street or area" : "Loading streets…"}
        value={q}
        disabled={!data}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(results.length - 1, a + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === "Enter" && results[active]) {
            e.preventDefault();
            pick(results[active]);
          } else if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && results.length > 0 ? (
        <ul id={listId} role="listbox" className="search-results">
          {results.map((r, i) => (
            <li
              key={`${r.name}-${r.lat}-${r.lng}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(r);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span>{r.name}</span>
              <small>{r.kind === "place" ? placeKind(r.area) : r.area}</small>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function placeKind(k: string) {
  return { campus: "University", centre: "Town centre", station: "Station", town: "Town", city: "City", suburb: "Area", neighbourhood: "Area", village: "Village" }[k] ?? "Place";
}
