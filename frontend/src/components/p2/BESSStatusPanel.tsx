/**
 * BESS Status Panel — M08.
 *
 * Plotly gauge for SOC% + KPI badges: power mode, temperature, SoH, cycle count.
 * 50 MW / 200 MWh LFP — SOC window 10-90%, 3000 cycles to 80% SoH.
 */

import Plot from "react-plotly.js";
import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { useBESSStore } from "../../store/bessStore";

const MODE_COLOR: Record<string, string> = {
  STANDBY: "#9ba3b8",
  CHARGE: "#60a5fa",
  DISCHARGE: "#3ecf6e",
  FREQUENCY_RESPONSE: "#f59e0b",
  RAMP_SMOOTHING: "#a78bfa",
  ARBITRAGE: "#fb923c",
  TEST: "#f87171",
};

export default function BESSStatusPanel() {
  const { status } = useBESSStore();

  if (!status) return null;

  const socColor =
    status.soc_percent < 15 ? "#ef4444"
    : status.soc_percent > 85 ? "#f59e0b"
    : "#3ecf6e";

  return (
    <div className="bg-bg-secondary rounded-lg border border-border-primary p-3">
      <h3 className="text-sm font-semibold text-text-primary mb-3">BESS Status</h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-center">
        {/* SOC gauge */}
        <Plot
          data={[
            {
              type: "indicator",
              mode: "gauge+number",
              value: status.soc_percent,
              number: { suffix: "%", font: { size: 28, color: socColor } },
              gauge: {
                axis: { range: [0, 100], tickfont: { size: 10, color: "#9ba3b8" } },
                bar: { color: socColor, thickness: 0.25 },
                bgcolor: "#0f1117",
                bordercolor: "#2a3040",
                steps: [
                  { range: [0, 10], color: "#ef4444" },
                  { range: [10, 90], color: "#1e2536" },
                  { range: [90, 100], color: "#f59e0b" },
                ],
                threshold: {
                  line: { color: "#ffffff", width: 2 },
                  thickness: 0.75,
                  value: status.soc_percent,
                },
              },
            },
          ]}
          layout={{
            ...DARK_PLOTLY_LAYOUT,
            height: 180,
            margin: { t: 20, r: 20, b: 20, l: 20 },
            annotations: [{ text: "State of Charge", x: 0.5, y: 0.08, showarrow: false, font: { size: 11, color: "#9ba3b8" }, xanchor: "center" }],
          }}
          config={{ ...PLOTLY_CONFIG, displayModeBar: false }}
          className="w-full"
        />

        {/* KPI badges */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-bg-tertiary rounded p-2">
            <p className="text-text-muted mb-0.5">Mode</p>
            <span className="px-2 py-0.5 rounded font-mono text-xs font-semibold" style={{ backgroundColor: `${MODE_COLOR[status.mode] ?? "#9ba3b8"}20`, color: MODE_COLOR[status.mode] ?? "#9ba3b8" }}>
              {status.mode}
            </span>
          </div>
          <div className="bg-bg-tertiary rounded p-2">
            <p className="text-text-muted mb-0.5">Power</p>
            <p className="font-mono font-bold text-text-primary">
              {status.power_mw > 0 ? "+" : ""}{status.power_mw.toFixed(1)} <span className="text-text-muted font-normal">MW</span>
            </p>
          </div>
          <div className="bg-bg-tertiary rounded p-2">
            <p className="text-text-muted mb-0.5">Temperature</p>
            <p className={`font-mono font-bold ${status.temperature_c > 40 ? "text-status-alarm" : "text-text-primary"}`}>
              {status.temperature_c.toFixed(1)} <span className="text-text-muted font-normal">°C</span>
            </p>
          </div>
          <div className="bg-bg-tertiary rounded p-2">
            <p className="text-text-muted mb-0.5">SoH</p>
            <p className={`font-mono font-bold ${status.soh_percent < 85 ? "text-status-warning" : "text-status-success"}`}>
              {status.soh_percent.toFixed(1)} <span className="text-text-muted font-normal">%</span>
            </p>
          </div>
          <div className="bg-bg-tertiary rounded p-2">
            <p className="text-text-muted mb-0.5">Cycles</p>
            <p className="font-mono font-bold text-text-primary">
              {status.cycle_count} <span className="text-text-muted font-normal">/ 3000</span>
            </p>
          </div>
          <div className="bg-bg-tertiary rounded p-2">
            <p className="text-text-muted mb-0.5">Available energy</p>
            <p className="font-mono font-bold text-text-primary">
              {status.available_energy_mwh.toFixed(1)} <span className="text-text-muted font-normal">MWh</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
