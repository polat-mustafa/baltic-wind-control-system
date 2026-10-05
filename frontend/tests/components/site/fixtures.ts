import type { AssessResponse, CheckStatus } from "../../../src/services/siteApi";

const IDS = ["sea", "territorial_sea", "eez", "owf", "cables", "natura2000", "shipping", "restricted", "depth"] as const;

/** A site report with every blocking check passing, then the given overrides. */
export function report(overrides: Partial<Record<(typeof IDS)[number], CheckStatus>> = {}): AssessResponse {
  return {
    region: "southern-baltic",
    area_km2: 112.2,
    centroid: [16.4, 54.8],
    capacity_mw: 505,
    samples: 900,
    excluded_fraction: 0,
    exclusion_shares: {},
    class_shares: { suitable: 1, marginal: 0, poor: 0 },
    mean_score: 0.9,
    shore_km: [23.2, 36.2],
    grid_km: 45.9,
    grid_node: "Słupsk-Wierzbięcino 400 kV (PSE)",
    cable_km: 25,
    owf_km: 7.5,
    protected_km: 20,
    depth_m: [23, 40],
    foundation: "monopile / jacket",
    checks: [
      ...IDS.map((id) => ({
        id,
        title: `Check ${id}`,
        status: overrides[id] ?? ("pass" as CheckStatus),
        detail: `detail ${id}`,
        reference: "",
      })),
      { id: "eia", title: "Environmental impact assessment", status: "info", detail: "Annex II", reference: "" },
    ],
    complete: true,
  };
}
