/**
 * Application shell — ISA-101 dark control room layout.
 *
 * Structure:
 *   1. Top bar — branding, breadcrumbs, system clock, connection status
 *   2. Sidebar — collapsible navigation with icons
 *   3. Content area — renders active route via <Outlet />
 *
 * The dark background follows ISA-101 High Performance HMI guidelines:
 * operators in dimmed control rooms benefit from a dark UI that makes
 * status colors (green/amber/red) more perceptually prominent.
 */

import { Link, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Wind,
  Signal,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";

import Sidebar from "./Sidebar";
import { StatusIndicator } from "../ui/StatusIndicator";
import { cn } from "../../lib/utils";
import { useFaultSync } from "../../hooks/useFaultSync";
import { useScadaStore } from "../../store/scadaStore";
import { useLandingStore } from "../../store/landingStore";

const ROUTE_LABELS: Record<string, string> = {
  "/": "Overview",
  "/wind-resource": "P1 · Wind Resource",
  "/hv-grid": "P2 · HV Grid Integration",
  "/scada": "P3 · SCADA & Automation",
  "/forecast": "P4 · AI Forecasting",
  "/commissioning": "P5 · HV Commissioning",
  "/digital-twin": "Digital Twin · Condition Monitoring",
};

export default function AppShell() {
  const location = useLocation();
  const currentLabel = ROUTE_LABELS[location.pathname] ?? "Dashboard";

  // Unified fault synchronization between landing map and SCADA
  useFaultSync();

  // Subscribe to alarm/fault state using primitives — never return arrays from
  // Zustand selectors (filter/map return new references → Object.is fails → infinite loop)
  const criticalCount = useScadaStore((s) =>
    s.alarms.filter((a) => a.priority === "CRITICAL" && a.state === "ACTIVE").length,
  );
  const firstCriticalText = useScadaStore((s) => {
    const alarm = s.alarms.find((a) => a.priority === "CRITICAL" && a.state === "ACTIVE");
    if (!alarm) return "";
    return `${alarm.equipment} ${alarm.description.split("—")[0]?.trim() ?? ""}`;
  });
  const landingActiveAlerts = useLandingStore((s) => s.kpis.activeAlerts);

  // Dynamic status indicator
  const headerStatus: "normal" | "warning" | "alarm" = criticalCount > 0
    ? "alarm"
    : landingActiveAlerts > 0
      ? "warning"
      : "normal";
  const headerLabel = criticalCount > 0
    ? `${criticalCount} Critical`
    : landingActiveAlerts > 0
      ? "Degraded"
      : "Normal";

  // Simulation clock — updates every second
  const [clock, setClock] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary flex flex-col">
      {/* ── Top Bar ── */}
      <header className="h-12 bg-bg-secondary border-b border-border-primary flex items-center justify-between px-4 shrink-0">
        {/* Left: Logo + Breadcrumb */}
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="flex items-center justify-center h-7 w-7 rounded-md bg-accent/15">
              <Wind size={16} className="text-accent" />
            </div>
            <span className="font-semibold text-sm tracking-tight text-text-primary">
              Baltic Wind Alpha
            </span>
          </Link>

          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-text-muted">
            <ChevronRight size={12} />
            <span className="text-xs font-medium text-text-secondary">
              {currentLabel}
            </span>
          </div>
        </div>

        {/* Right: System info */}
        <div className="flex items-center gap-4">
          {/* Farm spec badge */}
          <span className="hidden md:inline-flex text-[10px] text-text-muted font-mono tracking-wide">
            510 MW · 34×V236 · 66/220/400 kV
          </span>

          {/* Connection status */}
          <div className="flex items-center gap-2">
            <Signal size={12} className="text-text-muted" />
            <StatusIndicator status={headerStatus} label={headerLabel} />
          </div>

          {/* Simulation clock */}
          <div
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-md",
              "bg-bg-tertiary border border-border-primary",
              "font-mono text-xs text-text-secondary tabular-nums",
            )}
          >
            {clock.toLocaleString("sv-SE", { timeZone: "Europe/Warsaw" })}{" "}
            <span className="text-text-muted text-[10px]">
              {clock.toLocaleString("en-GB", { timeZone: "Europe/Warsaw", timeZoneName: "short" }).split(" ").pop()}
            </span>
          </div>
        </div>
      </header>

      {/* ── Global Critical Alarm Banner ── */}
      {criticalCount > 0 && (
        <div className="shrink-0 px-4 py-1.5 bg-red-900/40 border-b border-red-700/50 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2 text-xs font-mono text-red-400">
            <AlertTriangle size={14} />
            <span className="font-bold">
              {criticalCount} CRITICAL ALARM{criticalCount > 1 ? "S" : ""} ACTIVE
            </span>
            {firstCriticalText && (
              <span className="text-red-400/70">— {firstCriticalText}</span>
            )}
          </div>
          <Link
            to="/scada"
            className="text-[10px] font-mono text-red-400 hover:text-red-300 underline underline-offset-2"
          >
            Open SCADA →
          </Link>
        </div>
      )}

      {/* ── Main Layout: Sidebar + Content ── */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto p-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
