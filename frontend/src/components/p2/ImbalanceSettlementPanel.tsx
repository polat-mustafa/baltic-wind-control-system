/**
 * Imbalance Settlement Panel — M11 Market.
 *
 * Surfaces POST /api/v1/grid/market/imbalance, a previously orphaned endpoint.
 * Produces a 24-h forecast vs actual chart and a settlement summary
 * (DA revenue, imbalance cost, net revenue, MAPE, long/short hours).
 *
 * Default actuals are perturbed from the default DA price profile to give the
 * user a realistic "you bid this, you delivered that" simulation out of the box.
 */

import { useState, useCallback, useMemo } from "react";
import Plot from "react-plotly.js";
import { TrendingDown, TrendingUp, AlertTriangle } from "lucide-react";

import { runImbalanceSettlement, DEFAULT_DA_PRICES } from "../../services/marketApi";
import type { ImbalanceResponse } from "../../services/marketApi";
import { Button } from "../ui/Button";

// Default 24-h forecast (typical Baltic Wind shape — light overnight, peaks afternoon)
const DEFAULT_FORECAST_MWH = [
  280, 270, 260, 255, 260, 280, 320, 360,
  400, 430, 450, 460, 455, 440, 420, 400,
  380, 360, 340, 330, 320, 310, 300, 290,
];

// Default actuals: forecast ± realistic 8-10% MAPE noise (deterministic so UAT reproducible)
const DEFAULT_ACTUAL_MWH = DEFAULT_FORECAST_MWH.map((f, i) => {
  const sign = i % 3 === 0 ? -1 : 1;
  const errPct = 0.04 + ((i * 17) % 11) / 100; // 4-14% per hour
  return Math.max(0, Math.round(f * (1 + sign * errPct)));
});

export default function ImbalanceSettlementPanel() {
  const [forecast, setForecast] = useState<number[]>(DEFAULT_FORECAST_MWH);
  const [actual, setActual] = useState<number[]>(DEFAULT_ACTUAL_MWH);
  const [penalty, setPenalty] = useState(1.15);
  const [result, setResult] = useState<ImbalanceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRun = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await runImbalanceSettlement({
        forecast_mwh: forecast,
        actual_mwh: actual,
        da_price_eur_mwh: DEFAULT_DA_PRICES,
        imbalance_penalty_factor: penalty,
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [forecast, actual, penalty]);

  const handleReset = useCallback(() => {
    setForecast(DEFAULT_FORECAST_MWH);
    setActual(DEFAULT_ACTUAL_MWH);
    setPenalty(1.15);
    setResult(null);
    setError(null);
  }, []);

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);

  return (
    <div className="bg-bg-secondary rounded-lg border border-border-primary p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-text-primary">
            Imbalance Settlement (PSE)
          </h3>
          <span className="text-[10px] text-text-muted font-mono uppercase tracking-wide">
            POST /grid/market/imbalance
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-text-secondary">
            Penalty ×
            <input
              type="number"
              min={1}
              max={2}
              step={0.05}
              value={penalty}
              onChange={(e) => setPenalty(Number(e.target.value))}
              className="w-14 bg-bg-tertiary border border-border-primary rounded px-1 py-0.5 text-text-primary text-xs"
            />
          </label>
          <Button variant="ghost" size="sm" onClick={handleReset} disabled={loading}>
            Reset
          </Button>
          <Button size="sm" onClick={handleRun} disabled={loading}>
            {loading ? "Settling…" : "Settle"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-2 bg-status-alarm/10 border border-status-alarm/30 rounded text-xs text-status-alarm flex items-center gap-2">
          <AlertTriangle size={12} /> {error}
        </div>
      )}

      <Plot
        data={[
          {
            x: hours,
            y: forecast,
            type: "bar",
            name: "Forecast (DA bid)",
            marker: { color: "#3b82f6" },
          },
          {
            x: hours,
            y: actual,
            type: "bar",
            name: "Actual",
            marker: { color: "#22c55e" },
          },
        ]}
        layout={{
          autosize: true,
          height: 260,
          margin: { l: 50, r: 30, t: 10, b: 35 },
          paper_bgcolor: "rgba(0,0,0,0)",
          plot_bgcolor: "rgba(0,0,0,0)",
          font: { color: "#cbd5e1", size: 10 },
          xaxis: { title: { text: "Hour" }, dtick: 2 },
          yaxis: { title: { text: "Energy [MWh]" } },
          barmode: "group",
          legend: { orientation: "h", y: -0.2 },
        }}
        config={{ displayModeBar: false, responsive: true }}
        useResizeHandler
        style={{ width: "100%" }}
      />

      {result && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border-primary/40">
          <Stat label="DA revenue" value={`${(result.total_da_revenue_eur / 1000).toFixed(1)} k€`} />
          <Stat
            label="Imbalance cost"
            value={`${(result.total_imbalance_cost_eur / 1000).toFixed(1)} k€`}
            tone="warn"
          />
          <Stat label="Net revenue" value={`${(result.net_revenue_eur / 1000).toFixed(1)} k€`} tone="ok" />
          <Stat label="MAPE" value={`${result.mape_pct.toFixed(1)} %`} />
          <Stat
            label="Long hours"
            value={String(result.long_hours)}
            icon={<TrendingUp size={11} className="text-status-ok" />}
          />
          <Stat
            label="Short hours"
            value={String(result.short_hours)}
            icon={<TrendingDown size={11} className="text-status-alarm" />}
          />
          <Stat label="MAE" value={`${result.mae_mwh.toFixed(1)} MWh`} />
          <div className="col-span-2 sm:col-span-4 mt-1 text-xs text-text-muted italic">
            {result.assessment}
          </div>
        </div>
      )}

      <details className="text-xs text-text-muted">
        <summary className="cursor-pointer hover:text-text-secondary">
          Edit forecast / actual arrays (24 h)
        </summary>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <ArrayEditor label="Forecast [MWh]" values={forecast} onChange={setForecast} />
          <ArrayEditor label="Actual [MWh]" values={actual} onChange={setActual} />
        </div>
      </details>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn";
  icon?: React.ReactNode;
}) {
  const toneCls =
    tone === "ok" ? "text-status-ok" : tone === "warn" ? "text-status-alarm" : "text-text-primary";
  return (
    <div className="bg-bg-tertiary rounded px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wide text-text-muted">{label}</div>
      <div className={`text-sm font-mono flex items-center gap-1 ${toneCls}`}>
        {icon}
        {value}
      </div>
    </div>
  );
}

function ArrayEditor({
  label,
  values,
  onChange,
}: {
  label: string;
  values: number[];
  onChange: (next: number[]) => void;
}) {
  const handle = useCallback(
    (text: string) => {
      const parts = text
        .split(/[\s,]+/)
        .map((s) => Number(s))
        .filter((n) => Number.isFinite(n));
      if (parts.length === 24) onChange(parts);
    },
    [onChange],
  );
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wide text-text-muted block mb-1">
        {label}
      </label>
      <textarea
        defaultValue={values.join(", ")}
        onBlur={(e) => handle(e.target.value)}
        rows={3}
        className="w-full font-mono text-[10px] bg-bg-tertiary border border-border-primary rounded p-1.5 text-text-primary"
      />
    </div>
  );
}
