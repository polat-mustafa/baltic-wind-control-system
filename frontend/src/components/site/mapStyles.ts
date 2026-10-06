/** Map styling per open-data layer role (screening map and layout canvas). */

export interface RoleStyle {
  label: string;
  color: string;
  fill: number;
  dash?: string;
  on: boolean;
}

/** Map styling per layer role. Suitability owns green; nothing else uses it. */
export const ROLE_STYLE: Record<string, RoleStyle> = {
  protected: { label: "Natura 2000", color: "#a855f7", fill: 0.18, on: true },
  shipping: { label: "Shipping priority (MSP)", color: "#3b82f6", fill: 0.14, dash: "6 4", on: true },
  owf: { label: "Wind farm areas", color: "#f97316", fill: 0.18, on: true },
  restricted: { label: "Military / munitions", color: "#ef4444", fill: 0.12, dash: "3 3", on: true },
  territorial: { label: "12 nm territorial sea", color: "#64748b", fill: 0.1, dash: "8 6", on: true },
  eez: { label: "EEZ boundary", color: "#334155", fill: 0, dash: "2 6", on: false },
  cable: { label: "Subsea cables", color: "#e11d48", fill: 0, on: true },
  grid: { label: "Grid connection", color: "#0f766e", fill: 1, on: true },
};
