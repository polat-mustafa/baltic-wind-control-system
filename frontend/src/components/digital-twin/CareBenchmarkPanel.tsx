/**
 * Real data — the twin's detector on real offshore SCADA with recorded faults.
 *
 * CARE to Compare, Wind Farm B (offshore, Germany, anonymised): 15 data sets, six end in
 * a fault (bearing damage, high temperatures), nine are normal operation. Same EWMA
 * settings as the live twin, nothing tuned on the fault labels. Built offline, bundled.
 */

import { useEffect, useState } from "react";
import Plot from "react-plotly.js";

import { getCareBenchmark, type CareBenchmark, type CareEvent } from "../../services/digitalTwinApi";
import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { useChartPalette } from "../../hooks/useChartPalette";
import { ChartWrapper } from "../ui/ChartWrapper";
import { InfoTile } from "../ui/InfoTile";
import { SourceBadge } from "../ui/SourceBadge";

function verdict(e: CareEvent): { text: string; tone: string } {
  if (e.label === "anomaly")
    return e.alarm
      ? { text: `detected ${e.warning_days?.toFixed(1)} d before the fault`, tone: "text-status-normal" }
      : { text: "missed", tone: "text-status-alarm" };
  return e.alarm ? { text: "false alarm", tone: "text-status-warning" } : { text: "quiet (correct)", tone: "text-status-normal" };
}

