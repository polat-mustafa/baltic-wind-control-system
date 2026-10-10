/**
 * Day-ahead forecast of measured Baltic offshore production — the whole P4 result.
 *
 * Hourly output of the Danish Baltic farms in DK2 (Kriegers Flak, Rødsand II, Nysted —
 * 977 MW, Energinet) or one farm (ENTSO-E), forecast day-ahead from the wind the ECMWF /
 * ICON runs of the day before predicted. Every forecast is scored on the same test hours
 * (TimeSeriesSplit): nRMSE, skill vs persistence and climatology, CRPS, reliability.
 */

import { useEffect, useState } from "react";
import Plot from "react-plotly.js";

import { getRealDayAhead, getRealSites, type RealForecastResponse, type RealSite } from "../../services/forecastApi";
import { useForecastStore } from "../../store/forecastStore";
import { CHART_HEIGHT, DARK_PLOTLY_LAYOUT, PLOTLY_CONFIG } from "../../constants/plotlyDefaults";
import { useChartPalette, withAlpha } from "../../hooks/useChartPalette";
import { ChartWrapper } from "../ui/ChartWrapper";
import { InfoTile } from "../ui/InfoTile";
import { SourceBadge } from "../ui/SourceBadge";

const TAUS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];

export default function RealDataPanel() {
  const pal = useChartPalette();
  const setReal = useForecastStore((s) => s.setReal);
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
      .then((r) => {
        setData(r);
        setReal(r);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [site, setReal]);

  if (error) return <p className="text-sm text-status-alarm">Real-data forecast failed: {error}</p>;
  if (!data)
    return (
      <p className="text-sm text-text-muted">
        Training XGBoost on 20 000 real hours (5 time-ordered folds) — one to two minutes the first time, then cached…
      </p>
    );

  const { source, scores, series } = data;
  const byName = Object.fromEntries(scores.map((s) => [s.name, s]));
  const xgb = scores[0];
  const tso = byName["Energinet day-ahead (TSO)"];
  const best = scores.reduce((a, b) => (b.nrmse_pct < a.nrmse_pct ? b : a));
  const coverageOk = Math.abs(data.p10_p90_coverage_pct - 80) <= 5;
  const relColor: Record<string, string> = { "XGBoost (P50)": pal.blue, "TFT (P50)": pal.aqua, Climatology: pal.yellow };

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
          can know). Validation: {source.folds} time-ordered folds, never shuffled; every forecast is scored on the same{" "}
          {source.scored_hours.toLocaleString("en")} test hours. These farms are not SB-510; the same pipeline would run
          on SB-510 metering once it exists.
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <SourceBadge p={{ source: source.production, license: "CC BY 4.0", quality: "measured" }} />
          <SourceBadge p={{ source: source.nwp, license: "CC BY 4.0", quality: "official" }} />
          {tso && (
            <SourceBadge
              p={{ source: "Energinet Energi Data Service — Forecasts_Hour, DK2 Offshore Wind, ForecastDayAhead", license: "CC BY 4.0", quality: "official" }}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <InfoTile
          label="XGBoost nRMSE"
          value={xgb.nrmse_pct.toFixed(1)}
          unit="% of capacity"
          subtitle={tso ? `TSO day-ahead ${tso.nrmse_pct.toFixed(1)} % · best: ${best.name}` : `best: ${best.name}`}
        />
        <InfoTile label="CRPS" value={xgb.crps_pct.toFixed(1)} unit="% of capacity" subtitle={`skill vs climatology ${xgb.crpss_vs_climatology.toFixed(2)}`} />
        <InfoTile
          label="P10–P90 coverage"
          value={data.p10_p90_coverage_pct.toFixed(0)}
          unit="%"
          priority={coverageOk ? "normal" : "warning"}
          subtitle={coverageOk ? "ideal 80 % · conformal band" : "ideal 80 % — band miscalibrated"}
        />
        <InfoTile label="Skill vs persistence" value={xgb.skill_vs_persistence.toFixed(2)} subtitle={`vs climatology ${xgb.skill_vs_climatology.toFixed(2)} · bias ${xgb.bias_pct.toFixed(1)} %`} />
      </div>

      <ChartWrapper title="Last 14 days of the last test fold — measured vs forecast (UTC)">
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
                name: "XGBoost P10–P90",
                hoverinfo: "skip",
              },
              { x: series.time_utc, y: series.p50_mw, type: "scatter", mode: "lines", name: "XGBoost P50", line: { color: pal.blue, width: 2 } },
              ...(series.ensemble_mw
                ? [{ x: series.time_utc, y: series.ensemble_mw, type: "scatter" as const, mode: "lines" as const, name: "Ensemble", line: { color: pal.yellow, width: 1.5 } }]
                : []),
              ...(series.tso_mw
                ? [{ x: series.time_utc, y: series.tso_mw, type: "scatter" as const, mode: "lines" as const, name: "TSO day-ahead", line: { color: pal.aqua, width: 1.5, dash: "dash" as const } }]
                : []),
              { x: series.time_utc, y: series.actual_mw, type: "scatter", mode: "lines", name: "Measured", line: { color: pal.ink, width: 1.5 } },
              {
                x: series.time_utc,
                y: series.persistence_mw,
                type: "scatter",
                mode: "lines",
                name: "Persistence 24 h",
                visible: "legendonly",
                line: { color: pal.orange, width: 1, dash: "dot" },
              },
            ]}
            layout={{
              ...DARK_PLOTLY_LAYOUT,
              title: undefined,
              hovermode: "x unified",
              yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: "Power [MW]", range: [0, source.capacity_mw] },
              xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis },
              legend: { ...DARK_PLOTLY_LAYOUT.legend, orientation: "h", x: 0, y: -0.2, yanchor: "top" },
              margin: { ...DARK_PLOTLY_LAYOUT.margin, b: 90 },
            }}
            config={PLOTLY_CONFIG}
            className="h-full w-full"
            useResizeHandler
          />
        </div>
      </ChartWrapper>

      <div className="overflow-x-auto rounded-lg border border-border-primary bg-bg-secondary p-4">
        <h3 className="mb-2 text-base font-semibold text-text-primary">Scores on the same {source.scored_hours.toLocaleString("en")} test hours</h3>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-text-muted">
            <tr>
              <th className="py-1 pr-3 font-medium">Forecast</th>
              <th className="py-1 pr-3 text-right font-medium">nRMSE %</th>
              <th className="py-1 pr-3 text-right font-medium">nMAE %</th>
              <th className="py-1 pr-3 text-right font-medium">Bias %</th>
              <th className="py-1 pr-3 text-right font-medium">Skill vs pers.</th>
              <th className="py-1 pr-3 text-right font-medium">Skill vs clim.</th>
              <th className="py-1 pr-3 text-right font-medium">CRPS %</th>
              <th className="py-1 pr-3 text-right font-medium">CRPSS</th>
              <th className="py-1 text-right font-medium">nRMSE per fold %</th>
            </tr>
          </thead>
          <tbody className="font-mono text-text-primary">
            {scores.map((s) => (
              <tr key={s.name} className="border-t border-border-primary">
                <td className="py-1 pr-3 font-sans">
                  {s.name}
                  {s.probabilistic && <span className="ml-1 text-xs text-text-muted">P10…P90</span>}
                </td>
                <td className="py-1 pr-3 text-right">{s.nrmse_pct.toFixed(1)}</td>
                <td className="py-1 pr-3 text-right">{s.nmae_pct.toFixed(1)}</td>
                <td className="py-1 pr-3 text-right">{s.bias_pct.toFixed(1)}</td>
                <td className="py-1 pr-3 text-right">{s.skill_vs_persistence.toFixed(2)}</td>
                <td className="py-1 pr-3 text-right">{s.skill_vs_climatology.toFixed(2)}</td>
                <td className="py-1 pr-3 text-right">{s.crps_pct.toFixed(1)}</td>
                <td className="py-1 pr-3 text-right">{s.crpss_vs_climatology.toFixed(2)}</td>
                <td className="py-1 text-right text-text-secondary">{s.fold_nrmse_pct.map((v) => v.toFixed(0)).join(" · ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-text-muted">
          Skill = 1 − MSE / MSE(reference). CRPS ≈ (2/9)·Σ pinball loss over P10…P90 (Gneiting &amp; Raftery 2007); for a
          point forecast it equals the MAE, so point and band forecasts compare on one scale. CRPSS uses the climatological
          quantiles of each training block. The NWP power curve is physics only (mean power per 1 m/s bin of the forecast
          wind). The ensemble weights XGBoost, LSTM and TFT by 1/MSE on the earlier test folds only. Energinet's own
          day-ahead forecast covers a wider set of DK2 offshore farms and is issued ~17:50 D−1 (after the bid gate); it is
          rescaled on each training block to the three metered farms. LSTM and TFT read the last 24 h of NWP rows and are
          trained offline on the same folds.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <ChartWrapper title="Reliability — share of hours below each quantile">
          <div style={{ height: CHART_HEIGHT }}>
            <Plot
              data={[
                {
                  x: [0, 1],
                  y: [0, 1],
                  type: "scatter",
                  mode: "lines",
                  name: "Perfect calibration",
                  line: { color: pal.ref, width: 1, dash: "dash" },
                  hoverinfo: "skip",
                },
                ...data.reliability.map((r) => ({
                  x: TAUS,
                  y: r.observed_below,
                  type: "scatter" as const,
                  mode: "lines+markers" as const,
                  name: `${r.name.replace(" (P50)", "")} (P10–P90 holds ${r.p10_p90_coverage_pct.toFixed(0)} %)`,
                  line: { color: relColor[r.name] ?? pal.orange, width: 2 },
                  marker: { size: 8 },
                  hovertemplate: "P%{x:.0%}: %{y:.1%} of hours below<extra>%{fullData.name}</extra>",
                })),
              ]}
              layout={{
                ...DARK_PLOTLY_LAYOUT,
                title: undefined,
                xaxis: { ...DARK_PLOTLY_LAYOUT.xaxis, title: "Quantile τ (nominal)", range: [0, 1], tickformat: ".0%" },
                yaxis: { ...DARK_PLOTLY_LAYOUT.yaxis, title: "Observed share below", range: [0, 1], tickformat: ".0%" },
                legend: { ...DARK_PLOTLY_LAYOUT.legend, orientation: "h", x: 0, y: -0.15, yanchor: "top" },
                margin: { ...DARK_PLOTLY_LAYOUT.margin, b: 110 },
              }}
              config={PLOTLY_CONFIG}
              className="h-full w-full"
              useResizeHandler
            />
          </div>
        </ChartWrapper>
        <div className="rounded-lg border border-border-primary bg-bg-secondary p-4">
          <h3 className="mb-2 text-base font-semibold text-text-primary">What XGBoost uses</h3>
          <ul className="space-y-1 text-sm">
            {data.feature_importance.map((f) => (
              <li key={f.feature} className="flex items-center gap-2">
                <span className="w-36 truncate font-mono text-xs text-text-secondary">{f.feature}</span>
                <span className="h-2 rounded-sm bg-accent" style={{ width: `${Math.round(f.shap_share * 300)}px` }} />
                <span className="font-mono text-xs text-text-muted">{(f.shap_share * 100).toFixed(0)} %</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-text-muted">
            Share of mean |SHAP| of the P50 over all test hours (TreeSHAP). kf = Kriegers Flak, rs = Rødsand. A
            calibrated band follows the dashed line: 10 % of hours below P10, 90 % below P90.
          </p>
        </div>
      </div>
    </div>
  );
}
