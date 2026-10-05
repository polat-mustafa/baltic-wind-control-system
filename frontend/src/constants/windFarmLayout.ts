/**
 * Wind farm geography — 34 × V236-15.0 MW turbines in 6 strings (6-6-6-6-5-5),
 * offshore substation, LIDAR, 45 km export route and grid connection.
 *
 * Strings run N-S, 8D (≈ 1.89 km) apart east-west; turbines 6D (≈ 1.42 km)
 * apart along a string; even strings staggered ≈ 700 m south so the
 * prevailing SW wind (≈ 225°) does not line turbines up in each other's wake.
 * Positions are real WGS84 coordinates checked against OSM and EMODnet
 * (see SITE_SOURCES); `x`/`y` are legacy schematic units used only for the
 * small per-turbine wind variation in the landing simulation.
 */

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
 * Geographic coordinates: centred ~54.80°N, 16.40°E, 35–40 km off Ustka.
 * String spacing ~1,890 m (8D) east-west ≈ 0.0295° lon at 54.8°N.
 * Turbine spacing ~1,415 m (6D) north-south ≈ 0.01272° lat.
 *
 * Site checks (2026-09-29, see SITE_SOURCES below): every turbine lies in
 * the Polish EEZ, outside the 12 nm territorial sea (Polish OWFs are only
 * permitted in the EEZ), south of the "Ławica Słupska" Natura 2000 site
 * (≈ 3.2 km from the nearest turbine), and in 29–40 m of water (EMODnet
 * DTM). The farm is fictional; it does not overlap a real OWF area.
 *
 * Re-checked 2026-10-05 against the Polish maritime spatial plan (Dz.U. 2021
 * poz. 935, via EMODnet): 27 of the 34 positions lie in basin PZP_15, whose
 * priority use is shipping — a real site here would not get a permit. The
 * Site & Permits screening (backend/app/services/site_assessment) reports it;
 * the case study keeps the layout as a teaching example.
 */
