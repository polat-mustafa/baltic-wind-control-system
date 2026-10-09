/**
 * Protection tab — place a fault, watch the zone's protection clear it.
 *
 *   controls (location, cable position, fault type)
 *   zone diagram with the trip · verdict
 *   trip timeline (relay time + breaker break time per relay)
 *   overcurrent TCC with TMS sliders · settings + grading tables
 */

import { useEffect } from "react";
import { motion, MotionConfig } from "framer-motion";
import Plot from "react-plotly.js";

import { protectionEducation } from "../../constants/education/p2";
import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { CHART_TRANSITION, useChartPalette } from "../../hooks/useChartPalette";
import { useProtectionStore } from "../../store/protectionStore";
import type { FaultLocation } from "../../types/protection";
import { ChartWrapper } from "../ui/ChartWrapper";
import { EducationButton } from "../ui/EducationButton";
import ProtectionZoneDiagram from "./ProtectionZoneDiagram";
import RelayCoordinationTable from "./RelayCoordinationTable";
import TCCCurvePlot from "./TCCCurvePlot";

const LOCATIONS: [FaultLocation, string][] = [
  ["string_feeder", "66 kV string feeder"],
  ["oss_busbar_66kv", "OSS 66 kV busbar"],
  ["export_cable", "220 kV export cable"],
  ["oss_busbar_220kv", "OSS 220 kV busbar"],
];

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } },
};

function Check({ pass, children }: { pass: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-1.5">
      <span aria-label={pass ? "pass" : "fail"} className={pass ? "text-status-normal" : "text-status-alarm"}>
        {pass ? "✓" : "✗"}
      </span>
      <span>{children}</span>
    </li>
  );
}

function TripTimeline() {
  const study = useProtectionStore((s) => s.study);
  const c = useChartPalette();
  if (!study) return null;
  const ev = study.relay_sequence.filter((e) => e.operated).sort((a, b) => b.trip_time_ms - a.trip_time_ms);
  const y = ev.map((e) => `${e.relay_id} · ${e.role}`);
  const is220 = study.voltage_kv > 100 || study.fault_location === "oss_busbar_66kv";
  return (
    <ChartWrapper
      title="Trip timeline — relay decision + breaker break time"
      footer={`Clearance = relay time + 60 ms rated break time (3 cycles, IEC 62271-100). ${study.time_criterion}.`}
    >
      <Plot
        data={[
          {
            type: "bar",
            orientation: "h",
            name: "Relay operating time",
            y,
            x: ev.map((e) => e.trip_time_ms),
            marker: { color: c.blue },
            hovertemplate: "%{y}: relay %{x:.0f} ms<extra></extra>",
          },
          {
            type: "bar",
            orientation: "h",
            name: "Breaker break time",
            y,
            x: ev.map((e) => e.clearance_time_ms - e.trip_time_ms),
            marker: { color: c.orange },
            text: ev.map((e) => `${e.clearance_time_ms.toFixed(0)} ms`),
            textposition: "outside",
            textfont: { color: c.ink, size: 11 },
            cliponaxis: false,
            hovertemplate: "%{y}: cleared at %{text}<extra></extra>",
          },
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          transition: CHART_TRANSITION,
          barmode: "stack",
          bargap: 0.35,
          legend: { orientation: "h", y: 1.2, x: 0, font: { size: 11 } },
          xaxis: {
            ...DARK_PLOTLY_LAYOUT.xaxis,
            title: { text: "Time after fault inception [ms]", font: { size: 12 } },
            range: [0, Math.max(200, ...ev.map((e) => e.clearance_time_ms)) * 1.18],
          },
          yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, type: "category", automargin: true, tickfont: { size: 11 } },
          shapes: is220
            ? [{ type: "line", xref: "x", yref: "paper", x0: 150, x1: 150, y0: 0, y1: 1, line: { color: c.ref, width: 1.5, dash: "dash" } } as const]
            : [],
          annotations: is220
            ? [{ x: 150, y: 1, xref: "x", yref: "paper", yanchor: "bottom", text: "150 ms (PSE FRT t_clear)", showarrow: false, font: { size: 10 } } as const]
            : [],
          margin: { t: 40, r: 24, b: 48, l: 8 },
        }}
        config={PLOTLY_CONFIG}
        useResizeHandler
        className="w-full"
        style={{ height: Math.max(200, 70 + ev.length * 48) }}
      />
    </ChartWrapper>
  );
}

