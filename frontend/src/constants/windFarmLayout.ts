/**
 * Wind farm layout constants — 34 turbine positions across 6 strings.
 *
 * Layout: 6 strings of 5-6 turbines each, arranged NW-SE to minimise
 * wake losses from the prevailing SW wind (Baltic Sea, ~240 deg).
 * String spacing ~1200 m (8D), turbine spacing ~900 m (6D) along string.
 *
 * SVG canvas: 1200 x 700 viewBox. Sea occupies left 70%, coast/land right 30%.
 */

// ── SVG Canvas ──────────────────────────────────────────────────

export const SVG_VIEWBOX = { width: 1200, height: 700 };

// ── Turbine Positions (6 strings × 5-6 turbines = 34 total) ────

export interface TurbinePosition {
  id: string;
  stringNumber: number;
  x: number;
  y: number;
}

/**
 * 34 turbine positions arranged in 6 strings.
 * Strings run roughly N-S, spaced E-W across the wind farm area.
 * Coordinates are in SVG viewBox units.
 */
export const TURBINE_POSITIONS: TurbinePosition[] = [
  // String 1 (6 turbines) — westernmost
  { id: "WTG-01", stringNumber: 1, x: 80, y: 120 },
  { id: "WTG-02", stringNumber: 1, x: 90, y: 200 },
  { id: "WTG-03", stringNumber: 1, x: 100, y: 280 },
  { id: "WTG-04", stringNumber: 1, x: 95, y: 360 },
  { id: "WTG-05", stringNumber: 1, x: 85, y: 440 },
  { id: "WTG-06", stringNumber: 1, x: 90, y: 520 },

  // String 2 (6 turbines)
  { id: "WTG-07", stringNumber: 2, x: 180, y: 100 },
  { id: "WTG-08", stringNumber: 2, x: 190, y: 180 },
  { id: "WTG-09", stringNumber: 2, x: 195, y: 260 },
  { id: "WTG-10", stringNumber: 2, x: 185, y: 340 },
  { id: "WTG-11", stringNumber: 2, x: 180, y: 420 },
  { id: "WTG-12", stringNumber: 2, x: 185, y: 500 },

  // String 3 (6 turbines)
  { id: "WTG-13", stringNumber: 3, x: 280, y: 110 },
  { id: "WTG-14", stringNumber: 3, x: 290, y: 190 },
  { id: "WTG-15", stringNumber: 3, x: 285, y: 270 },
  { id: "WTG-16", stringNumber: 3, x: 280, y: 350 },
  { id: "WTG-17", stringNumber: 3, x: 275, y: 430 },
  { id: "WTG-18", stringNumber: 3, x: 285, y: 510 },

  // String 4 (6 turbines)
  { id: "WTG-19", stringNumber: 4, x: 380, y: 130 },
  { id: "WTG-20", stringNumber: 4, x: 390, y: 210 },
  { id: "WTG-21", stringNumber: 4, x: 385, y: 290 },
  { id: "WTG-22", stringNumber: 4, x: 380, y: 370 },
  { id: "WTG-23", stringNumber: 4, x: 375, y: 450 },
  { id: "WTG-24", stringNumber: 4, x: 380, y: 530 },

  // String 5 (5 turbines)
  { id: "WTG-25", stringNumber: 5, x: 480, y: 140 },
  { id: "WTG-26", stringNumber: 5, x: 490, y: 220 },
  { id: "WTG-27", stringNumber: 5, x: 485, y: 300 },
  { id: "WTG-28", stringNumber: 5, x: 480, y: 380 },
  { id: "WTG-29", stringNumber: 5, x: 475, y: 460 },

  // String 6 (5 turbines) — easternmost
  { id: "WTG-30", stringNumber: 6, x: 570, y: 150 },
  { id: "WTG-31", stringNumber: 6, x: 580, y: 230 },
  { id: "WTG-32", stringNumber: 6, x: 575, y: 310 },
  { id: "WTG-33", stringNumber: 6, x: 570, y: 390 },
  { id: "WTG-34", stringNumber: 6, x: 565, y: 470 },
];