export const TURBINE_POSITIONS: TurbinePosition[] = [
  // String 1 (6 turbines) — westernmost
  { id: "WTG-01", stringNumber: 1, x: 80, y: 120, lat: 54.8319, lon: 16.323 },
  { id: "WTG-02", stringNumber: 1, x: 90, y: 200, lat: 54.8192, lon: 16.323 },
  { id: "WTG-03", stringNumber: 1, x: 100, y: 280, lat: 54.8064, lon: 16.323 },
  { id: "WTG-04", stringNumber: 1, x: 95, y: 360, lat: 54.7937, lon: 16.323 },
  { id: "WTG-05", stringNumber: 1, x: 85, y: 440, lat: 54.781, lon: 16.323 },
  { id: "WTG-06", stringNumber: 1, x: 90, y: 520, lat: 54.7682, lon: 16.323 },

  // String 2 (6 turbines) — staggered 700 m south
  { id: "WTG-07", stringNumber: 2, x: 180, y: 100, lat: 54.8256, lon: 16.3525 },
  { id: "WTG-08", stringNumber: 2, x: 190, y: 180, lat: 54.8129, lon: 16.3525 },
  { id: "WTG-09", stringNumber: 2, x: 195, y: 260, lat: 54.8001, lon: 16.3525 },
  { id: "WTG-10", stringNumber: 2, x: 185, y: 340, lat: 54.7874, lon: 16.3525 },
  { id: "WTG-11", stringNumber: 2, x: 180, y: 420, lat: 54.7747, lon: 16.3525 },
  { id: "WTG-12", stringNumber: 2, x: 185, y: 500, lat: 54.7619, lon: 16.3525 },

  // String 3 (6 turbines)
  { id: "WTG-13", stringNumber: 3, x: 280, y: 110, lat: 54.8319, lon: 16.382 },
  { id: "WTG-14", stringNumber: 3, x: 290, y: 190, lat: 54.8192, lon: 16.382 },
  { id: "WTG-15", stringNumber: 3, x: 285, y: 270, lat: 54.8064, lon: 16.382 },
  { id: "WTG-16", stringNumber: 3, x: 280, y: 350, lat: 54.7937, lon: 16.382 },
  { id: "WTG-17", stringNumber: 3, x: 275, y: 430, lat: 54.781, lon: 16.382 },
  { id: "WTG-18", stringNumber: 3, x: 285, y: 510, lat: 54.7682, lon: 16.382 },

  // String 4 (6 turbines) — staggered 700 m south
  { id: "WTG-19", stringNumber: 4, x: 380, y: 130, lat: 54.8256, lon: 16.4115 },
  { id: "WTG-20", stringNumber: 4, x: 390, y: 210, lat: 54.8129, lon: 16.4115 },
  { id: "WTG-21", stringNumber: 4, x: 385, y: 290, lat: 54.8001, lon: 16.4115 },
  { id: "WTG-22", stringNumber: 4, x: 380, y: 370, lat: 54.7874, lon: 16.4115 },
  { id: "WTG-23", stringNumber: 4, x: 375, y: 450, lat: 54.7747, lon: 16.4115 },
  { id: "WTG-24", stringNumber: 4, x: 380, y: 530, lat: 54.7619, lon: 16.4115 },

  // String 5 (5 turbines)
  { id: "WTG-25", stringNumber: 5, x: 480, y: 140, lat: 54.8319, lon: 16.441 },
  { id: "WTG-26", stringNumber: 5, x: 490, y: 220, lat: 54.8192, lon: 16.441 },
  { id: "WTG-27", stringNumber: 5, x: 485, y: 300, lat: 54.8064, lon: 16.441 },
  { id: "WTG-28", stringNumber: 5, x: 480, y: 380, lat: 54.7937, lon: 16.441 },
  { id: "WTG-29", stringNumber: 5, x: 475, y: 460, lat: 54.781, lon: 16.441 },

  // String 6 (5 turbines) — easternmost, staggered 700 m south
  { id: "WTG-30", stringNumber: 6, x: 570, y: 150, lat: 54.8256, lon: 16.4705 },
  { id: "WTG-31", stringNumber: 6, x: 580, y: 230, lat: 54.8129, lon: 16.4705 },
  { id: "WTG-32", stringNumber: 6, x: 575, y: 310, lat: 54.8001, lon: 16.4705 },
  { id: "WTG-33", stringNumber: 6, x: 570, y: 390, lat: 54.7874, lon: 16.4705 },
  { id: "WTG-34", stringNumber: 6, x: 565, y: 470, lat: 54.7747, lon: 16.4705 },
];

// ── Sources for all geographic values in this file ──────────────
// - Coastline, PSE substations, protected areas, maritime zones:
//   OpenStreetMap via Overpass API (queried 2026-09-29).
// - Water depth / isobaths: EMODnet Bathymetry DTM (depth_sample API),
//   0.025° × 0.035° grid, contoured 2026-09-29.
export const SITE_SOURCES = [
  "OpenStreetMap (Overpass)",
  "EMODnet Bathymetry DTM",
] as const;

// ── Offshore Substation (OSS) ───────────────────────────────────
// East edge of the array, 1.6 km from the nearest string end (WTG-32),
// on the side facing the export route. Water depth ≈ 33 m (EMODnet).
// The ±120 MVAr STATCOM is modelled on its 220 kV busbar (backend P2).
export const OSS_GEO = { lat: 54.8, lon: 16.495 };

// Floating LIDAR: 3 km SW (bearing 225°) of the SW corner turbine WTG-06,
// i.e. UPWIND of the prevailing SW wind, so it measures undisturbed
// freestream rather than turbine wakes. EEZ, ≈ 40 m depth (EMODnet).
export const LIDAR_GEO = { lat: 54.749, lon: 16.29 };

// ── Grid connection (onshore) ───────────────────────────────────

/** PSE 400/110 kV substation "Słupsk Wierzbięcino" (OSM, operator PSE). */
export const PSE_SUBSTATION_GEO = { lat: 54.5015, lon: 16.8919 };

/**
 * Farm's own 220/400 kV onshore substation, 1.4 km from PSE Słupsk
 * Wierzbięcino (land, gmina Redzikowo). Same pattern as the real MFW Baltic
 * Power 220/400 kV station beside PSE Choczewo.
 */
