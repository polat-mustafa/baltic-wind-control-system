/**
 * GOOSE protection — fault scenarios, clearing-time budget, event sequence,
 * the published GOOSE PDU and its retransmission scheme (IEC 61850-8-1).
 *
 * The clearing time is drawn as one stacked bar: protection operate time →
 * GOOSE transfer → trip coil → breaker opening → arcing, against the 100 ms
 * main-protection target. Fault currents are IEC 60909 values from the P2
 * pandapower model.
 */

import Plot from "react-plotly.js";
import { X, Zap } from "lucide-react";

import { useScadaStore } from "../../store/scadaStore";
import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { CHART_TRANSITION, useChartPalette } from "../../hooks/useChartPalette";
import { InfoButton } from "../ui/InfoButton";
import { gooseSimInfo } from "../../constants/panelInfo";
import type { ProtectionEvent } from "../../types/scada";
import { cn } from "../../lib/utils";

const PROTECTION: Record<string, string> = {
  busbar_overcurrent: "87B busbar differential",
  transformer_differential: "87T transformer differential",
  cable_earth_fault: "87L cable differential",
};

const at = (events: ProtectionEvent[], type: string) => events.find((e) => e.event_type === type)?.timestamp_ms ?? 0;

export default function GOOSESimPanel() {
  const result = useScadaStore((s) => s.simulationResult);
  const retx = useScadaStore((s) => s.retransmissionResult);
  const scenarios = useScadaStore((s) => s.faultScenarios);
  const selected = useScadaStore((s) => s.selectedFaultType);
  const loading = useScadaStore((s) => s.loading);
  const setSelected = useScadaStore((s) => s.setSelectedFaultType);
  const run = useScadaStore((s) => s.runGooseSimulation);
  const clear = useScadaStore((s) => s.clearSimulationResults);
  const c = useChartPalette();

  const scenarioCards = (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
      {scenarios.map((s) => (
        <div
          key={s.fault_type}
          className={cn("rounded-lg border p-3 bg-bg-secondary flex flex-col gap-2", selected === s.fault_type ? "border-accent" : "border-border-primary")}
        >
          <div className="text-xs font-semibold text-text-primary">{PROTECTION[s.fault_type] ?? s.fault_type}</div>
          <p className="text-[11px] text-text-secondary flex-1">{s.description}</p>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setSelected(s.fault_type);
              void run();
            }}
            className="self-start flex items-center gap-1 h-7 px-3 rounded bg-accent text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50"
          >
            <Zap size={11} /> Inject fault
          </button>
        </div>
      ))}
    </div>
  );

  if (!result) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-text-primary">GOOSE protection · IEC 61850-8-1</h3>
          <InfoButton info={gooseSimInfo} />
        </div>
        {scenarioCards}
        <p className="text-xs text-text-muted">
          Injecting a fault runs the protection sequence on the backend, trips the breakers on the single-line diagram,
          raises one P1 alarm and writes the SOE log.
        </p>
      </div>
    );
  }

  const ev = result.events;
  const tDetect = at(ev, "protection_detects");
  const tRecv = at(ev, "goose_received");
  const tCoil = at(ev, "breaker_trip_initiated");
  const tOpen = at(ev, "breaker_open");
  const tClear = at(ev, "arc_extinguished");
  const segments = [
    { name: "Protection operate", dt: tDetect, color: c.blue },
    { name: "GOOSE transfer", dt: tRecv - tDetect, color: c.orange },
    { name: "Trip coil", dt: tCoil - tRecv, color: c.yellow },
    { name: "Breaker opening", dt: tOpen - tCoil, color: c.aqua },
    { name: "Arcing to current zero", dt: tClear - tOpen, color: c.red },
  ];
  const cp = result.compliance;
  const pdu = result.goose_messages[0];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xs font-semibold text-text-primary">{PROTECTION[result.fault_type] ?? result.fault_type}</h3>
        <InfoButton info={gooseSimInfo} />
        <span className="text-[11px] text-text-secondary">{result.description}</span>
        <span className="flex-1" />
        <button type="button" onClick={clear} className="flex items-center gap-1 h-6 px-2 rounded border border-border-primary text-[11px] text-text-secondary hover:bg-bg-hover">
          <X size={11} /> New scenario
        </button>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {[
          ["Fault current Ik''", `${result.fault_current_ka.toFixed(1)} kA`, `${(result.fault_current_ka / result.load_current_ka).toFixed(1)} × load current`, true],
          ["GOOSE transfer", `${cp.goose_latency_ms.toFixed(1)} ms`, `≤ ${cp.goose_max_allowed_ms} ms (IEC 61850-5 TT6)`, cp.goose_compliant],
          ["Fault clearing", `${cp.total_clearance_ms.toFixed(1)} ms`, `≤ ${cp.clearance_max_allowed_ms} ms main-protection target`, cp.clearance_compliant],
          ["Operator alarm", `${at(ev, "scada_alarm").toFixed(0)} ms`, "IEC 60870-5-104 — after the fault is gone", true],
        ].map(([label, value, sub, ok]) => (
          <div key={label as string} className="rounded-lg border border-border-primary bg-bg-secondary p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">{label}</div>
            <div className="text-lg font-mono font-semibold text-text-primary">{value}</div>
            <div className={cn("text-[11px]", ok ? "text-text-muted" : "text-status-alarm font-semibold")}>
              {ok ? sub : `NOT MET — ${sub}`}
            </div>
          </div>
        ))}
      </div>

      {/* Clearing time budget */}
      <section className="rounded-lg border border-border-primary bg-bg-secondary p-3">
        <h4 className="text-xs font-semibold text-text-primary">Clearing-time budget</h4>
        <Plot
          data={segments.map((s) => ({
            type: "bar" as const,
            orientation: "h" as const,
            name: s.name,
            y: ["t"],
            x: [s.dt],
            marker: { color: s.color },
            text: [`${s.dt.toFixed(1)}`],
            textposition: "inside" as const,
            insidetextanchor: "middle" as const,
            textfont: { color: "#ffffff", size: 11 },
            hovertemplate: `${s.name}: %{x:.1f} ms<extra></extra>`,
          }))}
          layout={{
            ...DARK_PLOTLY_LAYOUT,
            barmode: "stack",
            height: 150,
            transition: CHART_TRANSITION,
            margin: { t: 30, r: 24, b: 40, l: 16 },
            legend: { orientation: "h", y: 1.35, x: 0, font: { size: 10 } },
            yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, visible: false },
            xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, title: { text: "Time from fault inception [ms]", font: { size: 11 } }, range: [0, 110] },
            shapes: [{ type: "line", x0: cp.clearance_max_allowed_ms, x1: cp.clearance_max_allowed_ms, yref: "paper", y0: 0, y1: 1, line: { color: c.ref, dash: "dot", width: 1.5 } }],
            annotations: [{ x: cp.clearance_max_allowed_ms, yref: "paper", y: 1, text: "target", showarrow: false, xanchor: "right", font: { size: 10, color: c.ink } }],
          }}
          config={PLOTLY_CONFIG}
          className="w-full"
          useResizeHandler
          style={{ width: "100%" }}
        />
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {/* Sequence of events */}
        <section className="rounded-lg border border-border-primary bg-bg-secondary p-3">
          <h4 className="text-xs font-semibold text-text-primary mb-1">Sequence of events</h4>
          <table className="w-full text-[11px]">
            <tbody>
              {ev.map((e) => (
                <tr key={`${e.event_type}-${e.timestamp_ms}-${e.ied_name}`} className="border-t border-border-primary/60">
                  <td className="py-1 pr-3 font-mono text-right tabular-nums text-text-primary whitespace-nowrap">{e.timestamp_ms.toFixed(1)} ms</td>
                  <td className="py-1 pr-3 font-mono text-text-muted whitespace-nowrap">{e.ied_name || "—"}</td>
                  <td className="py-1 text-text-secondary">{e.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* GOOSE PDU + retransmission */}
        <section className="rounded-lg border border-border-primary bg-bg-secondary p-3 space-y-2">
          <h4 className="text-xs font-semibold text-text-primary">Published GOOSE PDU</h4>
          {pdu && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11px] font-mono">
              <dt className="text-text-muted">gocbRef</dt>
              <dd className="text-text-primary break-all">{pdu.gocb_ref}</dd>
              <dt className="text-text-muted">datSet</dt>
              <dd className="text-text-secondary break-all">{pdu.dat_set}</dd>
              <dt className="text-text-muted">dst MAC · APPID · VLAN</dt>
              <dd className="text-text-secondary">
                {pdu.mac_address} · {pdu.app_id} · {pdu.vlan_id} (priority 4, EtherType 0x88B8)
              </dd>
              <dt className="text-text-muted">stNum · sqNum</dt>
              <dd className="text-text-secondary">
                {pdu.st_num} · {pdu.sq_num} (stNum +1 on change, sqNum +1 per repeat)
              </dd>
              <dt className="text-text-muted">allData</dt>
              <dd className="text-text-secondary">
                {Object.entries(pdu.all_data)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(", ")}
              </dd>
            </dl>
          )}
          {retx && (
            <Plot
              data={[
                {
                  type: "scatter",
                  mode: "lines+markers",
                  x: retx.schedule_ms,
                  y: retx.intervals_ms,
                  line: { color: c.blue, width: 2, shape: "hv" },
                  marker: { size: 6, color: c.blue },
                  hovertemplate: "repeat at %{x:.0f} ms · interval %{y:.0f} ms<extra></extra>",
                },
              ]}
              layout={{
                ...DARK_PLOTLY_LAYOUT,
                height: 190,
                showlegend: false,
                margin: { t: 24, r: 16, b: 40, l: 56 },
                title: { text: `Retransmission: T0 = ${retx.min_time_ms} ms doubling to ${retx.max_time_ms} ms`, font: { size: 11 }, x: 0, xanchor: "left" },
                xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, type: "log", title: { text: "Time after the event [ms]", font: { size: 11 } } },
                yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, type: "log", title: { text: "Interval [ms]", font: { size: 11 } } },
              }}
              config={PLOTLY_CONFIG}
              className="w-full"
              useResizeHandler
              style={{ width: "100%" }}
            />
          )}
        </section>
      </div>
    </div>
  );
}
