/**
 * Professional SCADA navigation sidebar.
 *
 * Features:
 * - Lucide icons per module
 * - Collapse/expand toggle
 * - Active state with left accent border
 * - System status section at bottom
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
  BookOpen,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { StatusIndicator } from "../ui/StatusIndicator";

interface NavItem {
  label: string;
  shortLabel: string;
  path: string;
  icon: LucideIcon;
  description: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Overview",
    shortLabel: "Overview",
    path: "/",
    icon: LayoutDashboard,
    description: "Wind farm map & KPIs",
  },
  {
    label: "P1 · Wind Resource",
    shortLabel: "P1",
    path: "/wind-resource",
    icon: Wind,
    description: "AEP, Weibull, wake losses",
  },
  {
    label: "P2 · HV Grid",
    shortLabel: "P2",
    path: "/hv-grid",
    icon: Zap,
    description: "Load flow, FRT, STATCOM",
  },
  {
    label: "P3 · SCADA",
    shortLabel: "P3",
    path: "/scada",
    icon: Monitor,
    description: "SLD, GOOSE, permits",
  },
  {
    label: "P4 · Forecasting",
    shortLabel: "P4",
    path: "/forecast",
    icon: Brain,
    description: "XGBoost, LSTM, TFT",
  },
  {
    label: "P5 · Commissioning",
    shortLabel: "P5",
    path: "/commissioning",
    icon: ClipboardCheck,
    description: "Switching, LOTO, SAT",
  },
  {
    label: "Digital Twin",
    shortLabel: "DT",
    path: "/digital-twin",
    icon: Cpu,
    description: "Condition monitoring, ISO 13374",
  },
  {
    label: "Engineer's Library",
    shortLabel: "Lib",
    path: "/library",
    icon: BookOpen,
    description: "Read-only primers (no sim)",
  },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <nav
      className={cn(
        "flex flex-col border-r border-border-primary bg-bg-secondary shrink-0",
        "transition-all duration-300 ease-in-out",
        collapsed ? "w-16" : "w-60",
      )}
    >
      {/* Collapse toggle */}
      <div className="flex items-center justify-end px-2 py-2 border-b border-border-primary">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "flex items-center justify-center h-7 w-7 rounded-md",
            "text-text-muted hover:text-text-secondary hover:bg-bg-hover",
            "transition-colors duration-150",
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navigation items */}
      <ul className="flex flex-col gap-0.5 px-2 py-3 flex-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.path}>
              <NavLink
                to={item.path}
                end={item.path === "/"}
                className={({ isActive }) =>
                  cn(
                    "group flex items-center gap-3 rounded-md transition-all duration-150",
                    collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5",
                    isActive
                      ? "bg-accent-muted text-accent border-l-2 border-accent"
                      : "text-text-secondary hover:text-text-primary hover:bg-bg-hover border-l-2 border-transparent",
                  )
                }
                title={collapsed ? item.label : undefined}
              >
                <Icon
                  size={18}
                  className="shrink-0"
                />
                {!collapsed && (
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium truncate">
                      {item.label}
                    </span>
                    <span className="text-[10px] text-text-muted truncate">
                      {item.description}
                    </span>
                  </div>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>

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
