/**
 * Farm Config Table — M04 Multi-Farm Comparison.
 *
 * One column per design alternative, one row per input, grouped the way an
 * energy-yield engineer thinks: site → layout → electrical → economics.
 * Inputs that differ from the first design are highlighted, so the change
 * being tested is visible at a glance. Hover a row label for its meaning.
 * Bounds mirror backend/app/schemas/farm_config.py (FarmConfigCreate).
 */

import { X } from "lucide-react";

import { farmConfigEducation } from "../../constants/education/p1";
import { FARM_COLORS, useFarmComparisonStore } from "../../store/farmComparisonStore";
import type { FarmConfig } from "../../types/farmComparison";
import { EducationButton } from "../ui/EducationButton";

type NumKey = { [K in keyof FarmConfig]: FarmConfig[K] extends number ? K : never }[keyof FarmConfig];

interface FieldSpec {
  key: NumKey;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  hint: string;
}

const GROUPS: { title: string; fields: FieldSpec[] }[] = [
  {
    title: "Site wind",
    fields: [
      { key: "mean_wind_speed_ms", label: "Mean speed", unit: "m/s", min: 5, max: 14, step: 0.1, hint: "Long-term mean at hub height. Energy ∝ v³, so +0.5 m/s ≈ +8–10 % AEP." },
      { key: "weibull_k", label: "Weibull k", unit: "", min: 1.5, max: 3.5, step: 0.05, hint: "Shape: low k = gusty, spread-out winds; high k = steady winds. Offshore Baltic ≈ 2.0–2.3." },
    ],
  },
  {
    title: "Layout",
    fields: [
      { key: "turbine_count", label: "Turbines", unit: "", min: 2, max: 200, step: 1, hint: "Number of turbines on a near-square grid." },
      { key: "turbine_rated_mw", label: "Rating", unit: "MW", min: 0.5, max: 20, step: 0.5, hint: "Scaled V236 at the same specific power (343 W/m²): same rated wind speed, rotor area ∝ rating." },
      { key: "turbine_spacing_d", label: "Spacing", unit: "D", min: 4, max: 12, step: 0.5, hint: "Grid spacing in rotor diameters. Tighter = less seabed and cable, but more wake loss." },
    ],
  },
  {
    title: "Electrical",
    fields: [
      { key: "array_voltage_kv", label: "Array", unit: "kV", min: 33, max: 132, step: 33, hint: "Collection voltage. I²R loss ∝ 1/U² for the same conductor." },
      { key: "export_voltage_kv", label: "Export", unit: "kV", min: 66, max: 400, step: 1, hint: "HVAC export voltage. Model uses 1000 mm² Cu XLPE circuits (950 A each)." },
      { key: "export_length_km", label: "Export length", unit: "km", min: 1, max: 300, step: 1, hint: "OSS → onshore. Charging Q = ωCU²L grows with length — the HVAC distance limit." },
      { key: "availability_pct", label: "Availability", unit: "%", min: 70, max: 99.9, step: 0.5, hint: "Time-based availability. Offshore typical 94–97 % (weather-limited access)." },
    ],
  },
  {
    title: "Economics",
    fields: [
      { key: "capex_m_eur_per_mw", label: "CAPEX", unit: "M€/MW", min: 1, max: 8, step: 0.1, hint: "Installed cost incl. foundations, cables, substations, installation and soft costs. Default 5.0 M€/MW = NREL Cost of Wind Energy Review 2024 fixed-bottom reference (5 411 $/kW, 2023 USD)." },
      { key: "opex_k_eur_per_mw_year", label: "OPEX", unit: "k€/MW·yr", min: 20, max: 200, step: 5, hint: "Annual operations & maintenance cost. Default 125 k€/MW·yr = NREL review, 135 $/kW-yr (2023 USD)." },
      { key: "discount_rate_pct", label: "WACC", unit: "%", min: 2, max: 15, step: 0.5, hint: "Discount rate in the capital recovery factor. +1 pp WACC ≈ +6–8 % LCOE." },
      { key: "lifetime_years", label: "Lifetime", unit: "yr", min: 10, max: 35, step: 1, hint: "Economic life used to annualise CAPEX." },
    ],
  },
];

export default function FarmConfigTable() {
  const farms = useFarmComparisonStore((s) => s.farms);
  const updateFarm = useFarmComparisonStore((s) => s.updateFarm);
  const removeFarm = useFarmComparisonStore((s) => s.removeFarm);
  const base = farms[0];
  const input =
    "w-full min-w-0 bg-bg-tertiary border border-border-primary rounded px-1.5 py-1 text-xs text-text-primary font-mono focus:outline-none focus:border-accent";

  return (
    <div className="rounded-lg border border-border-primary bg-bg-secondary overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="w-40 min-w-36 p-2 text-left align-bottom">
              <span className="flex items-center gap-1 text-text-muted font-medium">
                Design input <EducationButton content={farmConfigEducation} />
              </span>
            </th>
            {farms.map((f, i) => (
              <th key={i} className="min-w-32 p-2 align-bottom border-t-2" style={{ borderTopColor: FARM_COLORS[i] }}>
                <div className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: FARM_COLORS[i] }} />
                  <input
                    type="text"
                    value={f.name}
                    aria-label={`Design ${i + 1} name`}
                    onChange={(e) => updateFarm(i, { name: e.target.value })}
                    className="w-full min-w-0 bg-transparent text-sm font-semibold text-text-primary border-b border-transparent hover:border-border-primary focus:border-accent outline-none"
                  />
                  {farms.length > 2 && (
                    <button
                      onClick={() => removeFarm(i)}
                      aria-label={`Remove ${f.name}`}
                      className="p-0.5 rounded text-text-muted hover:text-status-alarm"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
                <div className="mt-0.5 text-left font-normal text-text-muted">
                  <span className="font-mono font-semibold text-text-primary">
                    {(f.turbine_count * f.turbine_rated_mw).toFixed(0)} MW
                  </span>{" "}
                  · {f.turbine_count} × {f.turbine_rated_mw} MW
                </div>
              </th>
            ))}
          </tr>
        </thead>
        {GROUPS.map((g) => (
          <tbody key={g.title}>
            <tr>
              <th colSpan={farms.length + 1} className="px-2 pt-3 pb-1 text-left text-[11px] font-semibold text-text-secondary border-b border-border-primary/60">
                {g.title}
              </th>
            </tr>
            {g.fields.map((fs) => (
              <tr key={fs.key} className="hover:bg-bg-tertiary/40">
                <th scope="row" className="px-2 py-1 text-left font-normal text-text-muted cursor-help" title={fs.hint}>
                  {fs.label} {fs.unit && <span className="text-text-muted/70">[{fs.unit}]</span>}
                </th>
                {farms.map((f, i) => {
                  const changed = i > 0 && f[fs.key] !== base[fs.key];
                  return (
                    <td key={i} className="px-2 py-1">
                      <input
                        type="number"
                        value={f[fs.key]}
                        min={fs.min}
                        max={fs.max}
                        step={fs.step}
                        aria-label={`${f.name} ${fs.label}`}
                        onChange={(e) => {
                          const v = e.target.valueAsNumber;
                          if (Number.isFinite(v)) updateFarm(i, { [fs.key]: v });
                        }}
                        className={input}
                        style={changed ? { borderColor: FARM_COLORS[i], boxShadow: `inset 3px 0 0 ${FARM_COLORS[i]}` } : undefined}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
      <p className="px-2 py-2 text-[11px] text-text-muted">
        Coloured inputs differ from the first design. Hover a row label for what it means physically.
      </p>
    </div>
  );
}
