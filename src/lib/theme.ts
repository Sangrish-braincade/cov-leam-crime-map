export type Theme = "light" | "dark";

// Semantic heat ramp, one per theme. Light: pale -> deep, so quiet areas recede
// into the pale basemap. Dark: deep -> bright, for the same reason on a dark map.
export const HEAT: Record<Theme, string[]> = {
  light: ["#fde6a6", "#f9bd6b", "#f28f4c", "#dd5c3c", "#b43537", "#7a1d34"],
  dark: ["#4f1d2c", "#832b31", "#bb4531", "#e3713a", "#f5a24d", "#fcd98c"],
};

export const MAP_STYLE: Record<Theme, string> = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
};

export const NEWS_PIN: Record<Theme, { fill: string; ring: string }> = {
  light: { fill: "#1f5fbf", ring: "#ffffff" },
  dark: { fill: "#6aa9ff", ring: "#0e1116" },
};

export const SELECT_LINE: Record<Theme, string> = { light: "#0f1720", dark: "#f4f6f8" };
