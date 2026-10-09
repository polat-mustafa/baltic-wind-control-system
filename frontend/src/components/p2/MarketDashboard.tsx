/**
 * Market tab — one trading day of the 510 MW farm: TGE day-ahead, PSE
 * imbalance at CEN, two-sided CfD and BESS arbitrage. Money in PLN.
 *
 *   controls · KPIs
 *   prices
 *   energy
 *   settlement | BESS
 */

import { useEffect } from "react";
import { motion, MotionConfig } from "framer-motion";

import { marketEducation } from "../../constants/education/p2";
import { useMarketStore } from "../../store/marketStore";
import type { MarketScenario } from "../../types/market";
import { EducationButton } from "../ui/EducationButton";
import { KPICard } from "../ui/KPICard";
import { Slider } from "../ui/Slider";
import MarketBessPanel from "./MarketBessPanel";
import MarketEnergyPanel from "./MarketEnergyPanel";
import MarketPricePanel from "./MarketPricePanel";
import MarketSettlementPanel from "./MarketSettlementPanel";

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } },
};

const SCENARIOS: [string, MarketScenario][] = [
  ["Windy spring Sunday", "windy_spring_sunday"],
  ["Winter weekday", "winter_weekday"],
  ["Calm summer day", "calm_summer_day"],
];

const kPln = (v: number) => `${v >= 0 ? "" : "−"}${Math.abs(v / 1000).toFixed(0)}`;

export default function MarketDashboard() {
  const { day: d, scenario, strike_pln_mwh, forecast_sigma_ms, include_cfd, include_bess, error, setParams, run, clearError } =
    useMarketStore();

  useEffect(() => {
    const id = setTimeout(() => void run(), 250);
    return () => clearTimeout(id);
  }, [scenario, strike_pln_mwh, forecast_sigma_ms, include_cfd, include_bess, run]);

  const toggle = (label: string, on: boolean, key: "include_cfd" | "include_bess") => (
    <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
      <input type="checkbox" checked={on} onChange={(e) => setParams({ [key]: e.target.checked })} className="accent-accent" />
      {label}
    </label>
  );

  return (
    <MotionConfig reducedMotion="user">
      <motion.div className="space-y-4" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.08 } } }}>
        {error && (
          <div className="p-3 bg-status-alarm/10 border border-status-alarm/30 rounded-lg text-sm flex justify-between">
            <span className="text-status-alarm">{error}</span>
            <button className="text-xs text-text-secondary" onClick={clearError}>
              Dismiss
            </button>
          </div>
        )}

        <motion.div variants={item} className="rounded-lg border border-border-primary bg-bg-secondary p-4 space-y-3">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-text-secondary">Trading day (synthetic)</p>
              <div className="flex flex-wrap gap-1">
                {SCENARIOS.map(([label, s]) => (
                  <button
                    key={s}
                    aria-pressed={scenario === s}
                    onClick={() => setParams({ scenario: s })}
                    className={`rounded px-2 py-1 text-xs font-medium ${scenario === s ? "bg-accent text-accent-ink" : "text-text-secondary hover:bg-bg-tertiary"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-4">
              {toggle("Two-sided CfD", include_cfd, "include_cfd")}
              {toggle("BESS arbitrage", include_bess, "include_bess")}
            </div>
            <span className="ml-auto">
              <EducationButton content={marketEducation} />
            </span>
          </div>
          <div className="flex flex-wrap gap-4">
            <Slider
              label="CfD strike (2025 auction: 477–492)"
              value={strike_pln_mwh}
              display={`${strike_pln_mwh} PLN/MWh`}
              min={300}
              max={700}
              step={1}
              onChange={(v) => setParams({ strike_pln_mwh: v })}
            />
            <Slider
              label="Day-ahead wind-speed error, 1σ"
              value={forecast_sigma_ms}
              display={`${forecast_sigma_ms.toFixed(1)} m/s`}
              min={0}
              max={3}
              step={0.1}
              onChange={(v) => setParams({ forecast_sigma_ms: v })}
            />
          </div>
        </motion.div>

        <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard
            label="Revenue of the day"
            value={d ? kPln(d.total_pln) : "—"}
            unit="k PLN"
            trendValue={d ? `${d.energy_mwh.toFixed(0)} MWh metered` : ""}
          />
          <KPICard
            label="Farm price (DA + imbalance + CfD)"
            value={d ? d.farm_price_pln_mwh.toFixed(0) : "—"}
            unit="PLN/MWh"
            trendValue={d ? (include_cfd ? `strike ${strike_pln_mwh}` : "merchant, no CfD") : ""}
          />
          <KPICard
            label="Wind capture rate"
            value={d ? d.capture_rate_pct.toFixed(0) : "—"}
            unit="%"
            trendValue={d ? `${d.captured_price_pln_mwh.toFixed(0)} vs ${d.day_average_price_pln_mwh.toFixed(0)} PLN/MWh average` : ""}
          />
          <KPICard
            label="Imbalance cost"
            value={d ? kPln(d.imbalance_pln) : "—"}
            unit="k PLN"
            trendValue={d ? `RMS deviation ${d.rmse_mwh.toFixed(0)} MWh` : ""}
          />
        </motion.div>

        <motion.div variants={item}>
          <MarketPricePanel />
        </motion.div>
        <motion.div variants={item}>
          <MarketEnergyPanel />
        </motion.div>
        <motion.div variants={item} className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <MarketSettlementPanel />
          <MarketBessPanel />
        </motion.div>
      </motion.div>
    </MotionConfig>
  );
}