export const ONSHORE_GEO = { lat: 54.506, lon: 16.872 };

/** Beach landfall at Zaleskie (gmina Ustka), on the OSM coastline. */
export const LANDFALL_GEO = { lat: 54.5698, lon: 16.735 };

/**
 * 2 × 220 kV export route, 44.9 km ≈ the 45 km used by the electrical model:
 * 31.5 km subsea (OSS → landfall; crosses the coastal Natura 2000 bird area
 * "Przybrzeżne Wody Bałtyku", which spans the whole coast — HDD at landfall)
 * + 13.4 km land cable (landfall → onshore substation).
 */
export const EXPORT_CABLE_SUBSEA_GEO: { lat: number; lon: number }[] = [
  OSS_GEO,
  { lat: 54.792, lon: 16.55 },
  { lat: 54.76, lon: 16.608 },
  { lat: 54.708, lon: 16.645 },
  { lat: 54.655, lon: 16.674 },
  { lat: 54.605, lon: 16.7 },
  LANDFALL_GEO,
];
export const EXPORT_CABLE_LAND_GEO: { lat: number; lon: number }[] = [
  LANDFALL_GEO,
  { lat: 54.55, lon: 16.742 },
  { lat: 54.53, lon: 16.76 },
  { lat: 54.516, lon: 16.79 },
  { lat: 54.51, lon: 16.825 },
  { lat: 54.498, lon: 16.85 },
  ONSHORE_GEO,
];
export const EXPORT_CABLE_GEO = [
  ...EXPORT_CABLE_SUBSEA_GEO,
  ...EXPORT_CABLE_LAND_GEO.slice(1),
];

/** 400 kV tie from the farm's onshore substation to PSE Słupsk Wierzbięcino. */
export const PSE_GRID_LINE_GEO: [
  { lat: number; lon: number },
  { lat: number; lon: number },
] = [ONSHORE_GEO, PSE_SUBSTATION_GEO];

/** OWF site boundary (turbine envelope + ≈ 500 m safety zone). */
export const SITE_BOUNDARY_GEO: [number, number][] = [
  [54.845, 16.31],
  [54.845, 16.485],
  [54.755, 16.485],
  [54.755, 16.31],
];

/**
 * Initial map view: the offshore assets (array, OSS/STATCOM, LIDAR) so the
 * turbines are readable; zoom out once to see the export route to Słupsk.
 */
export const FARM_VIEW_BOUNDS: [[number, number], [number, number]] = [
  [54.735, 16.265],
  [54.85, 16.53],
];

/**
 * Turbine icon scale per map zoom (1 = the 40 × 56 px base icon).
 * At 54.8°N the 1,415 m along-string spacing is 32 px at z11 and doubles per
 * zoom step. The icon's vertical extent (heading arrow → ID label) is ≈ 50
 * units, ≈ 62 once the live-MW badge appears (z ≥ 13); the scale keeps that
 * stack within 90 % of the spacing so neighbours never touch, capped at 3.2×.
 */
export function turbineIconScale(zoom: number): number {
  const spacingPx = 32 * 2 ** (zoom - 11);
  const extentUnits = zoom >= 13 ? 62 : 50;
  return Math.min(3.2, Math.max(0.45, (0.9 * spacingPx) / extentUnits));
}

// ── Bathymetry isobaths (EMODnet Bathymetry DTM, real data) ─────
// Contoured from a 0.025° × 0.035° depth grid over 54.52–54.92°N,
// 16.12–16.96°E (sampled 2026-09-29). Longest segment per level.

