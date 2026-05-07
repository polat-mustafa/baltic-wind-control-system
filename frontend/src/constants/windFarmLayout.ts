/**
 * Wind farm layout constants — 34 turbine positions across 6 strings.
 *
 * Layout: 6 strings of 5-6 turbines each, arranged NW-SE to minimise
 * wake losses from the prevailing SW wind (Baltic Sea, ~240 deg).
 * String spacing ~1200 m (8D), turbine spacing ~900 m (6D) along string.
 * Alternate strings (2, 4, 6) staggered ~700 m south to reduce
 * systematic wake alignment from prevailing SW wind.
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
  /** WGS84 latitude (decimal degrees) — Polish Baltic EEZ */
  lat: number;
  /** WGS84 longitude (decimal degrees) */
  lon: number;
}

/**
 * 34 turbine positions arranged in 6 strings.
 * Strings run roughly N-S, spaced E-W across the wind farm area.
 * Coordinates are in SVG viewBox units.
 */
/**
 * 34 turbine positions arranged in 6 strings.
 *
 * Geographic coordinates: centered ~54.75°N, 16.4°E (Polish Baltic EEZ).
 * String spacing ~1,888m (8D) east-west ≈ 0.0295° lon at 54.75°N.
 * Turbine spacing ~1,416m (6D) north-south ≈ 0.01272° lat.
 */
export const TURBINE_POSITIONS: TurbinePosition[] = [
  // String 1 (6 turbines) — westernmost
  { id: "WTG-01", stringNumber: 1, x: 80, y: 120, lat: 54.7819, lon: 16.323 },
  { id: "WTG-02", stringNumber: 1, x: 90, y: 200, lat: 54.7692, lon: 16.323 },
  { id: "WTG-03", stringNumber: 1, x: 100, y: 280, lat: 54.7564, lon: 16.323 },
  { id: "WTG-04", stringNumber: 1, x: 95, y: 360, lat: 54.7437, lon: 16.323 },
  { id: "WTG-05", stringNumber: 1, x: 85, y: 440, lat: 54.731, lon: 16.323 },
  { id: "WTG-06", stringNumber: 1, x: 90, y: 520, lat: 54.7182, lon: 16.323 },

  // String 2 (6 turbines) — staggered 700 m south
  { id: "WTG-07", stringNumber: 2, x: 180, y: 100, lat: 54.7756, lon: 16.3525 },
  { id: "WTG-08", stringNumber: 2, x: 190, y: 180, lat: 54.7629, lon: 16.3525 },
  { id: "WTG-09", stringNumber: 2, x: 195, y: 260, lat: 54.7501, lon: 16.3525 },
  { id: "WTG-10", stringNumber: 2, x: 185, y: 340, lat: 54.7374, lon: 16.3525 },
  { id: "WTG-11", stringNumber: 2, x: 180, y: 420, lat: 54.7247, lon: 16.3525 },
  { id: "WTG-12", stringNumber: 2, x: 185, y: 500, lat: 54.7119, lon: 16.3525 },

  // String 3 (6 turbines)
  { id: "WTG-13", stringNumber: 3, x: 280, y: 110, lat: 54.7819, lon: 16.382 },
  { id: "WTG-14", stringNumber: 3, x: 290, y: 190, lat: 54.7692, lon: 16.382 },
  { id: "WTG-15", stringNumber: 3, x: 285, y: 270, lat: 54.7564, lon: 16.382 },
  { id: "WTG-16", stringNumber: 3, x: 280, y: 350, lat: 54.7437, lon: 16.382 },
  { id: "WTG-17", stringNumber: 3, x: 275, y: 430, lat: 54.731, lon: 16.382 },
  { id: "WTG-18", stringNumber: 3, x: 285, y: 510, lat: 54.7182, lon: 16.382 },

  // String 4 (6 turbines) — staggered 700 m south
  { id: "WTG-19", stringNumber: 4, x: 380, y: 130, lat: 54.7756, lon: 16.4115 },
  { id: "WTG-20", stringNumber: 4, x: 390, y: 210, lat: 54.7629, lon: 16.4115 },
  { id: "WTG-21", stringNumber: 4, x: 385, y: 290, lat: 54.7501, lon: 16.4115 },
  { id: "WTG-22", stringNumber: 4, x: 380, y: 370, lat: 54.7374, lon: 16.4115 },
  { id: "WTG-23", stringNumber: 4, x: 375, y: 450, lat: 54.7247, lon: 16.4115 },
  { id: "WTG-24", stringNumber: 4, x: 380, y: 530, lat: 54.7119, lon: 16.4115 },

  // String 5 (5 turbines)
  { id: "WTG-25", stringNumber: 5, x: 480, y: 140, lat: 54.7819, lon: 16.441 },
  { id: "WTG-26", stringNumber: 5, x: 490, y: 220, lat: 54.7692, lon: 16.441 },
  { id: "WTG-27", stringNumber: 5, x: 485, y: 300, lat: 54.7564, lon: 16.441 },
  { id: "WTG-28", stringNumber: 5, x: 480, y: 380, lat: 54.7437, lon: 16.441 },
  { id: "WTG-29", stringNumber: 5, x: 475, y: 460, lat: 54.731, lon: 16.441 },

  // String 6 (5 turbines) — easternmost, staggered 700 m south
  { id: "WTG-30", stringNumber: 6, x: 570, y: 150, lat: 54.7756, lon: 16.4705 },
  { id: "WTG-31", stringNumber: 6, x: 580, y: 230, lat: 54.7629, lon: 16.4705 },
  { id: "WTG-32", stringNumber: 6, x: 575, y: 310, lat: 54.7501, lon: 16.4705 },
  { id: "WTG-33", stringNumber: 6, x: 570, y: 390, lat: 54.7374, lon: 16.4705 },
  { id: "WTG-34", stringNumber: 6, x: 565, y: 470, lat: 54.7247, lon: 16.4705 },
];

