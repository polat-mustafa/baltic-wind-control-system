/**
 * GOOSE fault simulation panel — run scenarios and view protection timeline.
 *
 * Left: fault scenario selector + compliance badge.
 * Right: Plotly timeline chart showing protection events with ms precision.
 * Bottom: retransmission schedule visualization.
 */

import { useMemo } from "react";
import Plot from "react-plotly.js";

import { useScadaStore } from "../../store/scadaStore";
import { SCADA_COLORS } from "../../constants/scadaColors";
import { InfoButton } from "../ui/InfoButton";
import { gooseSimInfo } from "../../constants/panelInfo";

const EVENT_COLOR: Record<string, string> = {
  fault_inception: SCADA_COLORS.FAULT,
  relay_pickup: SCADA_COLORS.WARNING,
  relay_trip: SCADA_COLORS.FAULT,
  goose_publish: SCADA_COLORS.EARTHED,
  breaker_open: SCADA_COLORS.VOLTAGE_220KV,
  scada_alarm: SCADA_COLORS.ALARM_HIGH,
};

export default function GOOSESimPanel() {
  const { simulationResult, retransmissionResult } = useScadaStore();

  const timelineData = useMemo(() => {
    if (!simulationResult) return null;

    const events = simulationResult.events;
    return {
      x: events.map((e) => e.timestamp_ms),
      y: events.map((e) => e.description),
      marker: {
        color: events.map((e) => EVENT_COLOR[e.event_type] ?? SCADA_COLORS.DE_ENERGIZED),
        size: 12,
        symbol: "diamond",
      },
      text: events.map(
        (e) => `${e.timestamp_ms.toFixed(1)} ms — ${e.ied_name || "System"}`,
      ),
      hoverinfo: "text" as const,
      type: "scatter" as const,
      mode: "markers" as const,
    };
  }, [simulationResult]);

  const retransmissionData = useMemo(() => {
    if (!retransmissionResult) return null;

    return {
      x: retransmissionResult.schedule_ms,
      y: retransmissionResult.intervals_ms,
      type: "bar" as const,
      marker: {
        color: SCADA_COLORS.EARTHED,
      },
      text: retransmissionResult.intervals_ms.map(
        (v) => `${v.toFixed(1)} ms`,
      ),
      hoverinfo: "text" as const,
    };
  }, [retransmissionResult]);

  if (!simulationResult) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 flex items-center justify-center h-64">
        <p className="text-slate-500">
          Run a GOOSE fault simulation to see the protection timeline
        </p>
      </div>
    );
  }

  const { compliance } = simulationResult;
  const allCompliant =
    compliance.goose_compliant && compliance.clearance_compliant;

  return (
    <div className="space-y-4">
      {/* Compliance summary */}
      <div className="bg-bg-secondary rounded-lg border border-border-primary p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-text-primary">
            GOOSE Fault Simulation — {simulationResult.fault_type}
          </h3>
          <div className="flex items-center gap-2">
            <InfoButton info={gooseSimInfo} />
            <span
            className="px-2 py-0.5 rounded text-xs font-bold"
            style={{
              backgroundColor: allCompliant ? "#064e3b" : "#7f1d1d",
              color: allCompliant ? SCADA_COLORS.ENERGIZED : SCADA_COLORS.FAULT,
            }}
          >
              {allCompliant ? "IEC COMPLIANT" : "NON-COMPLIANT"}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-slate-500">Location</span>
            <p className="text-slate-300 font-mono">
              {simulationResult.location}
            </p>
          </div>
          <div>
            <span className="text-slate-500">GOOSE Latency</span>
            <p
              className="font-mono font-bold"
              style={{
                color: compliance.goose_compliant
                  ? SCADA_COLORS.ENERGIZED
                  : SCADA_COLORS.FAULT,
              }}
            >
              {compliance.goose_latency_ms.toFixed(1)} ms
              <span className="text-slate-500 font-normal">
                {" "}
                / {compliance.goose_max_allowed_ms} ms
              </span>
            </p>
          </div>
          <div>
            <span className="text-slate-500">Fault Clearance</span>
            <p
              className="font-mono font-bold"
              style={{
                color: compliance.clearance_compliant
                  ? SCADA_COLORS.ENERGIZED
                  : SCADA_COLORS.FAULT,
              }}
            >
              {compliance.total_clearance_ms.toFixed(1)} ms
              <span className="text-slate-500 font-normal">
                {" "}
                / {compliance.clearance_max_allowed_ms} ms
              </span>
            </p>
          </div>
          <div>
            <span className="text-slate-500">Fault Current</span>
            <p className="text-slate-300 font-mono">
              {simulationResult.fault_current_pu.toFixed(2)} pu
            </p>
          </div>
        </div>
      </div>

      {/* Protection timeline chart */}
      {timelineData && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-2">
            Protection Event Timeline
          </h3>
          <Plot
            data={[timelineData]}
            layout={{
              height: 280,
              margin: { l: 200, r: 20, t: 10, b: 40 },
              paper_bgcolor: "transparent",
              plot_bgcolor: "transparent",
              font: { color: "#94a3b8", size: 10 },
              xaxis: {
                title: { text: "Time since fault inception [ms]" },
                gridcolor: "#334155",
                zerolinecolor: "#475569",
              },
              yaxis: {
                gridcolor: "#334155",
              },
              showlegend: false,
            }}
            config={{ displayModeBar: false, responsive: true }}
            className="w-full"
          />
        </div>
      )}

      {/* Retransmission schedule */}
      {retransmissionData && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-2">
            GOOSE Retransmission Schedule (IEC 61850-8-1 §15.2.2)
          </h3>
          <Plot
            data={[retransmissionData]}
            layout={{
              height: 200,
              margin: { l: 60, r: 20, t: 10, b: 40 },
              paper_bgcolor: "transparent",
              plot_bgcolor: "transparent",
              font: { color: "#94a3b8", size: 10 },
              xaxis: {
                title: { text: "Cumulative time [ms]" },
                gridcolor: "#334155",
              },
              yaxis: {
                title: { text: "Interval [ms]" },
                gridcolor: "#334155",
              },
              showlegend: false,
            }}
            config={{ displayModeBar: false, responsive: true }}
            className="w-full"
          />
        </div>
      )}
    </div>
  );
}