export const BATHYMETRY_CONTOURS_GEO: {
  depth: number;
  points: [number, number][];
}[] = [
  {
    depth: 20,
    points: [
      [54.52, 16.3396],
      [54.5348, 16.365],
      [54.545, 16.3835],
      [54.5533, 16.4],
      [54.5631, 16.435],
      [54.5686, 16.47],
      [54.57, 16.4728],
      [54.5863, 16.47],
      [54.595, 16.4683],
      [54.5968, 16.47],
      [54.595, 16.4719],
      [54.5839, 16.505],
      [54.5928, 16.54],
      [54.595, 16.55],
      [54.6087, 16.575],
      [54.62, 16.5856],
      [54.6393, 16.61],
      [54.6419, 16.645],
      [54.6368, 16.68],
      [54.6336, 16.715],
      [54.62, 16.7309],
      [54.6099, 16.75],
      [54.6168, 16.785],
      [54.62, 16.79],
      [54.6435, 16.82],
      [54.6378, 16.855],
      [54.6423, 16.89],
      [54.645, 16.8945],
      [54.661, 16.925],
    ],
  },
  {
    depth: 30,
    points: [
      [54.52, 16.1805],
      [54.5272, 16.19],
      [54.5438, 16.225],
      [54.545, 16.2279],
      [54.5553, 16.26],
      [54.57, 16.2788],
      [54.5852, 16.295],
      [54.595, 16.308],
      [54.6075, 16.33],
      [54.62, 16.352],
      [54.6278, 16.365],
      [54.6447, 16.4],
      [54.645, 16.4003],
      [54.6603, 16.435],
      [54.67, 16.4633],
      [54.675, 16.47],
      [54.685, 16.505],
      [54.6904, 16.54],
      [54.6917, 16.575],
      [54.695, 16.6094],
      [54.6951, 16.61],
      [54.7066, 16.645],
      [54.7046, 16.68],
      [54.7104, 16.715],
      [54.72, 16.7403],
      [54.7264, 16.75],
      [54.7356, 16.785],
      [54.7316, 16.82],
      [54.745, 16.8439],
      [54.7601, 16.855],
      [54.7668, 16.89],
      [54.77, 16.8923],
      [54.7759, 16.89],
      [54.795, 16.8834],
      [54.8001, 16.89],
      [54.8094, 16.925],
    ],
  },
  {
    depth: 40,
    points: [
      [54.5587, 16.12],
      [54.57, 16.1363],
      [54.595, 16.1519],
      [54.6129, 16.155],
      [54.62, 16.1725],
      [54.6214, 16.19],
      [54.645, 16.2186],
      [54.6531, 16.225],
      [54.67, 16.2561],
      [54.695, 16.2303],
      [54.72, 16.2392],
      [54.7369, 16.26],
      [54.745, 16.2836],
      [54.7494, 16.26],
      [54.7557, 16.225],
      [54.77, 16.2008],
      [54.7823, 16.19],
      [54.77, 16.1636],
      [54.7679, 16.155],
      [54.77, 16.1499],
      [54.795, 16.122],
      [54.82, 16.1293],
      [54.845, 16.1543],
      [54.8454, 16.155],
      [54.87, 16.1807],
      [54.8787, 16.19],
      [54.895, 16.2098],
      [54.9057, 16.225],
      [54.92, 16.2457],
    ],
  },
  {
    depth: 50,
    points: [
      [54.8803, 16.12],
      [54.895, 16.1471],
      [54.8992, 16.155],
      [54.9191, 16.19],
      [54.92, 16.1913],
    ],
  },
];

// ── Maritime & grid context (all sourced; checked 2026-09-29) ──────────

/**
 * Coastline, Rowy → Jarosławiec → Ustka → Łeba, simplified (≈ 150 m
 * tolerance) from OSM natural=coastline, east → west (land on the left).
 * Used to keep the sea-surface effects off the land.
 */
