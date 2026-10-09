/**
 * A real offshore farm going live: Baltic Power, Poland's first, 76 × Vestas V236-15.0 MW —
 * the turbine class SB-510 is modelled on. Daily peak output from ENTSO-E (16.1.A) since
 * first power; peak / 15 MW is a lower bound of the turbines producing.
 */

import { useEffect, useState } from "react";
import Plot from "react-plotly.js";

import { getBalticPowerEnergisation, type BalticPowerEnergisation } from "../../services/commissioningApi";
import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { useChartPalette, withAlpha } from "../../hooks/useChartPalette";
import { ChartWrapper } from "../ui/ChartWrapper";
import { SourceBadge } from "../ui/SourceBadge";

export default function BalticPowerPanel() {
  const pal = useChartPalette();
  const [data, setData] = useState<BalticPowerEnergisation | null>(null);

  useEffect(() => {
    getBalticPowerEnergisation()
      .then(setData)
      .catch(() => setData(null)); // data file not built: the panel stays hidden
  }, []);

  if (!data || data.days.length === 0) return null;
  const last = data.days[data.days.length - 1];
  const best = Math.max(...data.days.map((d) => d.turbines_at_least));
  // one scale for both axes: n turbines at rated = n × 15 MW, so the step line sits on the bars
  const top = Math.ceil(Math.max(...data.days.map((d) => d.peak_mw)) / 75) * 75;

  return (
    <ChartWrapper
      title="Real energisation: Baltic Power, Poland's first offshore wind farm"
      footer={
        <span>
          {data.farm}. First power {data.days[0].date}; by {last.date} at least {best} of 76 turbines have produced
          at once (daily peak ÷ 15 MW). Each step up is a string energised and its turbines commissioned — the
          real-world version of a switching programme.{" "}
          <SourceBadge p={{ source: data.source, license: "ENTSO-E terms of use", quality: "measured" }} />
        </span>
      }
    >
      <div style={{ height: 300 }}>
        <Plot
          data={[
            {
              x: data.days.map((d) => d.date),
              y: data.days.map((d) => d.peak_mw),
              type: "bar",
              name: "Daily peak [MW]",
              marker: { color: withAlpha(pal.blue, 0.75) },
              hovertemplate: "%{x}: %{y:.0f} MW<extra></extra>",
            },
            {
              x: data.days.map((d) => d.date),
              y: data.days.map((d) => d.turbines_at_least),
              type: "scatter",
              mode: "lines",
              name: "Turbines producing (≥)",
              yaxis: "y2",
              line: { color: pal.orange, width: 2, shape: "hv" },
              hovertemplate: "≥ %{y} turbines<extra></extra>",
            },
          ]}
          layout={{
            ...DARK_PLOTLY_LAYOUT,
            title: undefined,
            xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, domain: [0, 0.92] },
            yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: "Daily peak [MW]", range: [0, top] },
            yaxis2: {
              title: { text: "Turbines at 15 MW (of 76)" },
              overlaying: "y",
              side: "right",
              gridcolor: "transparent",
              range: [0, top / 15],
              dtick: 5,
            },
            legend: { ...DARK_PLOTLY_LAYOUT.legend, orientation: "h", x: 0, y: 1.15 },
            bargap: 0.15,
          }}
          config={PLOTLY_CONFIG}
          className="h-full w-full"
          useResizeHandler
        />
      </div>
    </ChartWrapper>
  );
}
