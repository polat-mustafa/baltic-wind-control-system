/**
 * Wind farm geography — 34 × 15 MW "V236 class" turbines (IEA 15 MW) in 6 strings (6-6-6-6-5-5),
 * offshore substation, LIDAR, 76.5 km export route and grid connection.
 *
 * Site: energy basin PZP_44 of the Polish maritime spatial plan (Dz.U. 2021
 * poz. 935) — the real site 44.E.1, whose location permit (9 August 2023) is
 * held by Elektrownia Wiatrowa Baltica 9 (PGE). SB-510 is fictional and uses
 * the area for teaching. Until 2026-10 it sat 35–40 km off Ustka, mostly in
 * shipping basin PZP_15, where a real farm could not be permitted.
 *
 * Strings run N–S, 8D (≈ 1.93 km, D = 241.35 m) apart east–west: the long
 * spacing lies along the prevailing wind (site rose: 270° 19 %, 240° 14 %).
 * Turbines are 6D (≈ 1.45 km) apart along a string; each string sits a little
 * further north than its western neighbour, following the basin's slanted
 * southern edge, which also staggers the rows against the westerly wind.
 * Positions are WGS84; `x`/`y` are legacy schematic units used only for the
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
 * 34 turbine positions arranged in 6 strings, numbered north → south.
 *
 * Site checks (2026-10-08, backend/app/services/site_assessment, region pack
 * southern-baltic): every turbine lies ≥ 0.57 km inside energy basin PZP_44,
 * ≥ 49 km from shore (EEZ, beyond 12 nm), ≥ 2.5 km north of the Ławica Słupska
 * Natura 2000 site (PLC990001), outside every shipping basin, military area and
 * recorded munition dump, in 37–51 m of water (EMODnet DTM) → jacket
 * foundations. Turbines are ≥ 1,446 m apart.
 */
