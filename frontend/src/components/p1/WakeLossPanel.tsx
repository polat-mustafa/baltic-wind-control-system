/**
 * Wake loss panel — horizontal bar chart showing per-turbine wake loss %.
 *
 * SCADA color thresholds: <10% green, 10-15% amber, >15% red.
 * Matches real SCADA alarm levels per ISA-18.2.
 */

import Plot from "react-plotly.js";
import { useWindResourceStore } from "../../store/windResourceStore";
import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { SCADA_COLORS } from "../../constants/scadaColors";

export default function WakeLossPanel() {
  const { wakeAnalysis } = useWindResourceStore();

  if (!wakeAnalysis) return null;

  const losses = wakeAnalysis.per_turbine_wake_loss_percent;
  const labels = losses.map((_, i) => `T${i + 1}`);

  // SCADA color coding per bar
  const colors = losses.map((loss) =>
    loss > 15
      ? SCADA_COLORS.FAULT
      : loss > 10
        ? SCADA_COLORS.WARNING
        : SCADA_COLORS.ENERGIZED,
  );

  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <h3 className="text-sm font-semibold text-slate-300 mb-2">
        Per-Turbine Wake Loss
      </h3>
      <Plot
        data={[
          {
            type: "bar",
            orientation: "h",
            y: labels,
            x: losses,
            marker: { color: colors },
            hovertemplate: "%{y}: %{x:.1f}%<extra></extra>",
          },
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          showlegend: false,
          xaxis: {
            ...DARK_PLOTLY_LAYOUT.xaxis,
            title: { text: "Wake Loss [%]", font: { size: 11 } },
            range: [0, Math.max(...losses) * 1.2],
          },
          yaxis: {
            ...DARK_PLOTLY_LAYOUT.yaxis,
            autorange: "reversed",
            tickfont: { size: 9 },
          },
          margin: { t: 10, r: 20, b: 40, l: 35 },
        }}
        config={PLOTLY_CONFIG}
        useResizeHandler
        className="w-full"
        style={{ height: 350 }}
      />
      <div className="flex gap-4 text-xs text-slate-500 mt-1 justify-center">
        <span>
          <span
            className="inline-block w-2 h-2 rounded-full mr-1"
            style={{ backgroundColor: SCADA_COLORS.ENERGIZED }}
          />
          {"<10%"}
        </span>
        <span>
          <span
            className="inline-block w-2 h-2 rounded-full mr-1"
            style={{ backgroundColor: SCADA_COLORS.WARNING }}
          />
          10-15%
        </span>
        <span>
          <span
            className="inline-block w-2 h-2 rounded-full mr-1"
            style={{ backgroundColor: SCADA_COLORS.FAULT }}
          />
          {">15%"}
        </span>
      </div>
    </div>
  );
}
