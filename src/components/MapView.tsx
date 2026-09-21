"use client";

import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MLMap, MapLayerMouseEvent } from "maplibre-gl";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { MAPLIBRE_WORKER_URL } from "@/generated/assets";
import { levelForZoom } from "@/lib/hex";
import { BASEMAPS, HEAT, NEWS_PIN, SELECT_LINE, type Basemap, type Tone } from "@/lib/theme";

export type HexFeatures = GeoJSON.FeatureCollection<GeoJSON.Polygon, { n: number; k: number; h: number }>;
export type NewsFeatures = GeoJSON.FeatureCollection<GeoJSON.Point, { id: string; title: string; source: string; when: string; cat: string; url: string; area: number; u: number }>;
/** A searched street: its OSM points ("street") and the police.uk points counted for it ("police", n = reports). */
export type FocusFeatures = GeoJSON.FeatureCollection<GeoJSON.Point, { kind: "street" | "police"; n: number }>;

type Props = {
  basemap: Basemap;
  hexes: HexFeatures;
  selected: [number, number][] | null;
  focus: FocusFeatures;
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

function heatMatch(tone: Tone): maplibregl.ExpressionSpecification {
  const stops: (number | string)[] = [];
  HEAT[tone].forEach((c, i) => stops.push(i, c));
  return ["match", ["get", "k"], ...stops, HEAT[tone][0]] as unknown as maplibregl.ExpressionSpecification;
}

export default function MapView(props: Props) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const [styleSeq, setStyleSeq] = useState(0);
  const [hover, setHover] = useState<{ id: number; x: number; y: number } | null>(null);
  const hoverId = useRef<number | null>(null);
  const basemapRef = useRef(props.basemap);

  // create the map once
  useEffect(() => {
    if (!box.current) return;
    maplibregl.setWorkerUrl(MAPLIBRE_WORKER_URL);
    const map = new maplibregl.Map({
      container: box.current,
      style: BASEMAPS[props.basemap].url,
      bounds: HOME,
      fitBoundsOptions: { padding: 24 },
      minZoom: 9.5,
      maxZoom: 17.5,
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
      if (latest.current.basemap === "dark") boostDarkContrast(map);
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
      tag.textContent = [p.cat, p.area ? "approximate area" : "", p.u ? "not yet in police data" : ""].filter(Boolean).join(" · ");
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

  // basemap -> swap style (our layers are re-added on style.load)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || basemapRef.current === props.basemap) return;
    basemapRef.current = props.basemap;
    map.setStyle(BASEMAPS[props.basemap].url, { diff: false });
  }, [props.basemap]);

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
    (mapRef.current?.getSource("focus") as GeoJSONSource | undefined)?.setData(props.focus);
  }, [props.focus, styleSeq]);

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

/** The stock dark style keeps roads and labels very dim. Lift them so streets and names read. */
function boostDarkContrast(map: MLMap) {
  for (const layer of map.getStyle().layers) {
    const src = (layer as { "source-layer"?: string })["source-layer"];
    try {
      if (layer.type === "line" && src === "transportation") {
        const id = layer.id;
        const color = /casing/.test(id)
          ? "#0b0e12"
          : /motorway|trunk|primary/.test(id)
            ? "#aeb6c2"
            : /secondary|tertiary/.test(id)
              ? "#8f98a6"
              : /rail|transit/.test(id)
                ? "#5c6573"
                : "#6c7584";
        map.setPaintProperty(id, "line-color", color);
      } else if (layer.type === "symbol" && layer.layout && "text-field" in layer.layout) {
        map.setPaintProperty(layer.id, "text-color", /place|city|town|village|suburb/.test(layer.id) ? "#f2f4f7" : "#d7dde6");
        map.setPaintProperty(layer.id, "text-halo-color", "#0b0e12");
        map.setPaintProperty(layer.id, "text-halo-width", 1.6);
      }
    } catch {
      // a layer that doesn't take that property: leave it as the style set it
    }
  }
}

function addLayers(map: MLMap, p: Props) {
  const { tone, ground } = BASEMAPS[p.basemap];
  const layers = map.getStyle().layers;
  // hexes go under the road network, so streets and their names draw on top of the colour
  const underRoads =
    layers.find((l) => (l as { "source-layer"?: string })["source-layer"] === "transportation")?.id ?? layers.find((l) => l.type === "symbol")?.id;
  const firstSymbol = layers.find((l) => l.type === "symbol")?.id;

  map.addSource("hex", { type: "geojson", data: p.hexes });
  map.addSource("selected", { type: "geojson", data: EMPTY });
  map.addSource("focus", { type: "geojson", data: p.focus });
  map.addSource("news", { type: "geojson", data: p.news });

  map.addLayer(
    {
      id: "hex-fill",
      type: "fill",
      source: "hex",
      layout: { visibility: p.mode3d ? "none" : "visible" },
      paint: { "fill-color": heatMatch(tone), "fill-opacity": tone === "light" ? 0.62 : 0.72 },
    },
    underRoads,
  );
  map.addLayer(
    {
      id: "hex-edge",
      type: "line",
      source: "hex",
      layout: { visibility: p.mode3d ? "none" : "visible" },
      paint: {
        "line-color": ["case", ["boolean", ["feature-state", "hover"], false], SELECT_LINE[tone], ground],
        "line-width": ["case", ["boolean", ["feature-state", "hover"], false], 2.5, 1],
        "line-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.95, 0.6],
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
      "fill-extrusion-color": heatMatch(tone),
      "fill-extrusion-height": ["get", "h"],
      "fill-extrusion-opacity": 0.92,
      "fill-extrusion-vertical-gradient": true,
    },
  });
  map.addLayer({ id: "selected-casing", type: "line", source: "selected", paint: { "line-color": ground, "line-width": 6, "line-opacity": 0.9 } });
  map.addLayer({ id: "selected-line", type: "line", source: "selected", paint: { "line-color": SELECT_LINE[tone], "line-width": 2.5 } });
  // searched street: its course as small dots, and the police.uk points counted for it as rings sized by reports
  map.addLayer({
    id: "focus-street",
    type: "circle",
    source: "focus",
    filter: ["==", ["get", "kind"], "street"],
    paint: { "circle-radius": 4, "circle-color": NEWS_PIN[tone].fill, "circle-stroke-width": 1.5, "circle-stroke-color": NEWS_PIN[tone].ring },
  });
  map.addLayer({
    id: "focus-police",
    type: "circle",
    source: "focus",
    filter: ["==", ["get", "kind"], "police"],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["sqrt", ["get", "n"]], 1, 6, 10, 16],
      "circle-color": SELECT_LINE[tone],
      "circle-opacity": 0.12,
      "circle-stroke-width": 2,
      "circle-stroke-color": SELECT_LINE[tone],
    },
  });
  map.addLayer({
    id: "news-halo",
    type: "circle",
    source: "news",
    layout: { visibility: p.showNews ? "visible" : "none" },
    filter: ["==", ["get", "area"], 1],
    paint: { "circle-radius": 22, "circle-color": NEWS_PIN[tone].fill, "circle-opacity": 0.14, "circle-stroke-width": 1, "circle-stroke-color": NEWS_PIN[tone].fill, "circle-stroke-opacity": 0.4 },
  });
  map.addLayer({
    id: "news-pin",
    type: "circle",
    source: "news",
    layout: { visibility: p.showNews ? "visible" : "none" },
    // filled pin: police.uk has published that month; hollow pin: not yet in police data
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 5, 15, 8],
      "circle-color": ["case", ["==", ["get", "u"], 1], NEWS_PIN[tone].ring, NEWS_PIN[tone].fill],
      "circle-stroke-width": ["case", ["==", ["get", "u"], 1], 3, 2.5],
      "circle-stroke-color": ["case", ["==", ["get", "u"], 1], NEWS_PIN[tone].fill, NEWS_PIN[tone].ring],
    },
  });
}
