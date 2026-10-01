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

  const revenueLossM = fleetData.total_revenue_loss_eur / 1_000_000;

  return (
    <div className="space-y-4">
      {/* KPI summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard
          label="Fleet TBA (technical)"
          value={fleetData.fleet_tba_pct.toFixed(1)}
          unit="%"
          icon={<Activity size={16} />}
          trendValue="Contract target ≥ 97 % · external causes excluded"
        />
        <KPICard
          label="Fleet EBA / PBA"
          value={`${fleetData.fleet_eba_pct.toFixed(1)} / ${fleetData.fleet_pba_pct.toFixed(1)}`}
          unit="%"
          icon={<Zap size={16} />}
          trendValue="Energy- and production-based"
        />
        <KPICard
          label="Lost energy · revenue"
          value={(fleetData.total_energy_loss_mwh / 1000).toFixed(1)}
          unit="GWh/yr"
          icon={<TrendingDown size={16} />}
          trendValue={`${revenueLossM.toFixed(2)} M€/yr at 75 €/MWh`}
        />
        <KPICard
          label="MTBF · MTTR"
          value={`${fleetData.fleet_mtbf_hours.toFixed(0)} · ${fleetData.fleet_mttr_hours.toFixed(0)}`}
          unit="h"
          icon={<AlertTriangle size={16} />}
          trendValue="Operating hours between faults · hours to restore"
        />
      </div>

      {/* Heatmap — full width */}
      <AvailabilityHeatmap />

      {/* Waterfall breakdown — full width */}
      <AvailabilityWaterfallPanel />
    </div>
  );
}
