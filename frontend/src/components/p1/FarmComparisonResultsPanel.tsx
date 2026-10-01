/**
 * Farm Comparison Results — M04.
 *
 * 1. "Where the energy goes": per-farm gross → net bar, each loss a segment
 *    sized in GWh (sequential multiplicative cascade, same as the AEP tab).
 * 2. Metric bars: net AEP, capacity factor, LCOE vs price, IRR.
 * 3. Grid table: export circuits, utilisation, cable charging Q, losses.
 * Bars grow in on each new comparison (framer-motion; honours reduced motion).
 */

import { motion, MotionConfig } from "framer-motion";
import { Award } from "lucide-react";

import { lcoeEducation } from "../../constants/education/p1";
import { FARM_COLORS, useFarmComparisonStore } from "../../store/farmComparisonStore";
import type { FarmAEPResult } from "../../types/farmComparison";
import { EducationButton } from "../ui/EducationButton";

const LOSS_COLORS = {
  wake: "#ef4444",
  blockage: "#f97316",
  electrical: "#eab308",
  availability: "#a855f7",
  environmental: "#64748b",
} as const;
type LossKey = keyof typeof LOSS_COLORS;

const GROW = { duration: 0.9, ease: [0.22, 1, 0.36, 1] as const };

/** Sequential GWh lost per cascade step; environmental closes the gap to net. */
function lossGWh(a: FarmAEPResult): Record<LossKey, number> {
  let remaining = a.gross_gwh;
  const take = (pct: number) => {
    const lost = (remaining * pct) / 100;
    remaining -= lost;
    return lost;
  };
  const wake = take(a.wake_loss_pct);
  const blockage = take(a.blockage_loss_pct);
  const electrical = take(a.electrical_loss_pct);
  const availability = take(a.availability_loss_pct);
  return { wake, blockage, electrical, availability, environmental: Math.max(0, remaining - a.net_gwh) };
}

function Card({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-bg-secondary rounded-lg border border-border-primary p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h4 className="text-sm font-semibold text-text-primary">{title}</h4>
        {right}
      </div>
      {children}
    </section>
  );
}

