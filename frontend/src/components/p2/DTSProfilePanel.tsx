/**
 * DTS profile — fibre reading and conductor estimate along the 108 km route,
 * zone bands, the 80 °C alarm setting and the 90 °C XLPE limit; zone table.
 */

import Plot from "react-plotly.js";

import { cableDtsEducation } from "../../constants/education/p2";
import { DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { CHART_TRANSITION, useChartPalette } from "../../hooks/useChartPalette";
import { useCableDTSStore } from "../../store/cableDtsStore";
import { ChartWrapper } from "../ui/ChartWrapper";
import { EducationButton } from "../ui/EducationButton";

export default function DTSProfilePanel() {
  const { profile: p } = useCableDTSStore();
  const c = useChartPalette();
  if (!p) return null;

  const km = p.profile.map((x) => x.distance_km);
  const hot = p.profile.find((x) => x.distance_km === p.max_location_km);
  const yMax = Math.max(95, p.max_conductor_c + 8);
  const yMin = Math.max(0, p.ambient_temp_c - 5);
  const limitLine = (y: number, color: string, dash: "dash" | "dot") =>
    ({ type: "line", xref: "paper", x0: 0, x1: 1, y0: y, y1: y, line: { color, width: 1, dash } }) as const;

  return (
    <ChartWrapper
      title={`Temperature along one circuit at ${p.current_a} A, ${p.ambient_temp_c} °C ambient`}
      headerRight={<EducationButton content={cableDtsEducation} />}
      footer={`${p.assessment}. DTS reads the fibre; the conductor is the fibre plus (W_c + ½W_d)·T_int. Losses per core at the hottest spot: Joule ${p.joule_loss_w_per_m.toFixed(1)} W/m, dielectric ${p.dielectric_loss_w_per_m.toFixed(2)} W/m. Zone thermal resistances are calibrated to the 825 A datasheet rating at 20 °C, not surveyed.`}
    >
      <Plot
        data={[
          {
            type: "scatter",
            mode: "lines",
            name: "Fibre (DTS reading)",
            x: km,
            y: p.profile.map((x) => x.fibre_temp_c),
            line: { color: c.ref, width: 1.5 },
            hovertemplate: "%{x:.1f} km: fibre %{y:.1f} °C<extra></extra>",
          },
          {
            type: "scatter",
            mode: "lines",
            name: "Conductor (estimate)",
            x: km,
            y: p.profile.map((x) => x.conductor_temp_c),
            line: { color: c.blue, width: 2 },
            customdata: p.profile.map((x) => x.zone),
            hovertemplate: "%{x:.1f} km, %{customdata}: conductor %{y:.1f} °C<extra></extra>",
          },
          {
            type: "scatter",
            mode: "markers",
            name: "Hottest",
            showlegend: false,
            x: [p.max_location_km],
            y: [p.max_conductor_c],
            marker: { color: c.blue, size: 9, line: { color: c.ink, width: 1.5 } },
            hovertemplate: `hottest %{y:.1f} °C, ${hot?.zone ?? ""}<extra></extra>`,
          },
        ]}
        layout={{
          ...DARK_PLOTLY_LAYOUT,
          transition: CHART_TRANSITION,
          legend: { orientation: "h", y: 1.12, x: 0, font: { size: 11 } },
          margin: { t: 40, r: 12, b: 44, l: 56 },
          xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, title: { text: "Distance from the OSS [km]", font: { size: 12 } }, range: [0, p.cable_length_km], dtick: 5 },
          yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: { text: "Temperature [°C]", font: { size: 12 } }, range: [yMin, yMax] },
          shapes: [
            ...p.zones
              .filter((_, i) => i % 2 === 0)
              .map((z) => ({ type: "rect", xref: "x", yref: "paper", x0: z.start_km, x1: Math.max(z.end_km, z.start_km + 0.4), y0: 0, y1: 1, fillcolor: c.band, line: { width: 0 }, layer: "below" }) as const),
            limitLine(90, c.red, "dash"),
            limitLine(80, c.yellow, "dot"),
          ],
          annotations: [
            ...p.zones.map((z) => ({
              x: z.name === "OSS J-tube" ? 0.4 : (z.start_km + z.end_km) / 2,
              y: 0,
              yref: "paper" as const,
              yanchor: "bottom" as const,
              xanchor: z.name === "OSS J-tube" ? ("left" as const) : ("center" as const),
              text: z.name === "OSS J-tube" ? "← J-tube" : z.name === "HDD landfall" ? "HDD" : z.name,
              showarrow: false,
              font: { size: 10, color: c.ref },
            })),
            { x: p.cable_length_km, y: 90, xanchor: "right", yanchor: "bottom", text: "90 °C XLPE limit", showarrow: false, font: { size: 10, color: c.ref } },
            { x: p.cable_length_km, y: 80, xanchor: "right", yanchor: "bottom", text: "80 °C alarm (setting)", showarrow: false, font: { size: 10, color: c.ref } },
          ],
        }}
        config={PLOTLY_CONFIG}
        useResizeHandler
        className="w-full"
        style={{ height: 300 }}
      />
      <div className="overflow-x-auto mt-2">
        <table className="w-full text-xs">
          <thead className="text-text-muted">
            <tr className="text-left">
              <th className="font-medium py-1">Zone</th>
              <th className="font-medium">km</th>
              <th className="font-medium text-right">R_ext [K·m/W]</th>
              <th className="font-medium text-right">Fibre max</th>
              <th className="font-medium text-right">Conductor max</th>
              <th className="font-medium text-right">Rating here</th>
            </tr>
          </thead>
          <tbody className="font-mono text-text-primary">
            {p.zones.map((z) => (
              <tr key={z.name} className="border-t border-border-primary/40">
                <td className="py-1 font-sans text-text-secondary">{z.name}</td>
                <td>
                  {z.start_km}–{z.end_km}
                </td>
                <td className="text-right">{z.r_ext_k_m_per_w.toFixed(2)}</td>
                <td className="text-right">{z.max_fibre_c.toFixed(1)} °C</td>
                <td className="text-right">
                  {z.max_conductor_c.toFixed(1)} °C {z.max_conductor_c < 90 ? "✓" : "✗"}
                </td>
                <td className="text-right">
                  {z.rating_a.toFixed(0)} A{z.name === p.limiting_zone ? " ◂ limit" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartWrapper>
  );
}
