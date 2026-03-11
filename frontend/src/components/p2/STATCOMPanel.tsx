/**
 * STATCOM reactive power compensation panel.
 *
 * Shows cable Q generation, reactor absorption, Ferranti voltage rise,
 * and compensation adequacy verdict.
 * Bar chart: Q balance (cable, reactor, net).
 */

import Plot from "react-plotly.js";
import { useGridStore } from "../../store/gridStore";
import { SCADA_COLORS } from "../../constants/scadaColors";
import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { InfoButton } from "../ui/InfoButton";
import { statcomInfo } from "../../constants/panelInfo";

export default function STATCOMPanel() {
  const { statcomSizing } = useGridStore();

  if (!statcomSizing) return null;

  const netQ = statcomSizing.cable_q_mvar - statcomSizing.reactor_q_mvar;

  return (
    <div className="bg-bg-secondary rounded-lg border border-border-primary p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-semibold text-text-primary">
          STATCOM &amp; Reactive Compensation
        </h3>
        <div className="flex items-center gap-2">
          <InfoButton info={statcomInfo} />
          <span
          className="text-xs px-2 py-1 rounded font-semibold"
          style={{
            backgroundColor: statcomSizing.compensation_adequate
              ? "rgba(0, 255, 0, 0.15)"
              : "rgba(255, 0, 0, 0.15)",
            color: statcomSizing.compensation_adequate
              ? SCADA_COLORS.ENERGIZED
              : SCADA_COLORS.FAULT,
          }}
        >
            {statcomSizing.compensation_adequate ? "Compensation Adequate" : "Compensation Insufficient"}
          </span>
        </div>
      </div>

      <Plot
        data={[
          {
            type: "bar",
            x: ["Cable Q (gen)", "Reactor (abs)", "Net Q", "STATCOM range"],
            y: [
              statcomSizing.cable_q_mvar,
              -statcomSizing.reactor_q_mvar,
              netQ,
              statcomSizing.statcom_rating_mvar,
            ],
            marker: {
              color: [
                SCADA_COLORS.WARNING,
                SCADA_COLORS.VOLTAGE_220KV,
                netQ > 0 ? SCADA_COLORS.WARNING : SCADA_COLORS.VOLTAGE_220KV,
                SCADA_COLORS.ENERGIZED,
              ],
            },
            text: [
              `+${statcomSizing.cable_q_mvar.toFixed(0)} MVAR`,
              `-${statcomSizing.reactor_q_mvar.toFixed(0)} MVAR`,
              `${netQ > 0 ? "+" : ""}${netQ.toFixed(0)} MVAR`,
              `\u00B1${statcomSizing.statcom_rating_mvar.toFixed(0)} MVAR`,
            ],
            textposition: "outside",
            textfont: { size: 10, color: "rgb(148, 163, 184)" },
            hovertemplate: "%{x}<br>Q = %{y:.1f} MVAR<extra></extra>",
          },
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          height: 380,
          yaxis: {
            ...DARK_PLOTLY_LAYOUT.yaxis,
            title: "Reactive Power [MVAR]",
          },
          xaxis: {
            ...DARK_PLOTLY_LAYOUT.xaxis,
            tickfont: { size: 10, color: "rgb(148, 163, 184)" },
          },
        }}
        config={PLOTLY_CONFIG}
        className="w-full"
      />

      {/* Summary metrics */}
      <div className="grid grid-cols-3 gap-3 mt-3">
        <div className="text-center">
          <p className="text-xs text-text-muted">Ferranti Rise</p>
          <p className="text-sm font-bold" style={{ color: SCADA_COLORS.WARNING }}>
            {(statcomSizing.ferranti_rise_pu * 100).toFixed(2)}%
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-text-muted">Without Comp. V_max</p>
          <p className="text-sm font-bold" style={{
            color: statcomSizing.without_compensation_v_max_pu > 1.05
              ? SCADA_COLORS.FAULT
              : SCADA_COLORS.ENERGIZED,
          }}>
            {statcomSizing.without_compensation_v_max_pu.toFixed(4)} pu
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-text-muted">Q = \u03C9CV\u00B2L</p>
          <p className="text-sm font-bold text-slate-200">
            {statcomSizing.cable_q_mvar.toFixed(1)} MVAR
          </p>
        </div>
      </div>
    </div>
  );
}