function MetricBars({
  title,
  unit,
  values,
  names,
  best,
  digits = 0,
  reference,
}: {
  title: string;
  unit: string;
  values: number[];
  names: string[];
  best: "max" | "min";
  digits?: number;
  reference?: { value: number; label: string };
}) {
  const max = Math.max(...values, reference?.value ?? 0) * 1.08;
  const bestValue = best === "max" ? Math.max(...values) : Math.min(...values);
  return (
    <div>
      <div className="text-xs text-text-secondary mb-2">
        {title} <span className="text-text-muted">[{unit}]</span>
      </div>
      <div className="relative space-y-1.5">
        {values.map((v, i) => (
          <div key={names[i]} className="flex items-center gap-2" title={`${names[i]}: ${v.toFixed(digits)} ${unit}`}>
            <div className="relative flex-1 h-5 rounded bg-bg-tertiary overflow-hidden">
              <motion.div
                className="h-full rounded"
                style={{ background: FARM_COLORS[i % FARM_COLORS.length], opacity: v === bestValue ? 1 : 0.55 }}
                initial={{ width: 0 }}
                animate={{ width: `${(v / max) * 100}%` }}
                transition={{ ...GROW, delay: 0.08 * i }}
              />
            </div>
            <span className={`w-16 text-right font-mono text-xs tabular-nums ${v === bestValue ? "text-text-primary font-bold" : "text-text-secondary"}`}>
              {v.toFixed(digits)}
            </span>
          </div>
        ))}
        {reference && (
          <div
            className="absolute top-0 bottom-0 border-l-2 border-dashed border-status-warning pointer-events-none"
            style={{ left: `calc((100% - 4.5rem) * ${reference.value / max})` }}
          >
            <span className="absolute -top-4 -translate-x-1/2 whitespace-nowrap text-[10px] text-status-warning">
              {reference.label}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function FarmComparisonResultsPanel() {
  const results = useFarmComparisonStore((s) => s.results);
  const stale = useFarmComparisonStore((s) => s.stale);
  if (!results) return null;

  const { aep, lcoe, grid } = results;
  const names = aep.map((a) => a.farm_name);
  const maxGross = Math.max(...aep.map((a) => a.gross_gwh));

  return (
    <MotionConfig reducedMotion="user">
      <div key={results.comparison_id} className={`space-y-4 transition-opacity ${stale ? "opacity-60" : ""}`}>
        {stale && (
          <p className="text-xs text-status-warning">Inputs changed — press Compare to refresh these results.</p>
        )}

        {/* Winners */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: "Highest net AEP", farm: results.best_aep_farm },
            { label: "Lowest LCOE", farm: results.best_lcoe_farm },
            { label: "Highest capacity factor", farm: results.best_cf_farm },
          ].map((w, i) => (
            <motion.div
              key={w.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i }}
              className="flex items-center gap-3 rounded-lg border border-border-primary bg-bg-secondary px-3 py-2"
            >
              <Award size={18} style={{ color: FARM_COLORS[names.indexOf(w.farm) % FARM_COLORS.length] }} />
              <div className="min-w-0">
                <div className="text-[10px] text-text-muted">{w.label}</div>
                <div className="text-sm font-semibold text-text-primary truncate">{w.farm}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Where the energy goes */}
        <Card title="Where the energy goes — gross → net AEP [GWh/yr]">
          <div className="space-y-3">
            {aep.map((a, i) => {
              const losses = lossGWh(a);
              const pct = (gwh: number) => `${(gwh / maxGross) * 100}%`;
              return (
                <div key={a.farm_name}>
                  <div className="flex justify-between text-xs mb-1 gap-2">
                    <span className="font-medium text-text-primary truncate">{a.farm_name}</span>
                    <span className="font-mono tabular-nums text-text-secondary whitespace-nowrap">
                      {a.gross_gwh.toFixed(0)} → <b className="text-text-primary">{a.net_gwh.toFixed(0)}</b> GWh · −
                      {a.total_loss_pct.toFixed(1)} %
                    </span>
                  </div>
                  <motion.div
                    className="flex h-6 rounded overflow-hidden"
                    initial={{ width: 0 }}
                    animate={{ width: pct(a.gross_gwh) }}
                    transition={{ ...GROW, delay: 0.1 * i }}
                  >
                    <div
                      className="h-full"
                      style={{ width: `${(a.net_gwh / a.gross_gwh) * 100}%`, background: FARM_COLORS[i % FARM_COLORS.length] }}
                      title={`Net (P50): ${a.net_gwh.toFixed(0)} GWh`}
                    />
                    {(Object.keys(LOSS_COLORS) as LossKey[]).map((k) => (
                      <div
                        key={k}
                        className="h-full"
                        style={{ width: `${(losses[k] / a.gross_gwh) * 100}%`, background: LOSS_COLORS[k] }}
                        title={`${k}: −${losses[k].toFixed(1)} GWh`}
                      />
                    ))}
                  </motion.div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] text-text-secondary">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-4 rounded-sm bg-linear-to-r from-[#60a5fa] to-[#3ecf6e]" /> Net (delivered)
            </span>
            {(Object.keys(LOSS_COLORS) as LossKey[]).map((k) => (
              <span key={k} className="flex items-center gap-1.5 capitalize">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: LOSS_COLORS[k] }} /> {k}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-text-muted">
            Losses are multiplicative: each acts on the energy left after the previous one. Wake from PyWake BPA
            Gaussian on the farm's grid; blockage Nygaard (2020); electrical loss is energy-weighted over the year.
          </p>
        </Card>

        {/* Metric bars */}
        <Card title="Key metrics" right={<EducationButton content={lcoeEducation} />}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            <MetricBars title="Net AEP (P50)" unit="GWh/yr" values={aep.map((a) => a.net_gwh)} names={names} best="max" />
            <MetricBars title="Net capacity factor" unit="%" values={aep.map((a) => a.capacity_factor_pct)} names={names} best="max" digits={1} />
            <MetricBars
              title="LCOE"
              unit="€/MWh"
              values={lcoe.map((l) => l.lcoe_eur_per_mwh)}
              names={names}
              best="min"
              digits={1}
              reference={{ value: results.electricity_price_eur_mwh, label: `price ${results.electricity_price_eur_mwh} €/MWh` }}
            />
            <MetricBars title="Project IRR (unlevered, flat price)" unit="%" values={lcoe.map((l) => l.irr_pct)} names={names} best="max" digits={1} />
          </div>
          <p className="mt-4 text-[11px] text-text-muted">
            LCOE below the price line means the farm earns more per MWh than it costs over its life. IRR below the WACC says the same thing the other way round: the project does not earn its cost of capital at this price. P90 (bank case) is
            ≈ 8.8 % below P50 at the 6.9 % combined (RSS) uncertainty.
          </p>
        </Card>

        {/* Detailed table */}
        <Card title="Detailed results">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left tabular-nums">
              <thead>
                <tr className="text-text-muted border-b border-border-primary">
                  <th className="pb-1.5 pr-3 font-medium">Farm</th>
                  <th className="pb-1.5 px-2 text-right font-medium">MW</th>
                  <th className="pb-1.5 px-2 text-right font-medium" title="Weibull scale A = v̄ / Γ(1+1/k)">A [m/s]</th>
                  <th className="pb-1.5 px-2 text-right font-medium">Wake %</th>
                  <th className="pb-1.5 px-2 text-right font-medium">P90 GWh</th>
                  <th className="pb-1.5 px-2 text-right font-medium">CAPEX M€</th>
                  <th className="pb-1.5 px-2 text-right font-medium">Payback yr</th>
                  <th className="pb-1.5 px-2 text-right font-medium" title="Parallel 1000 mm² circuits needed (950 A each)">Export ckts</th>
                  <th className="pb-1.5 px-2 text-right font-medium" title="Export current at rated output / circuit rating">Utilisation %</th>
                  <th className="pb-1.5 px-2 text-right font-medium" title="Q = ωCU²L per circuit — capacitive, absorbed by shunt reactors">Charging MVAr</th>
                  <th className="pb-1.5 px-2 text-right font-medium" title="I²R + transformer losses at rated output">Elec. loss @ rated %</th>
                  <th className="pb-1.5 pl-2 text-right font-medium" title="Rated loss × loss load factor E[P²]/(Prated·E[P]) + iron losses">Elec. loss annual %</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {aep.map((a, i) => (
                  <tr key={a.farm_name} className="border-b border-border-primary/30">
                    <td className="py-1.5 pr-3 font-sans font-medium text-text-primary whitespace-nowrap">
                      <span className="inline-block h-2 w-2 rounded-full mr-1.5" style={{ background: FARM_COLORS[i % FARM_COLORS.length] }} />
                      {a.farm_name}
                    </td>
                    <td className="px-2 text-right">{a.installed_mw.toFixed(0)}</td>
                    <td className="px-2 text-right">{a.weibull_a_ms.toFixed(2)}</td>
                    <td className="px-2 text-right">{a.wake_loss_pct.toFixed(1)}</td>
                    <td className="px-2 text-right">{a.p90_gwh.toFixed(0)}</td>
                    <td className="px-2 text-right">{lcoe[i].capex_meur.toFixed(0)}</td>
                    <td className="px-2 text-right">{lcoe[i].simple_payback_years.toFixed(1)}</td>
                    <td className="px-2 text-right">{grid[i].export_circuits}</td>
                    <td className="px-2 text-right">{grid[i].export_utilization_pct.toFixed(0)}</td>
                    <td className="px-2 text-right">{grid[i].cable_charging_mvar.toFixed(0)}</td>
                    <td className="px-2 text-right">{grid[i].total_electrical_losses_pct.toFixed(2)}</td>
                    <td className="pl-2 text-right">{grid[i].annual_electrical_loss_pct.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] text-text-muted">
            Screening model — reactive capability and NC RfG compliance need a load flow (see P2 HV Grid). Export
            circuits assume 1000 mm² Cu XLPE (R_ac 0.023 Ω/km, 190 nF/km), unity power factor at the POC.
          </p>
        </Card>
      </div>
    </MotionConfig>
  );
}
