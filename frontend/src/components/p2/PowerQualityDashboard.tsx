/**
 * Power Quality & Harmonics Dashboard — M06.
 *
 * KPI row (THD, Pst, Plt, resonance) + three panels:
 *   1. Harmonic spectrum bar chart
 *   2. Network resonance impedance scan
 *   3. Flicker KPIs + passive filter design
 *
 * Standards: IEC 61000-3-6, IEC 61000-3-7, IEC 61400-21.
 * Key: 66 kV is IEC HV tier (≥35 kV) — 3% THD limit, 2% H5 limit.
 */

import { useEffect } from "react";
import { Activity, AlertTriangle } from "lucide-react";

import { usePowerQualityStore } from "../../store/powerQualityStore";
import { Button } from "../ui/Button";
import HarmonicSpectrumPanel from "./HarmonicSpectrumPanel";
import ResonanceScanPanel from "./ResonanceScanPanel";
import FlickerFilterPanel from "./FlickerFilterPanel";

function KPIBadge({ label, value, unit, ok }: { label: string; value: string; unit: string; ok?: boolean }) {
  return (
    <div className="bg-bg-tertiary rounded-lg px-3 py-2">
      <p className="text-xs text-text-muted">{label}</p>
      <p className={`text-lg font-bold font-mono ${ok === false ? "text-status-alarm" : ok === true ? "text-status-success" : "text-text-primary"}`}>
        {value} <span className="text-xs font-normal text-text-muted">{unit}</span>
      </p>
    </div>
  );
}

export default function PowerQualityDashboard() {
  const { harmonics, resonance, flicker, loading, error, runAll, clearError } = usePowerQualityStore();

  useEffect(() => {
    runAll();
  }, [runAll]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted text-sm">
        <span className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin mr-2" />
        Running power quality analysis…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-status-alarm/10 border border-status-alarm/30 rounded-lg text-sm flex justify-between">
          <span className="text-status-alarm flex items-center gap-2"><AlertTriangle size={14} /> {error}</span>
          <Button variant="ghost" size="sm" onClick={clearError}>Dismiss</Button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-accent" />
          <span className="text-sm font-semibold text-text-primary">Power Quality — 66 kV POC (IEC HV tier)</span>
        </div>
        <Button size="sm" onClick={runAll} disabled={loading}>Refresh</Button>
      </div>

      {/* KPI row */}
      {harmonics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <KPIBadge
            label="THD Voltage"
            value={harmonics.thd_voltage_pct.toFixed(1)}
            unit="%"
            ok={harmonics.compliant}
          />
          <KPIBadge
            label="Dom. harmonic"
            value={`H${harmonics.dominant_harmonic_order}`}
            unit={`${harmonics.dominant_harmonic_pct.toFixed(1)}%`}
          />
          {flicker && (
            <>
              <KPIBadge label="Pst" value={flicker.pst.toFixed(2)} unit="" ok={flicker.pst_compliant} />
              <KPIBadge label="Plt" value={flicker.plt.toFixed(2)} unit="" ok={flicker.plt_compliant} />
            </>
          )}
        </div>
      )}

      {/* Three panels */}
      <HarmonicSpectrumPanel />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ResonanceScanPanel />
        <FlickerFilterPanel />
      </div>

      {resonance && resonance.critical_harmonics.length > 0 && (
        <div className="bg-status-warning/10 border border-status-warning/30 rounded-lg p-3 text-xs text-status-warning">
          ⚠ Critical harmonics near network resonance: H{resonance.critical_harmonics.join(", H")}
          — consider passive filter at cable-resonant frequency {resonance.cable_resonant_freq_hz.toFixed(0)} Hz
        </div>
      )}
    </div>
  );
}
