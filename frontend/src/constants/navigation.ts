/**
 * App navigation: every page, grouped by project lifecycle stage
 * (develop → design → build → operate → decommission, then learn).
 * The sidebar draws it; the header breadcrumb reads the group and label.
 */

import {
  Brain,
  ClipboardCheck,
  Cpu,
  Fan,
  FileCheck2,
  FileText,
  GraduationCap,
  Grid3x3,
  HardHat,
  LayoutDashboard,
  Library,
  MapPinned,
  Monitor,
  Recycle,
  Wind,
  Zap,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  /** One line on what the page does — the sidebar tooltip. */
  description: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Develop",
    items: [
      { label: "Site & Permits", path: "/develop", icon: MapPinned, description: "Open data, suitability, EIA, permit" },
      { label: "Layout", path: "/develop/layout", icon: Grid3x3, description: "Turbines, wakes, cables, cost" },
      { label: "Wind Resource", path: "/wind-resource", icon: Wind, description: "Weibull, wakes, layout, AEP" },
      { label: "Project Report", path: "/report", icon: FileText, description: "Print / PDF, JSON, windIO" },
      { label: "My Projects", path: "/projects", icon: Library, description: "Open, compare, export" },
    ],
  },
  {
    label: "Design",
    items: [
      { label: "Grid Integration", path: "/hv-grid", icon: Zap, description: "Load flow, FRT, STATCOM" },
      { label: "Turbine Physics", path: "/turbine-physics", icon: Fan, description: "Cp(λ, β), pitch & yaw control" },
    ],
  },
  {
    label: "Build",
    items: [
      { label: "Construction", path: "/build", icon: HardHat, description: "Vessels, weather windows, timeline" },
      { label: "Commissioning", path: "/commissioning", icon: ClipboardCheck, description: "Switching, LOTO, SAT" },
      { label: "Hand-over", path: "/build/handover", icon: FileCheck2, description: "As-built register, to operation" },
    ],
  },
  {
    label: "Operate",
    items: [
      { label: "Control Room", path: "/", icon: LayoutDashboard, description: "Wind farm map & KPIs" },
      { label: "SCADA", path: "/scada", icon: Monitor, description: "SLD, GOOSE, permits" },
      { label: "Forecasting", path: "/forecast", icon: Brain, description: "XGBoost, LSTM, TFT" },
      { label: "Digital Twin", path: "/digital-twin", icon: Cpu, description: "Condition monitoring, ISO 13374" },
    ],
  },
  {
    label: "Decommission",
    items: [{ label: "Decommissioning", path: "/decommission", icon: Recycle, description: "Removal, recycling, seabed" }],
  },
  {
    label: "Learn",
    items: [{ label: "Academy", path: "/academy", icon: GraduationCap, description: "Courses, scored missions" }],
  },
];

/** Lifecycle group and page label for a route ("Operate", "SCADA"); null off the menu. */
export function navTrail(pathname: string): { group: string; label: string } | null {
  for (const g of NAV_GROUPS) {
    const item = g.items.find((i) => i.path === pathname);
    if (item) return { group: g.label, label: item.label };
  }
  return null;
}