export const COASTLINE_GEO: [number, number][] = [
  [54.8186, 17.8697],
  [54.81, 17.8248],
  [54.8004, 17.7495],
  [54.7833, 17.6699],
  [54.7691, 17.5716],
  [54.769, 17.5508],
  [54.7633, 17.5514],
  [54.7607, 17.5484],
  [54.7599, 17.5535],
  [54.7601, 17.548],
  [54.7579, 17.5478],
  [54.7701, 17.5508],
  [54.7671, 17.5428],
  [54.7568, 17.4749],
  [54.7502, 17.3567],
  [54.7423, 17.3231],
  [54.7328, 17.252],
  [54.7051, 17.1733],
  [54.6699, 17.0503],
  [54.6669, 17.0556],
  [54.6667, 17.051],
  [54.6671, 17.0527],
  [54.6699, 17.0497],
  [54.6375, 17.0001],
  [54.6154, 16.9593],
  [54.5974, 16.9126],
  [54.5912, 16.8875],
  [54.589, 16.8534],
  [54.5921, 16.8509],
  [54.5801, 16.8571],
  [54.5837, 16.8527],
  [54.5873, 16.8528],
  [54.5861, 16.8513],
  [54.588, 16.8531],
  [54.5919, 16.8502],
  [54.5876, 16.8436],
  [54.5786, 16.7989],
  [54.5705, 16.7723],
  [54.5697, 16.6956],
  [54.5575, 16.5989],
  [54.5451, 16.5533],
  [54.5421, 16.5356],
  [54.5432, 16.5305],
  [54.5262, 16.5036],
  [54.5085, 16.4654],
  [54.489, 16.4344],
  [54.4455, 16.392],
  [54.4411, 16.3833],
  [54.442, 16.3721],
  [54.437, 16.3885],
  [54.4367, 16.3865],
  [54.422, 16.4018],
  [54.4196, 16.4092],
  [54.4218, 16.4017],
  [54.426, 16.3971],
  [54.4234, 16.397],
  [54.4339, 16.3887],
  [54.4338, 16.3856],
  [54.4344, 16.3881],
  [54.4361, 16.386],
  [54.4403, 16.3771],
  [54.4386, 16.3736],
  [54.4416, 16.3717],
  [54.4373, 16.3726],
  [54.4271, 16.3635],
  [54.388, 16.3198],
  [54.352, 16.2666],
  [54.3171, 16.2077],
];

/** Sea polygon for clipping: coastline closed around the north. */
export const SEA_POLYGON_GEO: [number, number][] = [
  [COASTLINE_GEO[0][0], 19.5],
  ...COASTLINE_GEO,
  [COASTLINE_GEO[COASTLINE_GEO.length - 1][0], 14.5],
  [57, 14.5],
  [57, 19.5],
];

/**
 * SwePol HVDC link (450 kV DC, 600 MW, Stärnö SE ↔ Słupsk-Wierzbięcino PL),
 * OSM ways 1025227913 (subsea) + 251849081 (land). Its landfall is 3 km east
 * of ours and both routes stay apart — no cable crossing needed.
 */
export const SWEPOL_GEO: [number, number][] = [
  [55.3525, 16.2825],
  [55.1025, 16.7652],
  [54.9695, 16.9151],
  [54.898, 16.9263],
  [54.6211, 16.8451],
  [54.5776, 16.7811],
  [54.5739, 16.7841],
  [54.5544, 16.7985],
  [54.5316, 16.8905],
  [PSE_SUBSTATION_GEO.lat, PSE_SUBSTATION_GEO.lon],
];

/**
 * Planned offshore wind areas from the Polish maritime spatial plan
 * ("PZP_nn" basins), EMODnet Human Activities `windfarmspoly`, simplified.
 * None overlaps this site (nearest: PZP_43 "Baltex 2", ≈ 9 km NW of the
 * nearest turbine).
 */
