/** Shared constants and formatting for the lifecycle pages. */

import type { VesselId } from "../../types/lifecycle";

/** Categorical slots in fixed order (validated for CVD on the dark surfaces; labels always shown). */
export const VESSEL_COLOR: Record<VesselId, string> = {
  HLV: "#3987e5",
  WTIV: "#d95926",
  CLV: "#199e70",
  CTV: "#c98500",
  SURVEY: "#d55181",
};

/** Operational limits of the campaign model — mirror of backend services/lifecycle/campaign.py (illustrative). */
export const VESSEL_DEFAULTS: Record<VesselId, { name: string; hs_m: number; wind_ms: number; windRef: string }> = {
  HLV: { name: "Heavy-lift vessel", hs_m: 1.5, wind_ms: 13, windRef: "10 m" },
  WTIV: { name: "Jack-up installation vessel", hs_m: 2.0, wind_ms: 14, windRef: "hub height" },
  CLV: { name: "Cable-lay vessel", hs_m: 2.0, wind_ms: 15, windRef: "10 m" },
  CTV: { name: "Crew transfer vessel", hs_m: 1.5, wind_ms: 10, windRef: "10 m" },
  SURVEY: { name: "Survey vessel", hs_m: 2.5, wind_ms: 15, windRef: "10 m" },
};

export const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Math.floor(days));
  return d.toISOString().slice(0, 10);
};

export const meur = (v: number) => `${v.toFixed(v < 10 ? 1 : 0)} M€`;
