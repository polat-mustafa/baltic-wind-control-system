/**
 * Wind farm geography — 34 × 15 MW "V236 class" turbines (IEA 15 MW) in 6 strings (6-6-6-6-5-5),
 * offshore substation, LIDAR, 108 km export route and grid connection.
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

// Collector (feeder) routing. The OSS sits west of string 1, so straight
// feeders from strings 2–6 would cut through string 1 (string 3's passed 36 m
// from WTG-05) and string 6's lay on top of string 5's for 9.5 km. Each
// feeder instead runs below the southern turbine row: it passes every string
// to its west 330 m south of that string's gateway turbine, parallel feeders
// stacked 200 m apart, clears string 1 by 500 m to the west, then turns up
// to the OSS. Map/3D only — the P2 load
// flow uses STRING_LAYOUT and fixed section lengths.
const FEEDER_CLEARANCE_DEG = 0.003; // ≈ 330 m
const FEEDER_PITCH_DEG = 0.0018; // ≈ 200 m
const FEEDER_WEST_CLEAR_DEG = 0.008; // ≈ 510 m
const GATEWAYS = [1, 2, 3, 4, 5, 6].map((n) =>
  TURBINE_POSITIONS.filter((t) => t.stringNumber === n).reduce((a, b) => (b.lat < a.lat ? b : a)),
);
export const FEEDER_WAYPOINTS: Record<number, { lat: number; lon: number }[]> = Object.fromEntries(
  GATEWAYS.map((_, i) => {
    const under = GATEWAYS.slice(0, i)
      .reverse()
      .map((g, j) => ({ lat: g.lat - FEEDER_CLEARANCE_DEG - FEEDER_PITCH_DEG * j, lon: g.lon }));
    const last = under[under.length - 1];
    return [i + 1, last ? [...under, { lat: last.lat, lon: last.lon - FEEDER_WEST_CLEAR_DEG }] : []];
  }),
);

// Floating LIDAR: 3 km west (270°) of WTG-04, the middle of string 1, i.e.
// UPWIND of the prevailing westerly wind, so it measures undisturbed
// freestream rather than turbine wakes. Inside PZP_44, ≈ 48 m depth (EMODnet).
export const LIDAR_GEO = { lat: 55.0405, lon: 16.4169 };

// ── Grid connection (onshore) ───────────────────────────────────

/** PSE 400/110 kV substation "Słupsk Wierzbięcino" (OSM, operator PSE) — SwePol's end. */
export const SLUPSK_SUBSTATION_GEO = { lat: 54.5015, lon: 16.8919 };

/**
 * PSE 400 kV substation Krzemienica (planned, PSE investment programme; region pack
 * grid node) — the connection point PGE announced for Baltica 9+ (site 44.E.1), so
 * SB-510's (backend network_model.SB510_GRID_NODE).
 */
export const PSE_SUBSTATION_GEO = { lat: 54.4393, lon: 16.8537 };
export const PSE_SUBSTATION_NAME = "PSE Krzemienica";

/**
 * Farm's own 220/400 kV onshore substation, 1.25 km west of PSE Krzemienica (land).
 * Same pattern as the real MFW Baltic Power 220/400 kV station beside PSE Choczewo.
 */
export const ONSHORE_GEO = { lat: 54.442, lon: 16.835 };

/** Beach landfall at Darłówko-Wschodnie (gmina Darłowo), on the OSM coastline. */
export const LANDFALL_GEO = { lat: 54.4589, lon: 16.4073 };

/** Export length of the electrical model [km] (backend network_model.EXPORT_CABLE_LENGTH_KM). */
export const SB510_EXPORT_KM = 108;
/** Water depth across the turbine positions [m] (EMODnet DTM) — jackets. */
export const SB510_DEPTH_M: [number, number] = [37, 51];