export const NEIGHBOUR_OWF_AREAS: {
  name: string;
  mw: number | null;
  ring: [number, number][];
}[] = [
  {
    name: "PZP_43 (Baltex 2)",
    mw: 560,
    ring: [
      [54.9079, 16.2688],
      [54.8732, 16.1061],
      [54.9319, 16.1063],
      [54.9951, 16.2309],
      [55.0258, 16.3095],
      [54.9565, 16.3052],
    ],
  },
  {
    name: "PZP_44",
    mw: null,
    ring: [
      [55.099, 16.4978],
      [55.1059, 16.5452],
      [55.1083, 16.6056],
      [55.1311, 16.7047],
      [55.114, 16.7289],
      [55.0926, 16.6787],
      [55.0755, 16.6671],
      [55.0478, 16.6319],
      [55.0054, 16.4496],
      [54.971, 16.3929],
      [55.0485, 16.3678],
    ],
  },
  {
    name: "PZP_45",
    mw: null,
    ring: [
      [55.004, 17.0877],
      [54.9898, 17.0819],
      [55.0091, 16.9763],
      [55.014, 16.9753],
      [55.0353, 16.848],
      [55.1024, 16.7733],
      [55.1184, 16.7436],
      [55.1318, 16.8419],
      [55.1382, 16.9221],
      [55.1367, 16.95],
      [55.1187, 16.9537],
      [55.1187, 17.0311],
      [55.1048, 17.2287],
      [55.1136, 17.2771],
      [55.0582, 17.2824],
      [55.0576, 17.3206],
      [55.0595, 17.3841],
      [55.1018, 17.3802],
      [55.1109, 17.675],
      [54.9988, 17.675],
      [54.9822, 17.59],
      [54.9665, 17.4393],
      [54.9568, 17.4132],
      [54.9526, 17.3785],
      [54.9451, 17.2826],
      [55.0434, 17.2335],
      [55.0374, 17.2091],
      [55.0387, 17.1841],
    ],
  },
];

/** Port Ustka (OSM "Port Morski Ustka") — nearest port, O&M base for the CTV. */
export const USTKA_PORT_GEO = { lat: 54.5859, lon: 16.8526 };
/** CTV track: harbour → breakwater entrance → open sea → site (SE corner). */
export const CTV_ROUTE_GEO: [number, number][] = [
  [54.5859, 16.8526],
  [54.5935, 16.852],
  [54.62, 16.8],
  [54.72, 16.56],
  [54.765, 16.49],
];

/** Safety zone radius around each structure [m] — UNCLOS Art. 60(5) maximum. */
export const SAFETY_ZONE_M = 500;

/**
 * IALA G1162 marking: Significant Peripheral Structures (yellow Fl, ≥ 5 NM,
 * synchronised) at the corners and so that no two are > 3 NM apart along the
 * periphery; the other peripheral turbines are IPS (yellow, ≥ 2 NM).
 */
export const PERIPHERY_RING = [
  "WTG-01",
  "WTG-02",
  "WTG-03",
  "WTG-04",
  "WTG-05",
  "WTG-06",
  "WTG-12",
  "WTG-18",
  "WTG-24",
  "WTG-29",
  "WTG-34",
  "WTG-33",
  "WTG-32",
  "WTG-31",
  "WTG-30",
  "WTG-25",
  "WTG-19",
  "WTG-13",
  "WTG-07",
];
export const SPS_TURBINES = [
  "WTG-01",
  "WTG-04",
  "WTG-06",
  "WTG-18",
  "WTG-29",
  "WTG-34",
  "WTG-31",
  "WTG-30",
  "WTG-19",
  "WTG-07",
];

/**
 * IALA Region A cardinal marks around the site (outside the 500 m zones).
 * Light characters per IALA: N VQ, E VQ(3) 5s, S VQ(6)+LFl 10s, W VQ(9) 10s.
 */
export const CARDINAL_MARKS: {
  id: string;
  kind: "N" | "E" | "S" | "W";
  lat: number;
  lon: number;
  light: string;
}[] = [
  { id: "N", kind: "N", lat: 54.8485, lon: 16.397, light: "VQ" },
  { id: "E", kind: "E", lat: 54.772, lon: 16.4885, light: "VQ(3) 5s" },
  { id: "S", kind: "S", lat: 54.7515, lon: 16.397, light: "VQ(6)+LFl 10s" },
  { id: "W", kind: "W", lat: 54.8, lon: 16.3065, light: "VQ(9) 10s" },
];

/**
 * OSS 66 kV switchboard: strings 1–3 on section A (TX-OSS-01), 4–6 on
 * section B (TX-OSS-02), bus coupler BAY-OSS-66-08 normally open. Design
 * choice: 270 / 240 MW per section, both inside a 300 MVA unit.
 */
export const OSS_BUSBAR_SECTION: Record<number, "A" | "B"> = {
  1: "A",
  2: "A",
  3: "A",
  4: "B",
  5: "B",
  6: "B",
};
