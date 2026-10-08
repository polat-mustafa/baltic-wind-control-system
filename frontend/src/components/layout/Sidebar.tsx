/**
 * Navigation sidebar, grouped by project lifecycle stage.
 *
 * Features:
 * - Lifecycle groups: Develop, Design, Build & Commission, Operate, Decommission, then Learn
 * - Lucide icons per module
 * - Collapse/expand toggle
 * - Active state with left accent border
 * - Lock icon on modules the own project has not reached yet (lib/project/progress.ts)
 * - System status section at bottom
 *
 * Responsive: ≥ lg full width, md–lg an icon rail (user can expand it),
 * < md an off-canvas drawer opened from the header menu button.
 */

import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Wind,
  Zap,
  Monitor,
  Brain,
  ClipboardCheck,
  Cpu,
  Fan,
  MapPinned,
  Grid3x3,
  GraduationCap,
  HardHat,
  FileCheck2,
  FileText,
  Recycle,
  ChevronLeft,
  ChevronRight,
  X,
  Lock,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { StatusIndicator } from "../ui/StatusIndicator";
import { useLocks } from "../../lib/project/progress";

interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  description: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Pages grouped by project lifecycle stage (develop → design → build → operate). */
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Develop",
    items: [
      {
        label: "Site & Permits",
        path: "/develop",
        icon: MapPinned,
        description: "Open data, suitability, EIA, permit",
      },
      {
        label: "Layout",
        path: "/develop/layout",
        icon: Grid3x3,
        description: "Turbines, wakes, cables, cost",
      },
      {
        label: "Wind Resource",
        path: "/wind-resource",
        icon: Wind,
        description: "Weibull, wakes, layout, AEP",
      },
      {
        label: "Project Report",
        path: "/report",
        icon: FileText,
        description: "Print / PDF, JSON, windIO",
      },
    ],
  },
  {
    label: "Design",
    items: [
      {
        label: "Grid Integration",
        path: "/hv-grid",
        icon: Zap,
        description: "Load flow, FRT, STATCOM",
      },
      {
        label: "Turbine Physics",
        path: "/turbine-physics",
        icon: Fan,
        description: "Cp(λ, β), pitch & yaw control",
      },
    ],
  },
  {
    label: "Build & Commission",
    items: [
      {
        label: "Construction",
        path: "/build",
        icon: HardHat,
        description: "Vessels, weather windows, timeline",
      },
      {
        label: "Commissioning",
        path: "/commissioning",
        icon: ClipboardCheck,
        description: "Switching, LOTO, SAT",
      },
      {
        label: "Hand-over",
        path: "/build/handover",
        icon: FileCheck2,
        description: "As-built register, to operation",
      },
    ],
  },
  {
    label: "Operate",
    items: [
      {
        label: "Control Room",
        path: "/",
        icon: LayoutDashboard,
        description: "Wind farm map & KPIs",
      },
      {
        label: "SCADA",
        path: "/scada",
        icon: Monitor,
        description: "SLD, GOOSE, permits",
      },
      {
        label: "Forecasting",
        path: "/forecast",
        icon: Brain,
        description: "XGBoost, LSTM, TFT",
      },
      {
        label: "Digital Twin",
        path: "/digital-twin",
        icon: Cpu,
        description: "Condition monitoring, ISO 13374",
      },
    ],
  },
  {
    label: "Decommission",
    items: [
      {
        label: "Decommissioning",
        path: "/decommission",
        icon: Recycle,
        description: "Removal, recycling, seabed",
      },
    ],
  },
  {
    label: "Learn",
    items: [
      {
        label: "Academy",
        path: "/academy",
        icon: GraduationCap,
        description: "Courses, scored missions",
      },
    ],
  },
];