// ── Offshore Substation (OSS) ───────────────────────────────────

export const OSS_POSITION = { x: 640, y: 320 };
export const OSS_GEO = { lat: 54.75, lon: 16.495 };

// Floating LIDAR reference buoy — outside the turbine array so it remains
// visually distinct on the overview map and avoids turbine-wake obstruction.
export const LIDAR_GEO = { lat: 54.812, lon: 16.27 };

// ── Geographic Coordinates ───────────────────────────────────────

export const ONSHORE_GEO = { lat: 54.585, lon: 16.85 };

/** 220 kV export cable geographic waypoints — OSS to onshore (45 km undersea route) */
export const EXPORT_CABLE_GEO: { lat: number; lon: number }[] = [
  { lat: 54.75, lon: 16.495 }, // OSS
  { lat: 54.72, lon: 16.55 }, // Sea waypoint 1
  { lat: 54.68, lon: 16.62 }, // Sea waypoint 2
  { lat: 54.64, lon: 16.7 }, // Approaching coast
  { lat: 54.61, lon: 16.78 }, // Landfall
  { lat: 54.585, lon: 16.85 }, // Onshore substation
];

/** PSE grid connection line (extends east from onshore substation) */
export const PSE_GRID_LINE_GEO: [
  { lat: number; lon: number },
  { lat: number; lon: number },
] = [
  { lat: 54.585, lon: 16.85 },
  { lat: 54.585, lon: 16.92 },
];

/** Farm map center for Leaflet */
export const FARM_CENTER_GEO: [number, number] = [54.7, 16.55];
export const FARM_DEFAULT_ZOOM = 11;

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
  { x: 640, y: 320 }, // OSS
  { x: 700, y: 310 }, // Sea route waypoint 1
  { x: 780, y: 330 }, // Sea route waypoint 2
  { x: 850, y: 360 }, // Approaching coast
  { x: 910, y: 400 }, // Landfall
  { x: 960, y: 420 }, // Onshore substation
];

// ── Onshore Substation (220/400 kV) ─────────────────────────────

export const ONSHORE_POSITION = { x: 960, y: 420 };

// ── Coastline Path (decorative) ─────────────────────────────────

export const COASTLINE_PATH =
  "M 880,0 Q 870,100 890,200 Q 910,300 880,400 Q 860,500 900,600 Q 920,650 910,700";

// ── Sea Area Boundary ───────────────────────────────────────────

export const SEA_BOUNDARY_X = 880; // Everything left of this is sea

// ── Bathymetry Contour Lines (depth in metres) ──────────────────
// Approximated isobaths for the Polish Baltic — shallow shelf slopes gently

export const BATHYMETRY_CONTOURS: {
  depth: number;
  path: string;
  label: { x: number; y: number };
}[] = [
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

// ── Bathymetry Contours — Geographic (for Leaflet) ──────────────
// Isobaths run roughly NE-SW, curving shoreward at southern end.
// Depths increase westward away from the Polish coastline.

export const BATHYMETRY_CONTOURS_GEO: {
  depth: number;
  points: [number, number][];
}[] = [
  {
    depth: 20,
    points: [
      [54.82, 16.58],
      [54.78, 16.6],
      [54.74, 16.62],
      [54.7, 16.64],
      [54.66, 16.67],
      [54.62, 16.71],
    ],
  },
  {
    depth: 30,
    points: [
      [54.82, 16.47],
      [54.78, 16.49],
      [54.74, 16.51],
      [54.7, 16.54],
      [54.66, 16.58],
      [54.62, 16.63],
    ],
  },
  {
    depth: 40,
    points: [
      [54.82, 16.36],
      [54.78, 16.38],
      [54.74, 16.41],
      [54.7, 16.44],
      [54.66, 16.49],
      [54.62, 16.55],
    ],
  },
  {
    depth: 50,
    points: [
      [54.82, 16.25],
      [54.78, 16.27],
      [54.74, 16.3],
      [54.7, 16.34],
      [54.66, 16.4],
      [54.62, 16.47],
    ],
  },
];

// ── Shipping Lane (TSS — Traffic Separation Scheme) ─────────────
// Simplified representation of the Baltic shipping corridor

export const SHIPPING_LANE: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}[] = [
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
