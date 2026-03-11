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
import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { InfoButton } from "../ui/InfoButton";
import { ChartWrapper } from "../ui/ChartWrapper";
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
      <div className="bg-bg-secondary rounded-lg border border-border-primary p-6 flex items-center justify-center h-64">
        <p className="text-text-muted">
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
          <h3 className="text-base font-semibold text-text-primary">
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
        <ChartWrapper title="Protection Event Timeline">
          <div className="w-full" style={{ height: 400 }}>
            <Plot
              data={[timelineData]}
              layout={{
                ...DARK_PLOTLY_LAYOUT,
                autosize: true,
                margin: { l: 160, r: 30, t: 10, b: 50 },
                xaxis: {
                  ...DARK_PLOTLY_LAYOUT.xaxis,
                  title: { text: "Time since fault inception [ms]" },
                },
                yaxis: {
                  ...DARK_PLOTLY_LAYOUT.yaxis,
                  automargin: true,
                },
                showlegend: false,
              }}
              config={PLOTLY_CONFIG}
              useResizeHandler
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </ChartWrapper>
      )}

      {/* Retransmission schedule */}
      {retransmissionData && (
        <ChartWrapper title="GOOSE Retransmission Schedule (IEC 61850-8-1 §15.2.2)">
          <div className="w-full" style={{ height: 340 }}>
            <Plot
              data={[retransmissionData]}
              layout={{
                ...DARK_PLOTLY_LAYOUT,
                autosize: true,
                margin: { l: 60, r: 30, t: 10, b: 50 },
                xaxis: {
                  ...DARK_PLOTLY_LAYOUT.xaxis,
                  title: { text: "Cumulative time [ms]" },
                },
                yaxis: {
                  ...DARK_PLOTLY_LAYOUT.yaxis,
                  title: { text: "Interval [ms]" },
                },
                showlegend: false,
              }}
              config={PLOTLY_CONFIG}
              useResizeHandler
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </ChartWrapper>
      )}
    </div>
  );
}
