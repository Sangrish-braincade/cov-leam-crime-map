"use client";

import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MLMap, MapLayerMouseEvent } from "maplibre-gl";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { MAPLIBRE_WORKER_URL } from "@/generated/assets";
import { levelForZoom } from "@/lib/hex";
import { HEAT, MAP_STYLE, NEWS_PIN, SELECT_LINE, type Theme } from "@/lib/theme";

export type HexFeatures = GeoJSON.FeatureCollection<GeoJSON.Polygon, { n: number; k: number; h: number }>;
export type NewsFeatures = GeoJSON.FeatureCollection<GeoJSON.Point, { id: string; title: string; source: string; when: string; cat: string; url: string; area: number }>;

type Props = {
  theme: Theme;
  hexes: HexFeatures;
  selected: [number, number][] | null;
  news: NewsFeatures;
  showNews: boolean;
  mode3d: boolean;
  flyTo: { lng: number; lat: number; zoom: number; seq: number } | null;
  onLevel: (level: number) => void;
  onHexClick: (id: number) => void;
  renderTooltip: (id: number) => ReactNode;
  children?: ReactNode;
};

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const HOME: [[number, number], [number, number]] = [[-1.625, 52.27], [-1.43, 52.45]];

function heatMatch(theme: Theme): maplibregl.ExpressionSpecification {
  const stops: (number | string)[] = [];
  HEAT[theme].forEach((c, i) => stops.push(i, c));
  return ["match", ["get", "k"], ...stops, HEAT[theme][0]] as unknown as maplibregl.ExpressionSpecification;
}

export default function MapView(props: Props) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const [styleSeq, setStyleSeq] = useState(0);
  const [hover, setHover] = useState<{ id: number; x: number; y: number } | null>(null);
  const hoverId = useRef<number | null>(null);
  const themeRef = useRef(props.theme);

  // create the map once
  useEffect(() => {
    if (!box.current) return;
    maplibregl.setWorkerUrl(MAPLIBRE_WORKER_URL);
    const map = new maplibregl.Map({
      container: box.current,
      style: MAP_STYLE[props.theme],
      bounds: HOME,
      fitBoundsOptions: { padding: 24 },
      minZoom: 9.5,
      maxZoom: 16.8,
      maxBounds: [[-2.1, 52.05], [-0.95, 52.7]],
      attributionControl: false,
      maxPitch: 65,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        customAttribution: 'Crime data <a href="https://data.police.uk/" target="_blank" rel="noopener">police.uk</a> (OGL v3.0)',
      }),
      "bottom-right",
    );

    map.on("style.load", () => {
      addLayers(map, latest.current);
      setStyleSeq((s) => s + 1);
    });

    const reportLevel = () => latest.current.onLevel(levelForZoom(map.getZoom()));
    map.on("zoomend", reportLevel);
    map.once("load", reportLevel);
    // on phones, fold the credits behind the (i) button once the map settles, so they don't cover the legend
    map.once("idle", () => {
      if (window.matchMedia("(max-width: 899px)").matches) {
        box.current?.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
      }
    });

    const setHoverState = (id: number | null) => {
      if (hoverId.current !== null && map.getSource("hex")) map.setFeatureState({ source: "hex", id: hoverId.current }, { hover: false });
      hoverId.current = id;
      if (id !== null) map.setFeatureState({ source: "hex", id }, { hover: true });
    };
    const onMove = (e: MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f || typeof f.id !== "number") return;
      if (map.queryRenderedFeatures(e.point, { layers: ["news-pin"] }).length) {
        setHoverState(null);
        setHover(null);
        return;
      }
      if (hoverId.current !== f.id) setHoverState(f.id);
      setHover({ id: f.id, x: e.point.x, y: e.point.y });
      map.getCanvas().style.cursor = "pointer";
    };
    const onLeave = () => {
      setHoverState(null);
      setHover(null);
      map.getCanvas().style.cursor = "";
    };
    const onClick = (e: MapLayerMouseEvent) => {
      if (map.queryRenderedFeatures(e.point, { layers: ["news-pin"] }).length) return;
      const f = e.features?.[0];
      if (f && typeof f.id === "number") latest.current.onHexClick(f.id);
    };
    for (const layer of ["hex-fill", "hex-3d"]) {
      map.on("mousemove", layer, onMove);
      map.on("mouseleave", layer, onLeave);
      map.on("click", layer, onClick);
    }

    map.on("mouseenter", "news-pin", () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", "news-pin", () => (map.getCanvas().style.cursor = ""));
    map.on("click", "news-pin", (e: MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f) return;
      const p = f.properties as NewsFeatures["features"][number]["properties"];
      const el = document.createElement("div");
      el.className = "news-pop";
      const meta = document.createElement("div");
      meta.className = "news-pop-meta";
      meta.textContent = `${p.source} · ${p.when}`;
      const a = document.createElement("a");
      a.href = p.url;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = p.title;
      const tag = document.createElement("div");
      tag.className = "news-pop-tag";
      tag.textContent = p.area ? `${p.cat} · approximate area` : p.cat;
      el.append(meta, a, tag);
      new maplibregl.Popup({ offset: 12, maxWidth: "300px", closeButton: true })
        .setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
        .setDOMContent(el)
        .addTo(map);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // theme -> swap basemap (layers are re-added on style.load)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || themeRef.current === props.theme) return;
    themeRef.current = props.theme;
    map.setStyle(MAP_STYLE[props.theme], { diff: false });
  }, [props.theme]);

  useEffect(() => {
    (mapRef.current?.getSource("hex") as GeoJSONSource | undefined)?.setData(props.hexes);
  }, [props.hexes, styleSeq]);

  useEffect(() => {
    const src = mapRef.current?.getSource("selected") as GeoJSONSource | undefined;
    src?.setData(
      props.selected
        ? { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [props.selected] } }
        : EMPTY,
    );
  }, [props.selected, styleSeq]);

  useEffect(() => {
    (mapRef.current?.getSource("news") as GeoJSONSource | undefined)?.setData(props.news);
  }, [props.news, styleSeq]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer("news-pin")) return;
    const v = props.showNews ? "visible" : "none";
    map.setLayoutProperty("news-pin", "visibility", v);
    map.setLayoutProperty("news-halo", "visibility", v);
  }, [props.showNews, styleSeq]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer("hex-3d")) return;
    map.setLayoutProperty("hex-3d", "visibility", props.mode3d ? "visible" : "none");
    map.setLayoutProperty("hex-fill", "visibility", props.mode3d ? "none" : "visible");
    map.setLayoutProperty("hex-edge", "visibility", props.mode3d ? "none" : "visible");
  }, [props.mode3d, styleSeq]);

  const was3d = useRef(props.mode3d);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || was3d.current === props.mode3d) return;
    was3d.current = props.mode3d;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.easeTo({ pitch: props.mode3d ? 55 : 0, bearing: props.mode3d ? -18 : 0, duration: reduce ? 0 : 900 });
  }, [props.mode3d]);

  useEffect(() => {
    const f = props.flyTo;
    if (!f || !mapRef.current) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    mapRef.current.flyTo({ center: [f.lng, f.lat], zoom: f.zoom, essential: true, duration: reduce ? 0 : 1400 });
  }, [props.flyTo]);

  return (
    <div className="map-wrap">
      <div ref={box} className="map" role="region" aria-label="Crime map of Coventry and Leamington" />
      {hover && (
        <div className="map-tip" style={{ left: hover.x, top: hover.y }} role="status">
          {props.renderTooltip(hover.id)}
        </div>
      )}
      {props.children}
    </div>
  );
}