interface SidebarProps {
  /** Drawer state below md (the sidebar is off-canvas there). */
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const isMd = useMediaQuery("(min-width: 768px)");
  const isLg = useMediaQuery("(min-width: 1024px)");
  const [userCollapsed, setUserCollapsed] = useState<boolean | null>(null);
  // Icon rail between md and lg, full width from lg up; the toggle overrides.
  // The drawer below md always shows the labels.
  const collapsed = isMd && (userCollapsed ?? !isLg);
  const locks = useLocks();

  return (
    <nav
      aria-label="Main navigation"
      data-tour="nav"
      inert={!isMd && !mobileOpen}
      className={cn(
        "flex flex-col border-r border-border-primary bg-bg-secondary shrink-0",
        "transition-all duration-300 ease-in-out",
        "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-[2000] max-md:w-72 max-md:max-w-[85vw] max-md:overflow-y-auto max-md:shadow-2xl",
        mobileOpen ? "max-md:translate-x-0" : "max-md:-translate-x-full",
        collapsed ? "md:w-16" : "md:w-60",
      )}
    >
      {/* Collapse toggle (drawer: close button) */}
      <div className="flex items-center justify-end px-2 py-2 border-b border-border-primary">
        <button
          onClick={() => (isMd ? setUserCollapsed(!collapsed) : onMobileClose())}
          className={cn(
            "flex items-center justify-center h-7 w-7 rounded-md",
            "text-text-muted hover:text-text-secondary hover:bg-bg-hover",
            "transition-colors duration-150",
          )}
          aria-label={
            !isMd ? "Close menu" : collapsed ? "Expand sidebar" : "Collapse sidebar"
          }
        >
          {!isMd ? <X size={16} /> : collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navigation, grouped by lifecycle stage */}
      <div className="flex flex-1 flex-col gap-3 px-2 py-3">
        {NAV_GROUPS.map((group, gi) => (
          <section key={group.label} aria-labelledby={`nav-group-${gi}`}>
            {collapsed ? (
              <>
                {gi > 0 && <div className="mx-2 mb-2 border-t border-border-primary" aria-hidden />}
                <h2 id={`nav-group-${gi}`} className="sr-only">
                  {group.label}
                </h2>
              </>
            ) : (
              <h2
                id={`nav-group-${gi}`}
                className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted"
              >
                {group.label}
              </h2>
            )}
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const lock = locks[item.path];
                return (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      end={item.path === "/" || item.path === "/develop" || item.path === "/build"}
                      onClick={onMobileClose}
                      className={({ isActive }) =>
                        cn(
                          "group flex items-center gap-3 rounded-md transition-all duration-150",
                          collapsed ? "justify-center px-2 py-2" : "px-3 py-2",
                          isActive
                            ? "bg-accent-muted text-accent border-l-2 border-accent"
                            : "text-text-secondary hover:text-text-primary hover:bg-bg-hover border-l-2 border-transparent",
                        )
                      }
                      title={lock ? `${item.label} — locked. First: ${lock.need}` : collapsed ? item.label : undefined}
                      aria-label={collapsed || lock ? `${item.label}${lock ? " (locked)" : ""}` : undefined}
                    >
                      <Icon size={18} className="shrink-0" />
                      {!collapsed && (
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-sm font-medium truncate">{item.label}</span>
                          <span className="text-[10px] text-text-muted truncate">
                            {item.description}
                          </span>
                        </div>
                      )}
                      {lock && <Lock size={12} className="shrink-0 text-text-muted" aria-hidden />}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {/* System status footer */}
      <div
        className={cn(
          "border-t border-border-primary px-3 py-3",
          collapsed && "px-2 flex justify-center",
        )}
      >
        <StatusIndicator
          status="normal"
          label={collapsed ? undefined : "System Online"}
        />
        {!collapsed && (
          <div className="mt-2 text-[10px] text-text-muted font-mono">
            {new Date().toISOString().slice(0, 19).replace("T", " ")} UTC
          </div>
        )}
      </div>
    </nav>
  );
}