export default function ProtectionDashboard() {
  const { study, faultLocation, positionPct, faultType, loading, error, setFaultLocation, setPositionPct, setFaultType, runStudy, clearError } =
    useProtectionStore();

  useEffect(() => {
    const t = setTimeout(() => void runStudy(), 250);
    return () => clearTimeout(t);
  }, [faultLocation, positionPct, faultType, runStudy]);

  return (
    <MotionConfig reducedMotion="user">
      <motion.div className="space-y-4" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.08 } } }}>
        {error && (
          <div className="p-3 bg-status-alarm/10 border border-status-alarm/30 rounded-lg text-sm flex justify-between items-center">
            <span className="text-status-alarm">{error}</span>
            <button className="text-xs text-text-secondary" onClick={clearError}>
              Dismiss
            </button>
          </div>
        )}

        <motion.div variants={item} className="rounded-lg border border-border-primary bg-bg-secondary p-4 space-y-3">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-text-secondary">Fault location</p>
              <div role="tablist" aria-label="Fault location" className="flex flex-wrap gap-1">
                {LOCATIONS.map(([k, l]) => (
                  <button
                    key={k}
                    role="tab"
                    aria-selected={faultLocation === k}
                    onClick={() => setFaultLocation(k)}
                    className={`rounded px-2 py-1 text-xs font-medium ${faultLocation === k ? "bg-accent text-accent-ink" : "text-text-secondary hover:bg-bg-tertiary"}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            {faultLocation === "export_cable" && (
              <label className="flex flex-col gap-0.5 text-xs text-text-muted min-w-[12rem]">
                <span className="flex justify-between">
                  Position along the cable <span className="font-mono text-text-primary">{positionPct} % from onshore</span>
                </span>
                <input type="range" min={0} max={100} step={5} value={positionPct} onChange={(e) => setPositionPct(Number(e.target.value))} className="accent-accent" />
              </label>
            )}
            <div role="tablist" aria-label="Fault type" className="flex gap-1">
              {(["3ph", "ph_ph"] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={faultType === t}
                  onClick={() => setFaultType(t)}
                  className={`rounded px-2 py-1 text-xs font-medium ${faultType === t ? "bg-accent text-accent-ink" : "text-text-secondary hover:bg-bg-tertiary"}`}
                >
                  {t === "3ph" ? "3-phase" : "phase-phase"}
                </button>
              ))}
            </div>
            {loading && <span className="text-xs text-text-muted">studying…</span>}
          </div>
        </motion.div>

        {study && (
          <>
            <motion.div variants={item} className="grid grid-cols-1 xl:grid-cols-[1fr_20rem] gap-4">
              <div className="rounded-lg border border-border-primary bg-bg-secondary p-4">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-base font-semibold text-text-primary">Protection zones and the trip</h3>
                  <EducationButton content={protectionEducation} />
                </div>
                <div className="overflow-x-auto">
                  <ProtectionZoneDiagram study={study} />
                </div>
              </div>
              <div className="rounded-lg border border-border-primary bg-bg-secondary p-4">
                <h3 className="text-sm font-semibold text-text-primary mb-1">{study.assessment === "PASS" ? "✓ Protection adequate" : "✗ Protection inadequate"}</h3>
                <p className="text-xs text-text-muted mb-2">{study.fault_current_description}</p>
                <ul className="space-y-2 text-xs text-text-secondary">
                  <Check pass={study.first_relay === study.main_relay || study.relay_sequence.find((e) => e.relay_id === study.first_relay)?.role.startsWith("main") === true}>
                    Zone protection {study.main_relay} trips first
                  </Check>
                  <Check pass={study.backup_margin_ms === null || study.backup_margin_ms >= 300}>
                    Backup {study.backup_margin_ms === null ? "not needed" : `${study.backup_margin_ms.toFixed(0)} ms behind (≥ 300 ms)`}
                  </Check>
                  <Check pass={study.fast_enough}>
                    {study.fault_location === "string_feeder"
                      ? `Head cable withstands ${study.time_limit_s.toFixed(1)} s at this current — backup clears well within`
                      : `Main clearance ${study.main_clearance_ms.toFixed(0)} ms ≤ 150 ms`}
                  </Check>
                  <Check pass={study.fully_graded}>All grading pairs selective at IEC 60909 currents</Check>
                </ul>
              </div>
            </motion.div>

            <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <TripTimeline />
              <TCCCurvePlot />
            </motion.div>

            <motion.div variants={item} className="rounded-lg border border-border-primary bg-bg-secondary p-4">
              <h3 className="text-sm font-semibold text-text-primary mb-2">Settings and grading</h3>
              <RelayCoordinationTable />
            </motion.div>
          </>
        )}
      </motion.div>
    </MotionConfig>
  );
}