// ── Offshore Substation (OSS) ───────────────────────────────────

export const OSS_POSITION = { x: 640, y: 320 };

// ── 66 kV Array Cable Collection Points ─────────────────────────
// Each string's last turbine connects to the OSS via 66 kV cable

export const STRING_COLLECTION_POINTS = [
  { stringNumber: 1, lastTurbineId: "WTG-06", x: 90, y: 520 },
  { stringNumber: 2, lastTurbineId: "WTG-12", x: 185, y: 500 },
  { stringNumber: 3, lastTurbineId: "WTG-18", x: 285, y: 510 },
  { stringNumber: 4, lastTurbineId: "WTG-24", x: 380, y: 530 },
  { stringNumber: 5, lastTurbineId: "WTG-29", x: 475, y: 460 },
  { stringNumber: 6, lastTurbineId: "WTG-34", x: 565, y: 470 },
];

// ── 220 kV Export Cable Route (OSS → Onshore Substation) ────────

export const EXPORT_CABLE_PATH: { x: number; y: number }[] = [
  { x: 640, y: 320 },   // OSS
  { x: 700, y: 310 },   // Sea route waypoint 1
  { x: 780, y: 330 },   // Sea route waypoint 2
  { x: 850, y: 360 },   // Approaching coast
  { x: 910, y: 400 },   // Landfall
  { x: 960, y: 420 },   // Onshore substation
];

// ── Onshore Substation (220/400 kV) ─────────────────────────────

export const ONSHORE_POSITION = { x: 960, y: 420 };

// ── Coastline Path (decorative) ─────────────────────────────────

export const COASTLINE_PATH = "M 880,0 Q 870,100 890,200 Q 910,300 880,400 Q 860,500 900,600 Q 920,650 910,700";

// ── Sea Area Boundary ───────────────────────────────────────────

export const SEA_BOUNDARY_X = 880; // Everything left of this is sea

// ── Bathymetry Contour Lines (depth in metres) ──────────────────
// Approximated isobaths for the Polish Baltic — shallow shelf slopes gently

export const BATHYMETRY_CONTOURS: { depth: number; path: string; label: { x: number; y: number } }[] = [
  {
    depth: 20,
    path: "M 0,620 Q 200,600 400,610 Q 600,630 800,660 Q 850,670 880,680",
    label: { x: 420, y: 600 },
  },
  {
    depth: 30,
    path: "M 0,450 Q 150,430 350,450 Q 550,470 750,520 Q 830,550 870,580",
    label: { x: 370, y: 442 },
  },
  {
    depth: 40,
    path: "M 0,280 Q 120,260 300,290 Q 480,320 660,380 Q 800,440 860,480",
    label: { x: 320, y: 282 },
  },
  {
    depth: 50,
    path: "M 0,140 Q 100,130 250,160 Q 400,200 560,270 Q 720,350 840,400",
    label: { x: 270, y: 155 },
  },
];

// ── Shipping Lane (TSS — Traffic Separation Scheme) ─────────────
// Simplified representation of the Baltic shipping corridor

export const SHIPPING_LANE: { x1: number; y1: number; x2: number; y2: number }[] = [
  { x1: 0, y1: 60, x2: 200, y2: 55 },
  { x1: 200, y1: 55, x2: 450, y2: 65 },
  { x1: 450, y1: 65, x2: 700, y2: 80 },
  { x1: 700, y1: 80, x2: 880, y2: 95 },
];

// ── Lat/Lon Grid (approximate for SVG overlay) ──────────────────
// Polish Baltic ~54.5°N to 55.0°N, ~16.0°E to 17.0°E

export const LAT_LON_GRID = {
  latLines: [
    { y: 100, label: "55.0°N" },
    { y: 300, label: "54.8°N" },
    { y: 500, label: "54.6°N" },
  ],
  lonLines: [
    { x: 120, label: "16.0°E" },
    { x: 360, label: "16.3°E" },
    { x: 600, label: "16.6°E" },
    { x: 840, label: "16.9°E" },
  ],
};
