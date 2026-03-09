/**
 * KPI header for Turbine Physics dashboard.
 *
 * Displays 5 key performance indicators from the simulation summary
 * and Cp surface data. Color-coded per ISA-101 thresholds.
 */

import { useTurbinePhysicsStore } from "../../store/turbinePhysicsStore";

// ── ISA-101 SCADA Colors ────────────────────────────────────────

const SCADA_COLORS = {
  ENERGIZED: "#3ecf6e", // green — normal / optimal
  WARNING: "#f5a623",   // amber — caution
  FAULT: "#e74c3c",     // red   — alarm
  MUTED: "#9ba3b8",     // gray  — no data
} as const;

// ── KPI Card ────────────────────────────────────────────────────

function KPICard({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: string;
  unit: string;
  color?: string;
}) {
  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">
        {label}
      </p>
      <div className="flex items-baseline">
        <span
          className="text-2xl font-bold"
          style={{ color: color ?? SCADA_COLORS.MUTED }}
        >
          {value}
        </span>
        <span className="text-sm font-normal text-slate-400 ml-1">{unit}</span>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────

export default function TurbinePhysicsKPIHeader() {
  const simulation = useTurbinePhysicsStore((s) => s.simulation);
  const cpSurface = useTurbinePhysicsStore((s) => s.cpSurface);

  // Derive values from simulation summary
  const cpMax = cpSurface?.cp_max ?? null;
  const meanPower = simulation?.summary.mean_power_mw ?? null;
  const capacityFactor = simulation?.summary.capacity_factor ?? null;
  const peakRotorSpeed = simulation
    ? Math.max(...simulation.rotor_speed_rpm)
    : null;
  const meanPitch = simulation?.summary.mean_pitch_deg ?? null;

  // Color logic — ISA-101 thresholds
  const cpColor =
    cpMax === null
      ? SCADA_COLORS.MUTED
      : cpMax > 0.45
        ? SCADA_COLORS.ENERGIZED
        : cpMax > 0.35
          ? SCADA_COLORS.WARNING
          : SCADA_COLORS.FAULT;

  const cfColor =
    capacityFactor === null
      ? SCADA_COLORS.MUTED
      : capacityFactor > 0.35
        ? SCADA_COLORS.ENERGIZED
        : capacityFactor > 0.2
          ? SCADA_COLORS.WARNING
          : SCADA_COLORS.FAULT;

  const rpmColor =
    peakRotorSpeed === null
      ? SCADA_COLORS.MUTED
      : peakRotorSpeed <= 8.6
        ? SCADA_COLORS.ENERGIZED
        : peakRotorSpeed <= 9.0
          ? SCADA_COLORS.WARNING
          : SCADA_COLORS.FAULT;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
      <KPICard
        label="Cp Max"
        value={cpMax !== null ? cpMax.toFixed(4) : "—"}
        unit=""
        color={cpColor}
      />
      <KPICard
        label="Mean Power"
        value={meanPower !== null ? meanPower.toFixed(2) : "—"}
        unit="MW"
        color={SCADA_COLORS.ENERGIZED}
      />
      <KPICard
        label="Capacity Factor"
        value={
          capacityFactor !== null ? (capacityFactor * 100).toFixed(1) : "—"
        }
        unit="%"
        color={cfColor}
      />
      <KPICard
        label="Peak Rotor Speed"
        value={peakRotorSpeed !== null ? peakRotorSpeed.toFixed(2) : "—"}
        unit="rpm"
        color={rpmColor}
      />
      <KPICard
        label="Mean Pitch"
        value={meanPitch !== null ? meanPitch.toFixed(1) : "—"}
        unit="deg"
        color={SCADA_COLORS.MUTED}
      />
    </div>
  );
}
