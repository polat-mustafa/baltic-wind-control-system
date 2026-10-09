/**
 * Real data — the forecasting method on measured Baltic offshore production.
 *
 * The other Forecast tabs train on synthetic SCADA (SB-510 is a case study, not a
 * built farm). This tab answers "does it work on real data?": hourly output of the
 * Danish Baltic farms in DK2 (Kriegers Flak, Rødsand II, Nysted — 977 MW, Energinet)
 * forecast day-ahead from the wind the ECMWF / ICON runs of the day before predicted.
 * Scored with TimeSeriesSplit against persistence, climatology and a physics-only
 * NWP power curve.
 */

import { useEffect, useState } from "react";
import Plot from "react-plotly.js";

import { getRealDayAhead, getRealSites, type RealForecastResponse, type RealSite } from "../../services/forecastApi";
import { CHART_HEIGHT, DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { useChartPalette, withAlpha } from "../../hooks/useChartPalette";
import { ChartWrapper } from "../ui/ChartWrapper";
import { InfoTile } from "../ui/InfoTile";
import { SourceBadge } from "../ui/SourceBadge";

export default function RealDataPanel() {
  const pal = useChartPalette();
  const [data, setData] = useState<RealForecastResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [site, setSite] = useState("dk2");
  const [sites, setSites] = useState<RealSite[]>([]);

  useEffect(() => {
    getRealSites().then(setSites).catch(() => setSites([]));
  }, []);
  useEffect(() => {
    setData(null);
    getRealDayAhead(site)
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [site]);

  if (error) return <p className="text-sm text-status-alarm">Real-data forecast failed: {error}</p>;
  if (!data)
    return (
      <p className="text-sm text-text-muted">
        Training XGBoost on 20 000 real hours (5 time-ordered folds) — up to a minute the first time, then cached…
      </p>
    );

  const { source, scores, series } = data;
  const xgb = scores[0];
  const pers = scores.find((s) => s.name.startsWith("Persistence"));
  const coverageOk = Math.abs(data.p10_p90_coverage_pct - 80) <= 5;

  return (
    <div className="space-y-4">
      {sites.length > 1 && (
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          Real series
          <select
            value={site}
            onChange={(e) => setSite(e.target.value)}
            className="rounded-md border border-border-secondary bg-bg-tertiary px-2 py-1 text-sm text-text-primary"
          >
            {sites.map((x) => (
              <option key={x.key} value={x.key}>
                {x.title} — {x.capacity_mw.toFixed(0)} MW
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="rounded-lg border border-border-primary bg-bg-secondary p-4 text-sm text-text-secondary">
        <p className="text-text-primary">
          Day-ahead forecast of <b>measured</b> Baltic offshore production — {source.farms.join(", ")} ={" "}
          {source.capacity_mw.toFixed(0)} MW, {source.hours.toLocaleString("en")} hours{" "}
          {source.period_start_utc.slice(0, 10)} → {source.period_end_utc.slice(0, 10)}.
        </p>
        <p className="mt-1">
          Inputs: only the 100 m wind the ECMWF and ICON runs of the previous day predicted (what a bid at 12:00 D−1
          can know). Validation: {source.folds} time-ordered folds, never shuffled. These farms are not SB-510; the
          same pipeline would run on SB-510 SCADA once it exists.
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <SourceBadge p={{ source: source.production, license: "CC BY 4.0", quality: "measured" }} />
          <SourceBadge p={{ source: source.nwp, license: "CC BY 4.0", quality: "official" }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <InfoTile label="XGBoost nRMSE" value={xgb.nrmse_pct.toFixed(1)} unit="% of capacity" subtitle="day-ahead offshore: 10–20 %" />
        <InfoTile label="Skill vs persistence" value={xgb.skill_vs_persistence.toFixed(2)} subtitle={`persistence nRMSE ${pers?.nrmse_pct.toFixed(1)} %`} />
        <InfoTile
          label="P10–P90 coverage"
          value={data.p10_p90_coverage_pct.toFixed(0)}
          unit="%"
          priority={coverageOk ? "normal" : "warning"}
          subtitle={coverageOk ? "ideal 80 % · conformal band" : "ideal 80 % — band miscalibrated"}
        />
        <InfoTile label="Bias" value={(xgb.bias_pct ?? 0).toFixed(1)} unit="% of capacity" subtitle="mean(forecast − actual)" />
      </div>

      <ChartWrapper title="Last 14 days of the last test fold — actual vs forecast">
        <div style={{ height: CHART_HEIGHT }}>
          <Plot
            data={[
              { x: series.time_utc, y: series.p90_mw, type: "scatter", mode: "lines", line: { width: 0 }, showlegend: false, hoverinfo: "skip" },
              {
                x: series.time_utc,
                y: series.p10_mw,
                type: "scatter",
                mode: "lines",
                line: { width: 0 },
                fill: "tonexty",
                fillcolor: withAlpha(pal.blue, 0.18),
                name: "P10–P90",
                hoverinfo: "skip",
              },
              { x: series.time_utc, y: series.p50_mw, type: "scatter", mode: "lines", name: "Forecast P50", line: { color: pal.blue, width: 2 } },
              { x: series.time_utc, y: series.actual_mw, type: "scatter", mode: "lines", name: "Measured", line: { color: pal.ink, width: 1.5 } },
              {
                x: series.time_utc,
                y: series.persistence_mw,
                type: "scatter",
                mode: "lines",
                name: "Persistence 24 h",
                line: { color: pal.orange, width: 1, dash: "dot" },
              },
            ]}
            layout={{
              ...DARK_PLOTLY_LAYOUT,
              title: undefined,
              yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: "Power [MW]", range: [0, source.capacity_mw] },
              xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, title: "UTC" },
              legend: { ...DARK_PLOTLY_LAYOUT.legend, orientation: "h", x: 0, y: 1.12 },
            }}
            config={PLOTLY_CONFIG}
            className="h-full w-full"
            useResizeHandler
          />
        </div>
      </ChartWrapper>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="overflow-x-auto rounded-lg border border-border-primary bg-bg-secondary p-4">
          <h3 className="mb-2 text-base font-semibold text-text-primary">Scores over all test folds</h3>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-text-muted">
              <tr>
                <th className="py-1 pr-3 font-medium">Forecast</th>
                <th className="py-1 pr-3 text-right font-medium">nRMSE %</th>
                <th className="py-1 pr-3 text-right font-medium">nMAE %</th>
                <th className="py-1 pr-3 text-right font-medium">Skill</th>
                <th className="py-1 text-right font-medium">nRMSE per fold %</th>
              </tr>
            </thead>
            <tbody className="font-mono text-text-primary">
              {scores.map((s) => (
                <tr key={s.name} className="border-t border-border-primary">
                  <td className="py-1 pr-3 font-sans">{s.name}</td>
                  <td className="py-1 pr-3 text-right">{s.nrmse_pct.toFixed(1)}</td>
                  <td className="py-1 pr-3 text-right">{s.nmae_pct.toFixed(1)}</td>
                  <td className="py-1 pr-3 text-right">{s.skill_vs_persistence.toFixed(2)}</td>
                  <td className="py-1 text-right text-text-secondary">{s.fold_nrmse_pct.map((v) => v.toFixed(0)).join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-text-muted">
            The NWP power curve is physics only (mean power per 1 m/s bin of the forecast wind). XGBoost adds the
            direction, the two sites, the hour and the ECMWF–ICON disagreement — a small gain: most day-ahead error is
            the weather forecast itself. LSTM and TFT read the last 24 h of NWP rows; they are trained offline on the
            same folds (early stopping on the newest 20 % of each training block).
          </p>
        </div>
        <div className="rounded-lg border border-border-primary bg-bg-secondary p-4">
          <h3 className="mb-2 text-base font-semibold text-text-primary">What the model uses</h3>
          <ul className="space-y-1 text-sm">
            {data.feature_importance.map((f) => (
              <li key={f.feature} className="flex items-center gap-2">
                <span className="w-36 truncate font-mono text-xs text-text-secondary">{f.feature}</span>
                <span className="h-2 rounded-sm bg-accent" style={{ width: `${Math.round(f.gain_share * 300)}px` }} />
                <span className="font-mono text-xs text-text-muted">{(f.gain_share * 100).toFixed(0)} %</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-text-muted">Share of XGBoost gain. kf = Kriegers Flak, rs = Rødsand.</p>
        </div>
      </div>
    </div>
  );
}