export const TURBINE_POSITIONS: TurbinePosition[] = [
  // String 1 (6 turbines) — westernmost, nearest the OSS
  { id: "WTG-01", stringNumber: 1, x: 80, y: 120, lat: 55.0796, lon: 16.464 },
  { id: "WTG-02", stringNumber: 1, x: 90, y: 200, lat: 55.0665, lon: 16.464 },
  { id: "WTG-03", stringNumber: 1, x: 100, y: 280, lat: 55.0535, lon: 16.464 },
  { id: "WTG-04", stringNumber: 1, x: 95, y: 360, lat: 55.0405, lon: 16.464 },
  { id: "WTG-05", stringNumber: 1, x: 85, y: 440, lat: 55.0275, lon: 16.464 },
  { id: "WTG-06", stringNumber: 1, x: 90, y: 520, lat: 55.0144, lon: 16.464 },

  // String 2 (6 turbines)
  { id: "WTG-07", stringNumber: 2, x: 180, y: 100, lat: 55.0886, lon: 16.4943 },
  { id: "WTG-08", stringNumber: 2, x: 190, y: 180, lat: 55.0755, lon: 16.4943 },
  { id: "WTG-09", stringNumber: 2, x: 195, y: 260, lat: 55.0625, lon: 16.4943 },
  { id: "WTG-10", stringNumber: 2, x: 185, y: 340, lat: 55.0495, lon: 16.4943 },
  { id: "WTG-11", stringNumber: 2, x: 180, y: 420, lat: 55.0365, lon: 16.4943 },
  { id: "WTG-12", stringNumber: 2, x: 185, y: 500, lat: 55.0234, lon: 16.4943 },

  // String 3 (6 turbines)
  { id: "WTG-13", stringNumber: 3, x: 280, y: 110, lat: 55.0956, lon: 16.5246 },
  { id: "WTG-14", stringNumber: 3, x: 290, y: 190, lat: 55.0825, lon: 16.5246 },
  { id: "WTG-15", stringNumber: 3, x: 285, y: 270, lat: 55.0695, lon: 16.5246 },
  { id: "WTG-16", stringNumber: 3, x: 280, y: 350, lat: 55.0565, lon: 16.5246 },
  { id: "WTG-17", stringNumber: 3, x: 275, y: 430, lat: 55.0435, lon: 16.5246 },
  { id: "WTG-18", stringNumber: 3, x: 285, y: 510, lat: 55.0304, lon: 16.5246 },

  // String 4 (6 turbines)
  { id: "WTG-19", stringNumber: 4, x: 380, y: 130, lat: 55.1006, lon: 16.5549 },
  { id: "WTG-20", stringNumber: 4, x: 390, y: 210, lat: 55.0875, lon: 16.5549 },
  { id: "WTG-21", stringNumber: 4, x: 385, y: 290, lat: 55.0745, lon: 16.5549 },
  { id: "WTG-22", stringNumber: 4, x: 380, y: 370, lat: 55.0615, lon: 16.5549 },
  { id: "WTG-23", stringNumber: 4, x: 375, y: 450, lat: 55.0485, lon: 16.5549 },
  { id: "WTG-24", stringNumber: 4, x: 380, y: 530, lat: 55.0354, lon: 16.5549 },

  // String 5 (5 turbines)
  { id: "WTG-25", stringNumber: 5, x: 480, y: 140, lat: 55.099, lon: 16.5852 },
  { id: "WTG-26", stringNumber: 5, x: 490, y: 220, lat: 55.086, lon: 16.5852 },
  { id: "WTG-27", stringNumber: 5, x: 485, y: 300, lat: 55.073, lon: 16.5852 },
  { id: "WTG-28", stringNumber: 5, x: 480, y: 380, lat: 55.06, lon: 16.5852 },
  { id: "WTG-29", stringNumber: 5, x: 475, y: 460, lat: 55.047, lon: 16.5852 },

  // String 6 (5 turbines) — easternmost
  { id: "WTG-30", stringNumber: 6, x: 570, y: 150, lat: 55.103, lon: 16.6156 },
  { id: "WTG-31", stringNumber: 6, x: 580, y: 230, lat: 55.09, lon: 16.6156 },
  { id: "WTG-32", stringNumber: 6, x: 575, y: 310, lat: 55.077, lon: 16.6156 },
  { id: "WTG-33", stringNumber: 6, x: 570, y: 390, lat: 55.064, lon: 16.6156 },
  { id: "WTG-34", stringNumber: 6, x: 565, y: 470, lat: 55.051, lon: 16.6156 },
];

// ── Sources for all geographic values in this file ──────────────
// - Maritime spatial plan basins, Natura 2000, cables, shipping, military
//   areas: the Site & Permits region pack (EMODnet, EEA, OSM; see
//   backend/app/services/site_assessment/data/SOURCES.md).
// - Coastline, PSE substations, landfall: OpenStreetMap via Overpass API.
// - Water depth / isobaths: EMODnet Bathymetry DTM (region pack, 0.01° grid).
export const SITE_SOURCES = [
  "OpenStreetMap (Overpass)",
  "EMODnet Bathymetry DTM",
  "Polish maritime spatial plan (Dz.U. 2021 poz. 935, via EMODnet)",
] as const;

// ── Offshore Substation (OSS) ───────────────────────────────────
// South-west corner of the array, 1.9 km from the nearest string end
// (WTG-06), on the side the export route leaves from; 2.3 km inside PZP_44,
// ≈ 44 m of water (EMODnet). The ±120 MVAr STATCOM is modelled on its 220 kV
// busbar (backend P2).
export const OSS_GEO = { lat: 55.026, lon: 16.442 };

// Floating LIDAR: 3 km west (270°) of WTG-04, the middle of string 1, i.e.
// UPWIND of the prevailing westerly wind, so it measures undisturbed
// freestream rather than turbine wakes. Inside PZP_44, ≈ 48 m depth (EMODnet).
export const LIDAR_GEO = { lat: 55.0405, lon: 16.4169 };

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