/**
 * 2 × 220 kV export route, 108.0 km drawn = the electrical model: 79.3 km subsea +
 * 28.7 km land cable (cable DTS: HDD 78.7–79.5 km). From the OSS it runs south-west
 * round the west end of the Ławica Słupska Natura 2000 site (≥ 1.7 km clear), crosses
 * shipping basins PZP_15 and PZP_10 at 62–67° (≥ 45°, ICPC Rec. 2), runs south between
 * Darłowo's approach channel PZP_23 and the military National Defence Area off Ustka
 * (≥ 0.7 km from each), lands at Darłówko-Wschodnie and runs east on land north of the
 * Natura 2000 site Dolina Wieprzy i Studnicy to PSE Krzemienica. The coastal bird area
 * "Przybrzeżne Wody Bałtyku" spans the whole coast (8.5 km at sea) — HDD at landfall.
 * Checked with the route check against the region pack (2026-10-08). Until then the
 * route ran 76.5 km to Słupsk-Wierzbięcino, 24.5 km of it through the military area.
 */
export const EXPORT_CABLE_SUBSEA_GEO: { lat: number; lon: number }[] = [
  OSS_GEO,
  { lat: 54.93, lon: 16.335 },
  { lat: 54.845, lon: 16.165 },
  { lat: 54.7, lon: 16.1 },
  { lat: 54.605, lon: 16.11 },
  { lat: 54.581, lon: 16.146 },
  { lat: 54.534, lon: 16.25 },
  { lat: 54.491, lon: 16.345 },
  LANDFALL_GEO,
];
export const EXPORT_CABLE_LAND_GEO: { lat: number; lon: number }[] = [
  LANDFALL_GEO,
  { lat: 54.455, lon: 16.47 },
  { lat: 54.468, lon: 16.6 },
  { lat: 54.478, lon: 16.7 },
  { lat: 54.468, lon: 16.77 },
  ONSHORE_GEO,
];
export const EXPORT_CABLE_GEO = [
  ...EXPORT_CABLE_SUBSEA_GEO,
  ...EXPORT_CABLE_LAND_GEO.slice(1),
];

/** 400 kV tie from the farm's onshore substation to PSE Krzemienica. */
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
 * turbines are readable; zoom out to see the export route to Krzemienica.
 */
export const FARM_VIEW_BOUNDS: [[number, number], [number, number]] = [
  [54.995, 16.4],
  [55.12, 16.645],
];

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
 * SwePol HVDC link (450 kV DC, 600 MW, Stärnö SE ↔ Słupsk-Wierzbięcino PL):
 * the whole OSM subsea way 1025227913 from the Stärnö converter (Karlshamn)
 * to the Ustka landfall, then land way 251849081 to the Słupsk converter.
 * It lands 27 km east of the SB-510 export route — no cable crossing.
 */
export const SWEPOL_GEO: [number, number][] = [
  [56.1368, 14.8373],
  [56.1331, 14.8404],
  [56.1305, 14.8453],
  [56.1271, 14.8577],
  [56.1252, 14.8695],
  [56.1259, 14.8828],
  [56.1035, 14.9181],
  [56.0765, 14.9787],
  [56.0496, 14.9860],
  [56.0416, 14.9847],
  [55.9986, 14.9935],
  [55.9242, 15.0112],
  [55.8352, 15.0323],
  [55.7930, 15.1428],
  [55.7510, 15.2529],
  [55.6697, 15.4650],
  [55.6060, 15.6311],
  [55.5426, 15.7962],
  [55.4839, 15.9487],
  [55.4355, 16.0704],
  [55.3718, 16.2303],
  [55.3525, 16.2825],
  [55.3369, 16.3139],
  [55.2784, 16.4253],
  [55.2070, 16.5611],
  [55.1047, 16.7553],
  [55.1025, 16.7652],
  [55.0283, 16.8461],
  [54.9695, 16.9151],
  [54.8980, 16.9263],
  [54.8335, 16.9062],
  [54.7681, 16.8858],
  [54.6955, 16.8646],
  [54.6597, 16.8542],
  [54.6426, 16.8502],
  [54.6211, 16.8451],
  [54.6097, 16.8284],
  [54.5913, 16.8012],
  [54.5776, 16.7811],
  [54.5739, 16.7841],
  [54.5544, 16.7985],
  [54.5316, 16.8905],
  [SLUPSK_SUBSTATION_GEO.lat, SLUPSK_SUBSTATION_GEO.lon],
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