function addLayers(map: MLMap, p: Props) {
  const theme = p.theme;
  const firstSymbol = map.getStyle().layers.find((l) => l.type === "symbol")?.id;
  const bg = theme === "light" ? "#f5f6f7" : "#0e1116";

  map.addSource("hex", { type: "geojson", data: p.hexes });
  map.addSource("selected", { type: "geojson", data: EMPTY });
  map.addSource("news", { type: "geojson", data: p.news });

  // hexes sit under the basemap's labels so street and place names stay readable
  map.addLayer(
    {
      id: "hex-fill",
      type: "fill",
      source: "hex",
      layout: { visibility: p.mode3d ? "none" : "visible" },
      paint: { "fill-color": heatMatch(theme), "fill-opacity": theme === "light" ? 0.8 : 0.85 },
    },
    firstSymbol,
  );
  map.addLayer(
    {
      id: "hex-edge",
      type: "line",
      source: "hex",
      layout: { visibility: p.mode3d ? "none" : "visible" },
      paint: {
        "line-color": ["case", ["boolean", ["feature-state", "hover"], false], SELECT_LINE[theme], bg],
        "line-width": ["case", ["boolean", ["feature-state", "hover"], false], 2, 1],
        "line-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.9, 0.7],
      },
    },
    firstSymbol,
  );
  map.addLayer({
    id: "hex-3d",
    type: "fill-extrusion",
    source: "hex",
    layout: { visibility: p.mode3d ? "visible" : "none" },
    paint: {
      "fill-extrusion-color": heatMatch(theme),
      "fill-extrusion-height": ["get", "h"],
      "fill-extrusion-opacity": 0.92,
      "fill-extrusion-vertical-gradient": true,
    },
  });
  map.addLayer({
    id: "selected-casing",
    type: "line",
    source: "selected",
    paint: { "line-color": bg, "line-width": 6, "line-opacity": 0.9 },
  });
  map.addLayer({
    id: "selected-line",
    type: "line",
    source: "selected",
    paint: { "line-color": SELECT_LINE[theme], "line-width": 2.5 },
  });
  map.addLayer({
    id: "news-halo",
    type: "circle",
    source: "news",
    layout: { visibility: p.showNews ? "visible" : "none" },
    filter: ["==", ["get", "area"], 1],
    paint: { "circle-radius": 22, "circle-color": NEWS_PIN[theme].fill, "circle-opacity": 0.14, "circle-stroke-width": 1, "circle-stroke-color": NEWS_PIN[theme].fill, "circle-stroke-opacity": 0.4 },
  });
  map.addLayer({
    id: "news-pin",
    type: "circle",
    source: "news",
    layout: { visibility: p.showNews ? "visible" : "none" },
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 5, 15, 8],
      "circle-color": NEWS_PIN[theme].fill,
      "circle-stroke-width": 2.5,
      "circle-stroke-color": NEWS_PIN[theme].ring,
    },
  });
}
