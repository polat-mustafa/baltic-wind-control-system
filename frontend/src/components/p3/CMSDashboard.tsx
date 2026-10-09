/**
 * Condition monitoring (CMS, M12) — fleet health matrix, active findings and
 * the selected turbine: component health, P-F degradation curve, hydraulic (pitch) oil
 * trend and training fault injection.
 *
 * P-F curve: health falls linearly at the component's degradation rate
 * (HI / RUL) from today; the bands show when it would cross into watch,
 * inspect and stop territory — the planning window CMS buys the operator.
 */

import { useEffect, useState } from "react";
import Plot from "react-plotly.js";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { useCMSStore } from "../../store/cmsStore";
import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { CHART_TRANSITION, useChartPalette } from "../../hooks/useChartPalette";
import { CMS_COMPONENTS, LEVEL_STYLE } from "../../constants/cmsLevels";
import type { CMSComponent, FaultSeverity } from "../../types/cms";
import FleetHealthPanel from "./FleetHealthPanel";
import { cn } from "../../lib/utils";

const label = (id: string) => CMS_COMPONENTS.find((c) => c.id === id)?.label ?? id;
const selectCls = "h-7 text-xs bg-bg-secondary border border-border-primary rounded px-2 text-text-secondary";

export default function CMSDashboard() {
  const fleet = useCMSStore((s) => s.fleetHealth);
  const health = useCMSStore((s) => s.turbineHealth);
  const oil = useCMSStore((s) => s.oilAnalysis);
  const alerts = useCMSStore((s) => s.alerts);
  const error = useCMSStore((s) => s.error);
  const selectedId = useCMSStore((s) => s.selectedTurbineId);
  const injection = useCMSStore((s) => s.lastFaultInjection);
  const fetchFleetHealth = useCMSStore((s) => s.fetchFleetHealth);
  const fetchTurbineDetail = useCMSStore((s) => s.fetchTurbineDetail);
  const injectFault = useCMSStore((s) => s.injectFault);
  const clearError = useCMSStore((s) => s.clearError);
  const c = useChartPalette();

  const [pfComponent, setPfComponent] = useState<CMSComponent>("MAIN_BEARING");
  const [severity, setSeverity] = useState<FaultSeverity>("MODERATE");

  useEffect(() => {
    void fetchFleetHealth();
    void fetchTurbineDetail(useCMSStore.getState().selectedTurbineId);
  }, [fetchFleetHealth, fetchTurbineDetail]);

  // P-F curve follows the turbine's worst component unless the user picks one
  useEffect(() => {
    if (!health) return;
    const worst = [...health.components].sort((a, b) => a.health_index - b.health_index)[0];
    setPfComponent(worst.component);
  }, [health]);

  const comp = health?.components.find((x) => x.component === pfComponent);
  const rate = comp ? comp.health_index / comp.rul_days : 0;
  const horizon = comp ? Math.min(comp.rul_days, 5 * 365) : 0;
  const days = Array.from({ length: 61 }, (_, i) => (horizon * i) / 60);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xs font-semibold text-text-primary">Condition monitoring · ISO 13373 / ISO 13381-1</h3>
        <span className="flex-1" />
        <button type="button" onClick={() => void fetchFleetHealth()} className="flex items-center gap-1 h-6 px-2 rounded border border-border-primary text-xs text-text-secondary hover:bg-bg-hover">
          <RefreshCw size={11} /> Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-2 rounded border border-status-warning/40 bg-status-warning/10 text-xs text-text-primary">
          <AlertTriangle size={13} className="text-status-warning" /> <span className="flex-1">{error}</span>
          <button type="button" onClick={clearError} className="text-text-muted hover:text-text-primary">Dismiss</button>
        </div>
      )}

      {!fleet ? <p className="text-xs text-text-muted">Loading fleet health…</p> : <FleetHealthPanel />}

      {/* Findings (AMBER and worse) */}
      {alerts.length > 0 && (
        <section className="bg-bg-secondary rounded-lg border border-border-primary p-3">
          <h4 className="text-xs font-semibold text-text-primary mb-1.5">Open CMS findings ({alerts.length})</h4>
          <ul className="space-y-1">
            {[...alerts].sort((a, b) => a.health_index - b.health_index).map((a) => {
              const st = LEVEL_STYLE[a.alert_level];
              return (
                <li key={a.id}>
                  <button type="button" onClick={() => void fetchTurbineDetail(a.turbine_id)} className="w-full flex flex-wrap items-center gap-2 text-left text-xs hover:bg-bg-hover rounded px-1 py-0.5">
                    <span className="w-16 text-center rounded-sm font-mono font-bold" style={{ background: st.bg, color: st.fg }}>
                      {a.alert_level}
                    </span>
                    <span className="text-text-primary">{a.description}</span>
                    <span className="ml-auto text-text-muted">{a.recommended_action} · RUL {a.rul_days.toFixed(0)} d</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {health && (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
          {/* Components + P-F */}
          <section className="bg-bg-secondary rounded-lg border border-border-primary p-3">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="text-xs font-semibold text-text-primary">{selectedId} · component health</h4>
              <span className="text-xs font-mono text-text-muted">overall HI {health.overall_health_index.toFixed(0)} (worst component)</span>
            </div>
            <div className="grid grid-cols-5 gap-1.5 mb-3">
              {health.components.map((x) => {
                const st = LEVEL_STYLE[x.alert_level];
                return (
                  <button
                    key={x.component}
                    type="button"
                    onClick={() => setPfComponent(x.component)}
                    className={cn("rounded border p-1.5 text-left", pfComponent === x.component ? "border-accent" : "border-border-primary")}
                  >
                    <div className="text-xs text-text-muted truncate">{label(x.component)}</div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-mono font-bold text-text-primary">{x.health_index.toFixed(0)}</span>
                      <span className="inline-block w-2 h-2 rounded-full border border-border-secondary" style={{ background: st.bg }} />
                    </div>
                    <div className="text-xs font-mono text-text-muted leading-tight">
                      {x.component === "PITCH" || x.component === "YAW" ? "—" : `${x.vib_rms_mm_s.toFixed(1)} mm/s`}
                      <br />
                      {x.temp_celsius.toFixed(0)} °C · {x.rul_days > 3650 ? "> 10 y" : `${x.rul_days.toFixed(0)} d`}
                    </div>
                  </button>
                );
              })}
            </div>
            {comp && (
              <Plot
                data={[
                  {
                    type: "scatter",
                    mode: "lines",
                    x: days,
                    y: days.map((d) => Math.max(0, comp.health_index - rate * d)),
                    line: { color: c.blue, width: 2 },
                    hovertemplate: "day %{x:.0f} · HI %{y:.0f}<extra></extra>",
                  },
                ]}
                layout={{
                  ...DARK_PLOTLY_LAYOUT,
                  height: 220,
                  showlegend: false,
                  transition: CHART_TRANSITION,
                  margin: { t: 24, r: 90, b: 44, l: 48 },
                  title: { text: `P-F curve · ${label(pfComponent)} · ${rate.toFixed(2)} HI/day`, font: { size: 12 }, x: 0, xanchor: "left" },
                  shapes: [80, 60, 40, 20].map((y) => ({ type: "line", xref: "paper", x0: 0, x1: 1, y0: y, y1: y, line: { color: c.ref, width: 1, dash: "dot" } })),
                  annotations: (
                    [
                      [80, "watch"],
                      [60, "inspect ≤ 30 d"],
                      [40, "inspect ≤ 7 d"],
                      [20, "stop"],
                    ] as const
                  ).map(([y, t]) => ({ xref: "paper", x: 1, y, text: t, showarrow: false, xanchor: "left", font: { size: 10, color: c.ink } })),
                  xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, title: { text: "Days from today", font: { size: 12 } } },
                  yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: "Health index", font: { size: 12 } }, range: [0, 100] },
                }}
                config={PLOTLY_CONFIG}
                className="w-full"
                useResizeHandler
                style={{ width: "100%" }}
              />
            )}
          </section>

          {/* Oil + fault injection */}
          <section className="bg-bg-secondary rounded-lg border border-border-primary p-3 space-y-3">
            {oil && (
              <div>
                <div className="flex flex-wrap items-baseline gap-2">
                  <h4 className="text-xs font-semibold text-text-primary">Hydraulic oil (pitch HPU) · ISO 4406</h4>
                  <span className="text-xs font-mono text-text-secondary">
                    now {oil.current_iso_code} · limit {oil.target_iso_code}
                  </span>
                  {oil.water_ingress_alert && <span className="text-xs font-semibold text-status-warning">water &gt; 200 ppm</span>}
                </div>
                <Plot
                  data={(
                    [
                      ["≥ 4 µm", "particle_count_4um", c.blue],
                      ["≥ 6 µm", "particle_count_6um", c.orange],
                      ["≥ 14 µm", "particle_count_14um", c.aqua],
                    ] as const
                  ).map(([name, key, color]) => ({
                    type: "scatter" as const,
                    mode: "lines+markers" as const,
                    name,
                    x: oil.history.map((p) => p.timestamp_utc),
                    y: oil.history.map((p) => p[key]),
                    line: { color, width: 2 },
                    marker: { size: 4, color },
                  }))}
                  layout={{
                    ...DARK_PLOTLY_LAYOUT,
                    height: 200,
                    transition: CHART_TRANSITION,
                    margin: { t: 8, r: 16, b: 36, l: 56 },
                    legend: { orientation: "h", y: 1.12, x: 0, font: { size: 10 } },
                    yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, type: "log", title: { text: "Particles / mL", font: { size: 11 } } },
                    xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, type: "date", tickformat: "%b %y" },
                  }}
                  config={PLOTLY_CONFIG}
                  className="w-full"
                  useResizeHandler
                  style={{ width: "100%" }}
                />
                <p className="text-xs text-text-muted">
                  {oil.next_oil_change_recommendation} · viscosity {oil.history.at(-1)!.viscosity_cst.toFixed(0)} cSt (ISO VG 46) · water{" "}
                  {oil.history.at(-1)!.water_ppm.toFixed(0)} ppm
                </p>
              </div>
            )}

            <div className="border-t border-border-primary pt-2">
              <h4 className="text-xs font-semibold text-text-primary mb-1.5">Training: inject degradation on {selectedId}</h4>
              <div className="flex flex-wrap items-center gap-2">
                <select value={pfComponent} onChange={(e) => setPfComponent(e.target.value as CMSComponent)} className={selectCls} aria-label="Component to degrade">
                  {CMS_COMPONENTS.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.label}
                    </option>
                  ))}
                </select>
                <select value={severity} onChange={(e) => setSeverity(e.target.value as FaultSeverity)} className={selectCls} aria-label="Severity">
                  <option value="MINOR">Minor · 0.5 HI/day</option>
                  <option value="MODERATE">Moderate · 2 HI/day</option>
                  <option value="SEVERE">Severe · 5 HI/day</option>
                </select>
                <button type="button" onClick={() => void injectFault({ component: pfComponent, severity })} className="h-7 px-3 rounded bg-accent text-accent-ink text-xs font-semibold hover:opacity-90">
                  Inject
                </button>
              </div>
              {injection && <p className="mt-1.5 text-xs text-text-secondary">{injection.message}</p>}
              <p className="mt-1 text-xs text-text-muted">
                The fault starts from today's health and progresses in real days; the P-F curve shows the projected crossing
                times.
              </p>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

