/** Map styling per open-data layer role (screening map and layout canvas). */

export interface RoleStyle {
  label: string;
  /** One line for the legend: what the layer is and what it means for a wind farm. */
  note: string;
  color: string;
  fill: number;
  dash?: string;
  on: boolean;
}

/** Map styling per layer role. Suitability owns green and yellow; nothing else uses them. */
export const ROLE_STYLE: Record<string, RoleStyle> = {
  protected: {
    label: "Natura 2000",
    note: "EU nature sites: a project here needs an appropriate assessment",
    color: "#a855f7",
    fill: 0.18,
    on: true,
  },
  shipping: {
    label: "Shipping priority (MSP)",
    note: "Plan basins where shipping comes first: no wind farms",
    color: "#45c8d9",
    fill: 0.14,
    dash: "6 4",
    on: true,
  },
  msp_energy: {
    label: "Energy basins (MSP) — wind allowed",
    note: "The only plan basins where Polish law allows offshore wind",
    color: "#0e7490",
    fill: 0.06,
    dash: "10 4",
    on: true,
  },
  owf: {
    label: "Wind farms (real projects)",
    note: "Outlines and locations of real projects: no overlap",
    color: "#f97316",
    fill: 0.18,
    on: true,
  },
  restricted: {
    label: "Military / munitions",
    note: "Military areas and munition dumpsites",
    color: "#f25c54",
    fill: 0.12,
    dash: "3 3",
    on: true,
  },
  territorial: {
    label: "12 nm territorial sea",
    note: "Offshore wind is banned here in Poland",
    color: "#64748b",
    fill: 0.1,
    dash: "8 6",
    on: true,
  },
  eez: { label: "EEZ boundary", note: "Polish exclusive economic zone", color: "#334155", fill: 0, dash: "2 6", on: false },
  cable: { label: "Subsea cables", note: "Existing cables and pipelines, with a safety buffer", color: "#e11d48", fill: 0, on: true },
  grid: { label: "Grid connection", note: "Onshore substations for the export cable", color: "#0f766e", fill: 1, on: true },
  port: {
    label: "Offshore wind ports",
    note: "O&M bases and installation terminals, as announced by their operators",
    color: "#b45309",
    fill: 1,
    on: true,
  },
};

/** Map legends open by default on screens ≥ 640 px (Tailwind sm). */
export const wideScreen = () => typeof window !== "undefined" && window.matchMedia?.("(min-width: 640px)").matches === true;
