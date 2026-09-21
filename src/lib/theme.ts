export type Theme = "light" | "dark";
export type Tone = "light" | "dark";

// Semantic heat ramp, one per map tone. Light: pale -> deep, so quiet areas recede
// into a light basemap. Dark: deep -> bright, for the same reason on a dark map.
export const HEAT: Record<Tone, string[]> = {
  light: ["#fde6a6", "#f9bd6b", "#f28f4c", "#dd5c3c", "#b43537", "#7a1d34"],
  dark: ["#4f1d2c", "#832b31", "#bb4531", "#e3713a", "#f5a24d", "#fcd98c"],
};

// The basemap is chosen separately from the page theme: a dark page can sit on a
// colourful street map. "streets" is the default because street names matter most.
export type Basemap = "streets" | "light" | "dark";
export const BASEMAPS: Record<Basemap, { label: string; url: string; tone: Tone; ground: string }> = {
  streets: { label: "Streets", url: "https://tiles.openfreemap.org/styles/liberty", tone: "light", ground: "#f8f4f0" },
  light: { label: "Light", url: "https://tiles.openfreemap.org/styles/positron", tone: "light", ground: "#f5f6f7" },
  dark: { label: "Dark", url: "https://tiles.openfreemap.org/styles/dark", tone: "dark", ground: "#0e1116" },
};

export const NEWS_PIN: Record<Tone, { fill: string; ring: string }> = {
  light: { fill: "#1f5fbf", ring: "#ffffff" },
  dark: { fill: "#6aa9ff", ring: "#0e1116" },
};

export const SELECT_LINE: Record<Tone, string> = { light: "#0f1720", dark: "#f4f6f8" };
