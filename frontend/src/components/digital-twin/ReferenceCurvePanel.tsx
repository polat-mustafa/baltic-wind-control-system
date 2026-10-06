/**
 * The twin's steady state vs wind speed: power (with the P1 V236 table for
 * validation), rotor speed and pitch — three stacked axes, no dual axis.
 */

import Plot from "react-plotly.js";

import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { useChartPalette } from "../../hooks/useChartPalette";
import { useDigitalTwinStore } from "../../store/digitalTwinStore";
import { ChartWrapper } from "../ui/ChartWrapper";

export default function ReferenceCurvePanel() {
  const rc = useDigitalTwinStore((s) => s.referenceCurve);
  const c = useChartPalette();
  if (!rc) return null;

  const axis = (title: string, domain: [number, number]) => ({
    ...DARK_PLOTLY_LAYOUT.yaxis,
    domain,
    title: { text: title, font: { size: 11 } },
    tickfont: { ...DARK_PLOTLY_LAYOUT.yaxis.tickfont, size: 10 },
  });

  return (
    <ChartWrapper
      title="Reference model — steady state at ρ = 1.225 kg/m³"
      footer={`Heier Cp(λ, β) × k_aero, K·ω² torque law, 4.0–8.33 rpm, pitch regulation. Max |ΔP| vs the legacy V236 table: ${rc.max_deviation_vs_p1_mw.toFixed(2)} MW (below 6 m/s, where ω_min forces λ > λ_opt); ${rc.max_deviation_vs_p1_above_6ms_mw.toFixed(2)} MW from 6 m/s up.`}
    >
      <Plot
        data={[
          {
            x: rc.wind_ms,
            y: rc.power_mw,
            type: "scatter",
            mode: "lines",
            name: "Twin power",
            line: { color: c.blue, width: 2.2 },
            hovertemplate: "%{x:.2f} m/s · %{y:.2f} MW<extra>twin</extra>",
          },
          {
            x: rc.wind_ms,
            y: rc.p1_table_power_mw,
            type: "scatter",
            mode: "lines",
            name: "Legacy V236 table",
            line: { color: c.orange, width: 1.5, dash: "dot" },
            hovertemplate: "%{x:.2f} m/s · %{y:.2f} MW<extra>Legacy V236 table</extra>",
          },
          {
            x: rc.wind_ms,
            y: rc.rotor_speed_rpm,
            type: "scatter",
            mode: "lines",
            name: "Rotor speed",
            line: { color: c.aqua, width: 2 },
            yaxis: "y2",
            hovertemplate: "%{x:.2f} m/s · %{y:.2f} rpm<extra></extra>",
          },
          {
            x: rc.wind_ms,
            y: rc.pitch_deg.map((p, i) => (rc.region[i] === 0 ? null : p)),
            type: "scatter",
            mode: "lines",
            name: "Pitch",
            line: { color: c.yellow, width: 2 },
            yaxis: "y3",
            hovertemplate: "%{x:.2f} m/s · %{y:.1f}°<extra></extra>",
          },
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          height: 560,
          margin: { t: 30, r: 16, b: 48, l: 60 },
          hovermode: "x unified",
          legend: { ...DARK_PLOTLY_LAYOUT.legend, orientation: "h", x: 0, y: 1.06 },
          xaxis: {
            ...DARK_PLOTLY_LAYOUT.xaxis,
            title: { text: "Wind speed at hub [m/s]", font: { size: 12 } },
            range: [0, 32],
            anchor: "y3",
          },
          yaxis: axis("P [MW]", [0.56, 1]),
          yaxis2: axis("ω [rpm]", [0.3, 0.52]),
          yaxis3: axis("β [°]", [0, 0.26]),
        }}
        config={PLOTLY_CONFIG}
        useResizeHandler
        className="w-full"
        style={{ height: 560 }}
      />
    </ChartWrapper>
  );
}
