/**
 * Model card (in the spirit of DNV-RP-A204): what the twin assumes, how it
 * was calibrated, how well it fits fault-free data, and which standards it
 * follows. Values come from the backend — nothing here is hard-coded.
 */

import { useDigitalTwinStore } from "../../store/digitalTwinStore";
import { ChartWrapper } from "../ui/ChartWrapper";
import { CHANNEL_META } from "./twinFormat";

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-xs">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-text-muted">{k}</dt>
          <dd className="text-right font-mono tabular-nums text-text-primary">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-border-primary/70 bg-bg-tertiary/30 p-3 space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">{title}</h4>
      {children}
    </section>
  );
}

function num(v: number | string | undefined, digits = 3): string {
  if (typeof v !== "number") return String(v ?? "—");
  const s = v.toFixed(digits);
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}

export default function ModelCardPanel() {
  const card = useDigitalTwinStore((s) => s.modelCard);
  if (!card) return null;
  const t = card.turbine;
  const a = card.aero_calibration;
  const th = card.thermal_model;
  const d = card.detector;
  const p1 = card.phase_one;

  return (
    <ChartWrapper title="Model card">
      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
        <Section title="Physical entity — turbine data">
          <Rows
            rows={[
              ["Turbine", String(t.name)],
              ["Rated power", `${num(t.rated_power_mw)} MW`],
              ["Rotor diameter", `${num(t.rotor_diameter_m)} m`],
              ["Cut-in / rated / cut-out", `${num(t.cut_in_ms)} / ${num(t.rated_wind_ms)} / ${num(t.cut_out_ms)} m/s`],
              ["Rotor speed range", `${num(t.min_rotor_rpm)} – ${num(t.rated_rotor_rpm)} rpm`],
              ["Drivetrain", String(t.drivetrain)],
              ["η generator · η converter", `${num(t.generator_efficiency, 4)} · ${num(t.converter_efficiency, 4)}`],
              ["λ_opt (ROSCO VS_TSRopt)", num(t.tsr_opt)],
            ]}
          />
        </Section>

        <Section title="Aerodynamic calibration">
          <Rows
            rows={[
              ["λ_opt (β = 0)", num(a.lambda_opt)],
              ["Cp,max ROSCO surface", num(a.cp_max_surface, 4)],
              ["k_aero (rated at 10.66 m/s)", num(a.k_aero, 4)],
              ["Cp,max effective", num(a.cp_max_effective, 4)],
              ["Torque gain K", `${num(a.torque_gain_mnm_per_rad_s2)} MN·m·s²`],
            ]}
          />
          <p className="text-xs text-text-muted">
            One constant fitted to the official rated point: it closes the 1.6 % gap between
            the ROSCO Cp table (CCBlade) and the WISDEM table behind the power curve.
          </p>
        </Section>

        <Section title="Generator thermal model (stator winding)">
          <Rows
            rows={[
              ["Structure", String(th.structure)],
              ["ΔT₀", `${num(th.offset_k)} K`],
              ["R_th", `${num(th.resistance_k_per_kw, 4)} K/kW`],
              ["Time constant τ", `${num(Number(th.time_constant_s) / 60, 0)} min`],
            ]}
          />
          <p className="text-xs text-status-warning">{String(th.provenance)}</p>
        </Section>

        <Section title="Phase I calibration (fault-free data)">
          <Rows
            rows={[
              ["Data", `${num(p1.days, 0)} d × 34 = ${num(p1.turbine_days, 0)} turbine-days`],
              ["Wind uncertainty σ_v (estimated)", `${num(p1.wind_sigma_a_ms)} + ${num(p1.wind_sigma_b, 4)}·v m/s`],
              ["Anemometer error (simulated)", String(card.measurement_model.anemometer_sigma)],
              ["False events, in-sample", `${num(p1.in_sample_false_events, 0)} / ${num(p1.days, 0)} d`],
              ["False events, independent run", `${num(p1.verification_false_events, 0)} / ${num(p1.verification_days, 0)} d`],
            ]}
          />
          <p className="text-xs text-text-muted">
            σ_v is inverted from the power scatter (GUM propagation) — it recovers the simulated
            anemometer error, which is how the diagnosis knows the input uncertainty.
          </p>
        </Section>

        <Section title="State detection — EWMA chart">
          <Rows
            rows={[
              ["λ (smoothing)", num(d.ewma_lambda)],
              ["L (limit width)", num(d.ewma_l)],
              ["Persistence", `${num(d.persistence_minutes, 0)} min`],
              ["Alarm", `|EWMA| ≥ ${num(d.alarm_u)} × limit`],
              ["Health zones", `≥ ${num(d.hi_normal, 0)} normal · ≥ ${num(d.hi_alarm, 0)} alert`],
              ["Wind bins", `${num(d.wind_bin_width_ms)} m/s (IEC 61400-12-1)`],
            ]}
          />
          <p className="text-xs text-text-muted">
            L is set for 170 parallel charts (34 × 5), not for one: the fleet false-event rate is
            the number that matters to an operator.
          </p>
        </Section>

        <Section title="Twin fidelity per channel">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-text-muted">
                  <th className="pb-1 pr-2 font-medium">Channel</th>
                  <th className="pb-1 pr-2 font-medium">LN</th>
                  <th className="pb-1 pr-2 font-medium text-right">RMSE</th>
                  <th className="pb-1 pr-2 font-medium text-right">ρ₁</th>
                  <th className="pb-1 font-medium text-right">κ</th>
                </tr>
              </thead>
              <tbody>
                {card.channels.map((ch) => (
                  <tr key={ch.key} className="border-t border-border-primary/40">
                    <td className="py-1 pr-2 text-text-secondary">{CHANNEL_META[ch.key].label}</td>
                    <td className="py-1 pr-2 font-mono text-text-muted">{ch.logical_node}</td>
                    <td className="py-1 pr-2 text-right font-mono tabular-nums">
                      {ch.rmse.toFixed(3)} {ch.unit}
                    </td>
                    <td className="py-1 pr-2 text-right font-mono tabular-nums">{ch.lag1_autocorr.toFixed(2)}</td>
                    <td className="py-1 text-right font-mono tabular-nums">{ch.acf_factor.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-text-muted">
            ρ₁ lag-1 autocorrelation, κ EWMAST variance factor that widens the limit.
          </p>
        </Section>

        <Section title="Fault library (hypotheses)">
          <ul className="space-y-1.5 text-xs">
            {card.fault_library.map((m) => (
              <li key={m.kind} className="flex flex-wrap justify-between gap-x-3">
                <span className="text-text-primary">{m.label}</span>
                <span className="font-mono text-text-muted">
                  {m.parameter} [{m.unit}] · {m.search_min}–{m.search_max}
                  {m.prognosis_limit != null ? ` · limit ${m.prognosis_limit}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Standards and references">
          <ul className="space-y-1.5 text-xs">
            {card.standards.map((s) => (
              <li key={s.code}>
                <span className="font-mono font-semibold text-text-primary">{s.code}</span>{" "}
                <span className="text-text-secondary">{s.title}</span>
                <div className="text-xs text-text-muted">→ {s.role}</div>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </ChartWrapper>
  );
}