export default function CareBenchmarkPanel() {
  const pal = useChartPalette();
  const [data, setData] = useState<CareBenchmark | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pick, setPick] = useState<number | null>(null);
  const [farm, setFarm] = useState("b");

  useEffect(() => {
    getCareBenchmark(farm)
      .then((d) => {
        setData(d);
        setPick(d.events.find((e) => e.label === "anomaly" && e.alarm)?.event_id ?? d.events[0]?.event_id ?? null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [farm]);

  if (error) return <p className="text-sm text-status-alarm">Benchmark failed: {error}</p>;
  if (!data) return <p className="text-sm text-text-muted">Loading the real-data benchmark…</p>;

  const { summary: s } = data;
  const ev = data.events.find((e) => e.event_id === pick) ?? data.events[0];
  const days = ev.daily_health_min.map((_, i) => i + 1);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border-primary bg-bg-secondary p-4 text-sm text-text-secondary">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-text-primary">
            The twin&apos;s detector on <b>real offshore SCADA with recorded faults</b> — CARE to Compare, Wind Farm{" "}
            {data.farm} (offshore wind farm in Germany, anonymised, 10-min data) — <i>{data.role}</i>.
          </p>
          {data.available_farms.length > 1 && (
            <div role="radiogroup" aria-label="Wind farm" className="flex gap-1">
              {data.available_farms.map((f) => (
                <button
                  key={f}
                  type="button"
                  role="radio"
                  aria-checked={f === farm}
                  onClick={() => setFarm(f)}
                  className={`rounded border px-2 py-0.5 text-xs font-semibold ${f === farm ? "border-accent bg-accent/15 text-text-primary" : "border-border-primary text-text-secondary hover:bg-bg-hover"}`}
                >
                  Farm {f.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="mt-1">
          {/* one sentence per span: the UI translator matches each as a whole, numbers as {n} */}
          <span>
            Per temperature channel a normal-behaviour model learns the bearing / gearbox / transformer temperature
            from power, wind, ambient temperature and rotor speed on a normal training year; the residual runs through
            the same EWMA chart as the live twin (λ {data.settings.ewma_lambda}, L {data.settings.ewma_L},{" "}
            {data.settings.persistence_samples} samples persistence).
          </span>{" "}
          <span>
            Phase I scores each quarter of the normal training year with a model of the other three and widens each
            limit until that year raises no alarm. Nothing is tuned on the fault labels; Farm C was run once with the
            method fixed on Farm B.
          </span>
        </p>
        <p className="mt-1">
          Finding: at the live twin&apos;s own limit the detector caught {data.summary_live_limit.detected} /{" "}
          {s.anomaly_events} faults and alarmed in {data.summary_live_limit.false_alarms} / {s.normal_events} normal
          periods. With the Phase I calibration it catches {s.detected} / {s.anomaly_events} with {s.false_alarms} /{" "}
          {s.normal_events} false alarms
          {data.summary_v1 &&
            ` (the first, one-season calibration gave ${data.summary_v1.detected} / ${s.anomaly_events} and ${data.summary_v1.false_alarms} / ${s.normal_events})`}
          . Real SCADA drifts more than the simulator; a fleet would also retrain the normal-behaviour models and
          rationalise alarms (ISA-18.2) before handing them to operators.
        </p>
        {s.detected / s.anomaly_events - s.false_alarms / s.normal_events < 0.25 && (
          <p className="mt-1 text-status-warning">
            Held-out verdict: detection rate {Math.round((100 * s.detected) / s.anomaly_events)} % against a false-alarm
            rate of {Math.round((100 * s.false_alarms) / s.normal_events)} % — close to chance. Most faults here are
            pitch, converter and communication faults that a temperature-only model cannot see, and environment
            channels (nacelle outside temperature) raise alarms of their own. Reported as measured, not re-tuned on
            these labels.
          </p>
        )}
        <div className="mt-2 text-xs">
          <SourceBadge p={{ source: data.source, license: "CC BY-SA 4.0", quality: "measured" }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <InfoTile label="Faults detected" value={`${s.detected} / ${s.anomaly_events}`} subtitle="alarm before the recorded fault" />
        <InfoTile
          label="False alarms"
          value={`${s.false_alarms} / ${s.normal_events}`}
          priority={s.false_alarms > s.normal_events / 3 ? "warning" : "normal"}
          subtitle="normal periods with an alarm"
        />
        <InfoTile label="Median warning" value={s.median_warning_days?.toFixed(1) ?? "–"} unit="days" subtitle="fault − first alarm" />
        <InfoTile label="Data" value={data.events.length} unit="turbine data sets" subtitle="each ~1 year train + event window" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="overflow-x-auto rounded-lg border border-border-primary bg-bg-secondary p-4">
          <h3 className="mb-2 text-base font-semibold text-text-primary">Events</h3>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-text-muted">
              <tr>
                <th className="py-1 pr-2 font-medium">#</th>
                <th className="py-1 pr-2 font-medium">Recorded</th>
                <th className="py-1 font-medium">Twin verdict</th>
              </tr>
            </thead>
            <tbody>
              {data.events.map((e) => {
                const v = verdict(e);
                return (
                  <tr
                    key={e.event_id}
                    onClick={() => setPick(e.event_id)}
                    className={`cursor-pointer border-t border-border-primary hover:bg-bg-hover ${e.event_id === ev.event_id ? "bg-accent/10" : ""}`}
                  >
                    <td className="py-1 pr-2 font-mono">{e.event_id}</td>
                    <td className="py-1 pr-2">{e.label === "anomaly" ? e.description || "fault" : "normal operation"}</td>
                    <td className={`py-1 ${v.tone}`}>
                      <button type="button" className="text-left" onClick={() => setPick(e.event_id)}>
                        {v.text}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <ChartWrapper
          title={`Event ${ev.event_id} — ${ev.label === "anomaly" ? ev.description || "fault" : "normal operation"}`}
          footer={
            ev.first_channel
              ? `First alarm: ${ev.first_channel}, day ${ev.first_alarm_day} of ${ev.window_days}. Channels in alarm: ${ev.channels_in_alarm.join(", ")}.`
              : `No channel crossed its limit (${ev.channels_charted} channels charted).`
          }
        >
          <div style={{ height: 320 }}>
            <Plot
              data={[
                {
                  x: days,
                  y: ev.daily_health_min,
                  type: "scatter",
                  mode: "lines",
                  name: "Worst channel health",
                  line: { color: pal.blue, width: 2 },
                },
                ...(ev.daily_residual_k
                  ? [
                      {
                        x: days,
                        y: ev.daily_residual_k,
                        type: "scatter" as const,
                        mode: "lines" as const,
                        name: `Residual ${ev.first_channel} [K]`,
                        yaxis: "y2",
                        line: { color: pal.orange, width: 1.5 },
                      },
                    ]
                  : []),
              ]}
              layout={{
                ...DARK_PLOTLY_LAYOUT,
                title: undefined,
                xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, title: "Day of the event window", domain: [0, 0.9] },
                yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: "Health index", range: [0, 105] },
                yaxis2: { title: { text: "Residual [K]" }, overlaying: "y", side: "right", gridcolor: "transparent", tickformat: ".0f" },
                shapes: [
                  { type: "line", xref: "paper", x0: 0, x1: 0.9, y0: 70, y1: 70, line: { color: pal.ref, dash: "dot", width: 1 } },
                  { type: "line", xref: "paper", x0: 0, x1: 0.9, y0: 40, y1: 40, line: { color: pal.red, dash: "dot", width: 1 } },
                ],
                legend: { ...DARK_PLOTLY_LAYOUT.legend, orientation: "h", x: 0, y: 1.15 },
              }}
              config={PLOTLY_CONFIG}
              className="h-full w-full"
              useResizeHandler
            />
          </div>
        </ChartWrapper>
      </div>
    </div>
  );
}