/** Export length of the electrical model [km] (backend network_model.EXPORT_CABLE_LENGTH_KM). */
export const SB510_EXPORT_KM = 76.5;
/** Water depth across the turbine positions [m] (EMODnet DTM) — jackets. */
export const SB510_DEPTH_M: [number, number] = [37, 51];

/**
 * 2 × 220 kV export route, 76.7 km drawn ≈ the 76.5 km of the electrical model:
 * 63.3 km subsea + 13.4 km land cable (cable DTS zones: 63.5 + 13). From the OSS
 * it runs south-west round the west end of the Ławica Słupska Natura 2000 site (≥ 1.2 km clear),
 * crosses shipping basin PZP_15 at right angles (≈ 172° across its 81° axis),
 * then heads for the landfall at Zaleskie (gmina Ustka); the coastal Natura 2000
 * bird area "Przybrzeżne Wody Bałtyku" spans the whole coast — HDD at landfall.
 * Checked against the region pack layers (2026-10-08).
 */
export const EXPORT_CABLE_SUBSEA_GEO: { lat: number; lon: number }[] = [
  OSS_GEO,
  { lat: 54.93, lon: 16.335 },
  { lat: 54.855, lon: 16.37 },
  { lat: 54.745, lon: 16.395 },
  { lat: 54.615, lon: 16.69 },
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

/**
 * OWF site boundary: energy basin PZP_44 between 16.42 and 16.63 °E, 112.9 km²
 * (≈ 510 MW at the 4.5 MW/km² screening density); the basin's narrow east end
 * towards the SwePol cable stays outside.
 */
export const SITE_BOUNDARY_GEO: [number, number][] = [
  [55.099, 16.4978],
  [55.1059, 16.5452],
  [55.1083, 16.6056],
  [55.1139, 16.63],
  [55.0474, 16.63],
  [55.0054, 16.4496],
  [55.0018, 16.4417],
  [54.9881, 16.42],
  [55.0688, 16.42],
];

/**
 * Initial map view: the offshore assets (array, OSS/STATCOM, LIDAR) so the
 * turbines are readable; zoom out to see the export route to Słupsk.
 */
export const FARM_VIEW_BOUNDS: [[number, number], [number, number]] = [
  [54.995, 16.4],
  [55.12, 16.645],
];

/**
 * Turbine icon scale per map zoom (1 = the 40 × 56 px base icon).
 * At 55.06°N the 1,448 m along-string spacing is 33 px at z11 and doubles per
 * zoom step. The icon's vertical extent (heading arrow → ID label) is ≈ 50
 * units, ≈ 62 once the live-MW badge appears (z ≥ 13); the scale keeps that
 * stack within 90 % of the spacing so neighbours never touch, capped at 3.2×.
 */
export function turbineIconScale(zoom: number): number {
  const spacingPx = 33 * 2 ** (zoom - 11);
  const extentUnits = zoom >= 13 ? 62 : 50;
  return Math.min(3.2, Math.max(0.45, (0.9 * spacingPx) / extentUnits));
}

// ── Bathymetry isobaths (EMODnet Bathymetry DTM, real data) ─────
// Contoured from the region pack's 0.01° EMODnet DTM grid over 54.52–55.17°N,
// 16.12–16.97°E (2026-10-08): the longest line per level, simplified (0.004°).

export const BATHYMETRY_CONTOURS_GEO: {
  depth: number;
  points: [number, number][];
}[] = [
  {
    depth: 20,
    points: [
      [54.946, 16.965],
      [54.9473, 16.945],
      [54.9403, 16.925],
      [54.9043, 16.895],
      [54.865, 16.8311],
      [54.855, 16.825],
      [54.8547, 16.815],
      [54.878, 16.755],
      [54.8811, 16.715],
      [54.8767, 16.655],
      [54.864, 16.625],
      [54.8605, 16.565],
      [54.8625, 16.545],
      [54.8821, 16.535],
      [54.8725, 16.515],
      [54.8758, 16.455],
      [54.905, 16.4072],
      [54.935, 16.3987],
      [54.9408, 16.425],
      [54.9607, 16.445],
      [54.9691, 16.465],
      [54.9595, 16.475],
      [54.9669, 16.515],
      [55.0177, 16.625],
      [55.0102, 16.645],
      [55.0186, 16.675],
      [55.005, 16.705],
      [54.985, 16.6944],
      [54.979, 16.705],
      [54.9807, 16.725],
      [54.9976, 16.765],
      [54.995, 16.7733],
      [54.975, 16.775],
      [54.972, 16.795],
      [54.9818, 16.835],
      [54.9769, 16.965],
    ],
  },
  {
    depth: 30,
    points: [
      [54.9125, 16.965],
      [54.885, 16.8863],
      [54.8454, 16.825],
      [54.8471, 16.755],
      [54.8383, 16.715],
      [54.805, 16.6725],
      [54.795, 16.6679],
      [54.7871, 16.645],
      [54.7889, 16.605],
      [54.805, 16.5864],
      [54.815, 16.5921],
      [54.8171, 16.585],
      [54.8258, 16.495],
      [54.825, 16.4675],
      [54.815, 16.4759],
      [54.8003, 16.465],
      [54.803, 16.365],
      [54.81, 16.345],
      [54.835, 16.315],
      [54.855, 16.3017],
      [54.885, 16.2974],
      [54.935, 16.3167],
      [54.9513, 16.355],
      [54.9628, 16.365],
      [55.0728, 16.735],
      [55.0915, 16.845],
      [55.0747, 16.945],
      [55.065, 16.965],
    ],
  },
  {
    depth: 40,
    points: [
      [54.8273, 16.125],
      [54.837, 16.145],
      [54.8617, 16.165],
      [54.905, 16.22],
      [54.941, 16.275],
      [54.9548, 16.315],
      [54.9845, 16.365],
      [55.026, 16.475],
      [55.0495, 16.595],
      [55.1231, 16.765],
      [55.155, 16.9132],
      [55.148, 16.945],
      [55.118, 16.955],
      [55.1172, 16.965],
    ],
  },
  {
    depth: 50,
    points: [
      [54.8819, 16.125],
      [54.8842, 16.155],
      [54.895, 16.1502],
      [54.8996, 16.155],
      [54.9954, 16.325],
      [55.0254, 16.365],
      [55.0586, 16.455],
      [55.111, 16.505],
      [55.1127, 16.585],
      [55.1422, 16.725],
      [55.1521, 16.845],
      [55.165, 16.8988],
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
 * The neighbouring energy basins of the Polish maritime spatial plan
 * ("PZP_nn", EMODnet MSP zoning, simplified). SB-510 itself lies in PZP_44
 * (drawn by the site boundary); PZP_43 is ≈ 10 km west of string 1, PZP_45
 * ≈ 8 km east of string 6.
 */
export const NEIGHBOUR_OWF_AREAS: {
  name: string;
  mw: number | null;
  ring: [number, number][];
}[] = [
  {
    name: "PZP_43",
    mw: null,
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
/** CTV track: harbour → breakwater entrance → open sea (over Ławica Słupska) → site (SE corner). */
export const CTV_ROUTE_GEO: [number, number][] = [
  [54.5859, 16.8526],
  [54.5935, 16.852],
  [54.68, 16.78],
  [54.9, 16.68],
  [55.04, 16.628],
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
  { id: "N", kind: "N", lat: 55.1115, lon: 16.5398, light: "VQ" },
  { id: "E", kind: "E", lat: 55.077, lon: 16.6276, light: "VQ(3) 5s" },
  { id: "S", kind: "S", lat: 55.023, lon: 16.5398, light: "VQ(6)+LFl 10s" },
  { id: "W", kind: "W", lat: 55.047, lon: 16.452, light: "VQ(9) 10s" },
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
