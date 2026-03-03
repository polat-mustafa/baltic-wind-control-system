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
} from "lucide-react";

import Sidebar from "./Sidebar";
import { StatusIndicator } from "../ui/StatusIndicator";
import { cn } from "../../lib/utils";

const ROUTE_LABELS: Record<string, string> = {
  "/": "Overview",
  "/wind-resource": "P1 · Wind Resource",
  "/hv-grid": "P2 · HV Grid Integration",
  "/scada": "P3 · SCADA & Automation",
  "/forecast": "P4 · AI Forecasting",
  "/commissioning": "P5 · HV Commissioning",
};

export default function AppShell() {
  const location = useLocation();
  const currentLabel = ROUTE_LABELS[location.pathname] ?? "Dashboard";

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
            <StatusIndicator status="normal" label="Live" />
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
