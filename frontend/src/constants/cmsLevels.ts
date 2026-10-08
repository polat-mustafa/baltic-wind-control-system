/** CMS health-index bands and monitored components (backend services/p3/cms.py). */

import type { CMSAlertLevel, CMSComponent } from "../types/cms";

export const CMS_COMPONENTS: { id: CMSComponent; label: string }[] = [
  { id: "MAIN_BEARING", label: "Main bearing" },
  { id: "REAR_BEARING", label: "Rear bearing" },
  { id: "GENERATOR", label: "Generator" },
  { id: "PITCH", label: "Pitch" },
  { id: "YAW", label: "Yaw" },
];

export const LEVEL_STYLE: Record<CMSAlertLevel, { bg: string; fg: string; label: string }> = {
  GREEN: { bg: "transparent", fg: "var(--color-text-secondary)", label: "≥ 80 normal" },
  YELLOW: { bg: "#e6d27a", fg: "#1a1a1a", label: "60–80 watch" },
  AMBER: { bg: "#e39b3d", fg: "#1a1a1a", label: "40–60 inspect ≤ 30 d" },
  RED: { bg: "#c8362d", fg: "#ffffff", label: "20–40 inspect ≤ 7 d" },
  CRITICAL: { bg: "#7a1712", fg: "#ffffff", label: "< 20 stop" },
};

export function hiLevel(hi: number): CMSAlertLevel {
  return hi < 20 ? "CRITICAL" : hi < 40 ? "RED" : hi < 60 ? "AMBER" : hi < 80 ? "YELLOW" : "GREEN";
}
