/**
 * Cable DTS Thermal Monitoring Dashboard — M10.
 *
 * Controls: current (A) and ambient temperature (°C) sliders.
 * Left panel: 45 km temperature profile line chart.
 * Right panel: dynamic rating KPIs + hotspot list.
 *
 * IEC 60287 thermal model, J-tube zone_factor = 1.4 (hottest section).
 * WARNING > 70°C, CRITICAL > 90°C.
 */

import { useEffect } from "react";
import { Thermometer, AlertTriangle } from "lucide-react";

import { useCableDTSStore } from "../../store/cableDtsStore";
import { Button } from "../ui/Button";
import DTSProfilePanel from "./DTSProfilePanel";
import DTSRatingPanel from "./DTSRatingPanel";
import CableDTSTemperatureMap from "./CableDTSTemperatureMap";

export default function CableDTSDashboard() {
  const {
    currentA,
    ambientTempC,
    loading,
    error,
    runAll,
    setCurrentA,
    setAmbientTempC,
    clearError,
  } = useCableDTSStore();

  useEffect(() => {
    runAll();
  }, [runAll]);

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-status-alarm/10 border border-status-alarm/30 rounded-lg text-sm flex justify-between">
          <span className="text-status-alarm flex items-center gap-2"><AlertTriangle size={14} /> {error}</span>
          <Button variant="ghost" size="sm" onClick={clearError}>Dismiss</Button>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-4 flex-wrap bg-bg-secondary rounded-lg border border-border-primary p-3">
        <Thermometer size={16} className="text-accent shrink-0" />
        <div className="flex items-center gap-2">
          <label className="text-xs text-text-muted">Current:</label>
          <input
            type="range"
            min={100}
            max={900}
            step={10}
            value={currentA}
            onChange={(e) => setCurrentA(Number(e.target.value))}
            className="w-28 accent-accent"
          />
          <span className="text-xs font-mono text-text-primary w-16">{currentA} A</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-text-muted">Ambient temp:</label>
          <input
            type="range"
            min={-5}
            max={30}
            step={1}
            value={ambientTempC}
            onChange={(e) => setAmbientTempC(Number(e.target.value))}
            className="w-28 accent-accent"
          />
          <span className="text-xs font-mono text-text-primary w-12">{ambientTempC}°C</span>
        </div>
        <Button size="sm" onClick={runAll} disabled={loading}>
          {loading ? (
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Loading…
            </span>
          ) : "Update"}
        </Button>
      </div>

      {/* Heat map strip — shows temperature colour-gradient along 45 km route */}
      <CableDTSTemperatureMap />

      {/* Main content */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <DTSProfilePanel />
        <DTSRatingPanel />
      </div>
    </div>
  );
}
