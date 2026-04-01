/**
 * Availability dashboard — IEC 61400-26 fleet availability overview.
 *
 * Layout:
 * ┌─────────────────────────────────────────────────────────────┐
 * │  KPI row: Fleet TBA%, Fleet EBA%, Revenue Loss, Energy Loss │
 * ├─────────────────────────────────────────────────────────────┤
 * │         AvailabilityHeatmap (full width)                    │
 * ├──────────────────────────┬──────────────────────────────────┤
 * │  AvailabilityWaterfallPanel (full width)                    │
 * └─────────────────────────────────────────────────────────────┘
 *
 * Fetches fleet availability and fleet downtime breakdown on mount.
 */

import { useEffect } from "react";

import { Activity, TrendingDown, Zap, AlertTriangle } from "lucide-react";

import { useAvailabilityStore } from "../../store/availabilityStore";
import { KPICard } from "../ui/KPICard";
import AvailabilityHeatmap from "./AvailabilityHeatmap";
import AvailabilityWaterfallPanel from "./AvailabilityWaterfallPanel";

export default function AvailabilityDashboard() {
  const {
    fleetData,
    loading,
    error,
    loaded,
    fetchFleetAvailability,
    fetchBreakdown,
    clearError,
  } = useAvailabilityStore();

  // Fetch both datasets on mount
  useEffect(() => {
    void fetchFleetAvailability();
    void fetchBreakdown("fleet");
  }, [fetchFleetAvailability, fetchBreakdown]);

  // ── Loading state ────────────────────────────────────────────
  if (loading && !loaded) {
    return (
      <div className="flex items-center justify-center gap-3 py-20 text-text-muted">
        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        Loading availability data…
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────
  if (error) {
    return (
      <div className="rounded-lg border border-status-alarm/30 bg-status-alarm/10 p-4 text-status-alarm text-sm flex items-center justify-between">
        <span>Failed to load availability data: {error}</span>
        <button
          onClick={clearError}
          className="ml-4 text-xs underline hover:no-underline"
        >
          Dismiss
        </button>
      </div>
    );
  }

  if (!fleetData) return null;

  const revenueLossM = fleetData.revenue_loss_eur / 1_000_000;

  return (
    <div className="space-y-4">
      {/* KPI summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard
          label="Fleet TBA"
          value={fleetData.fleet_tba_pct.toFixed(1)}
          unit="%"
          icon={<Activity size={16} />}
          trend={fleetData.fleet_tba_pct >= 95 ? "up" : fleetData.fleet_tba_pct >= 90 ? "flat" : "down"}
          trendValue="IEC 61400-26 target: 95%"
        />
        <KPICard
          label="Fleet EBA"
          value={fleetData.fleet_eba_pct.toFixed(1)}
          unit="%"
          icon={<Zap size={16} />}
          trend={fleetData.fleet_eba_pct >= 95 ? "up" : "flat"}
          trendValue="Energy-Based Availability"
        />
        <KPICard
          label="Revenue Loss"
          value={revenueLossM.toFixed(2)}
          unit="M€"
          icon={<TrendingDown size={16} />}
          trend="down"
          trendValue="Due to downtime events"
        />
        <KPICard
          label="Energy Loss"
          value={fleetData.total_energy_loss_mwh.toFixed(0)}
          unit="MWh"
          icon={<AlertTriangle size={16} />}
          trend="down"
          trendValue={fleetData.assessment}
        />
      </div>

      {/* Heatmap — full width */}
      <AvailabilityHeatmap />

      {/* Waterfall breakdown — full width */}
      <AvailabilityWaterfallPanel />
    </div>
  );
}
