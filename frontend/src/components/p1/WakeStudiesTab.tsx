/**
 * Wake & uncertainty studies — the questions behind the AEP tab's single number:
 *
 *   How much does the wake model matter?   five PyWake models + FLOWERS on one layout
 *   Can control win energy back?           wake steering (one direction, then the year), derating
 *   Which wind input drives the spread?    PCE surrogate, first-order Sobol indices
 *
 * Each study runs on demand (PyWake takes seconds; the year of wake steering about a minute)
 * on the layout and wind of the AEP tab's controls.
 */

import { useState, type ReactNode } from "react";

import { useWindResourceStore } from "../../store/windResourceStore";
import { weibullMean } from "../../utils/aepMath";
import {
  compareWakeModels,
  derating,
  flowersAep,
  optimiseYaw,
  optimiseYawFarm,
  pceUncertainty,
  type DeratingResult,
  type FarmYawResult,
  type FlowersResult,
  type PceResult,
  type StudyWind,
  type WakeModelComparison,
  type YawResult,
} from "../../services/p1StudiesApi";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

const MODEL_LABEL: Record<string, string> = {
  jensen: "Jensen (1983) top-hat",
  bpa_gaussian: "Bastankhah & Porté-Agel (2014)",
  niayifar_gaussian: "Niayifar & Porté-Agel (2016) — AEP tab",
  zong_gaussian: "Zong & Porté-Agel (2020)",
  turbopark: "TurbOPark (Nygaard 2020)",
};

const PARAM_LABEL: Record<string, string> = {
  weibull_a: "Weibull A (mean speed)",
  weibull_k: "Weibull k (spread)",
  turbulence_intensity: "Turbulence intensity",
};

const STEERING_DIRECTION_DEG = 240; // prevailing WSW wind at the site
const STEERING_WIND_MS = 9.5; // below rated: where wake steering can pay

/** Run-on-demand state of one study. */
function useStudy<T>() {
  const [data, setData] = useState<T | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<T>) => {
    setBusy(true);
    setError(null);
    try {
      setData(await fn());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return { data, busy, error, run };
}

function Panel({
  title,
  intro,
  busy,
  error,
  onRun,
  runLabel = "Run",
  children,
}: {
  title: string;
  intro: string;
  busy: boolean;
  error: string | null;
  onRun: () => void;
  runLabel?: string;
  children: ReactNode;
}) {
  return (
    <section className="bg-bg-secondary rounded-lg border border-border-primary p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="max-w-3xl">
          <h3 className="text-base font-semibold text-text-primary">{title}</h3>
          <p className="text-sm text-text-secondary mt-1">{intro}</p>
        </div>
        <Button size="sm" onClick={onRun} disabled={busy}>
          {busy ? "Running..." : runLabel}
        </Button>
      </div>
      {error && <p className="text-sm text-status-alarm">{error}</p>}
      {children}
    </section>
  );
}

/** Numbers with units: no uppercase (it would turn σ into Σ and GWh into GWH). */
const KPI = "normal-case tracking-normal";

const th = "text-left font-medium text-text-muted px-2 py-1";
const td = "px-2 py-1 tabular-nums";

export default function WakeStudiesTab() {
  const { weibullA, weibullK, turbulenceIntensity, activeLayout } = useWindResourceStore();
  const wind: StudyWind = {
    layout: activeLayout,
    weibull_a: weibullA,
    weibull_k: weibullK,
    turbulence_intensity: turbulenceIntensity,
  };

  const models = useStudy<{ cmp: WakeModelComparison; flowers: FlowersResult }>();
  const yaw = useStudy<{ yaw: YawResult; derate: DeratingResult }>();
  const yawYear = useStudy<FarmYawResult>();
  const pce = useStudy<PceResult>();

  return (
    <div className="space-y-5">
      <p className="text-sm text-text-secondary max-w-4xl">
        The AEP tab gives one number from one wake model. These studies ask how far that number can
        move: with the choice of wake model, with turbine control, and with the uncertain wind inputs.
        All run with PyWake on the selected layout and the AEP tab&apos;s wind.
      </p>

      <Panel
        title="How much does the wake model matter?"
        intro="Five engineering wake models and the analytical FLOWERS model on the same layout and wind. The spread between them is model uncertainty — one reason the AEP uncertainty budget carries 25 % of the wake loss."
        busy={models.busy}
        error={models.error}
        onRun={() =>
          void models.run(async () => {
            const [cmp, flowers] = await Promise.all([
              compareWakeModels(wind),
              flowersAep(wind, weibullMean(weibullA, weibullK)),
            ]);
            return { cmp, flowers };
          })
        }
      >
        {models.data && (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={th}>Wake model</th>
                  <th className={th}>Net AEP [GWh/yr]</th>
                  <th className={th}>Wake loss [%]</th>
                  <th className={th}>Capacity factor [%]</th>
                </tr>
              </thead>
              <tbody>
                {models.data.cmp.results.map((r) => (
                  <tr key={r.model_name} className="border-t border-border-primary">
                    <td className="px-2 py-1">{MODEL_LABEL[r.model_name] ?? r.model_name}</td>
                    <td className={td}>{r.net_aep_gwh.toFixed(0)}</td>
                    <td className={td}>{r.wake_loss_percent.toFixed(2)}</td>
                    <td className={td}>{(r.capacity_factor * 100).toFixed(1)}</td>
                  </tr>
                ))}
                <tr className="border-t border-border-primary">
                  <td className="px-2 py-1">FLOWERS (LoCascio et al. 2022), analytical</td>
                  <td className={td}>{models.data.flowers.aep_gwh.toFixed(0)}</td>
                  <td className={td}>{models.data.flowers.wake_loss_percent.toFixed(2)}</td>
                  <td className={td}>{(models.data.flowers.capacity_factor * 100).toFixed(1)}</td>
                </tr>
              </tbody>
            </table>
            <div className="flex gap-2 flex-wrap">
              <Badge variant="info" className={KPI}>{`Spread ${models.data.cmp.aep_range_gwh.toFixed(0)} GWh/yr`}</Badge>
              <Badge variant="neutral" className={KPI}>{`Wake loss ${models.data.cmp.wake_loss_range_percent.toFixed(1)} points apart`}</Badge>
            </div>
            <p className="text-xs text-text-muted">
              TurbOPark recovers the wake more slowly in deep arrays and gives the largest loss; Jensen&apos;s
              top-hat the smallest. Validation against measured offshore farms (e.g. Nygaard 2020 for
              TurbOPark) is what decides between them, not the model&apos;s age.
            </p>
          </>
        )}
      </Panel>

      <Panel
        title="Can control win energy back?"
        intro={`Wake steering yaws upstream turbines to deflect their wakes off downstream rotors; derating lowers their thrust instead. Both at ${STEERING_WIND_MS} m/s from ${STEERING_DIRECTION_DEG}° (the prevailing wind), below rated where there is power to win.`}
        busy={yaw.busy}
        error={yaw.error}
        onRun={() =>
          void yaw.run(async () => {
            const [y, d] = await Promise.all([
              optimiseYaw(wind, STEERING_DIRECTION_DEG, STEERING_WIND_MS),
              derating(wind, STEERING_DIRECTION_DEG),
            ]);
            return { yaw: y, derate: d };
          })
        }
      >
        {yaw.data && (
          <>
            <div className="flex gap-2 flex-wrap">
              <Badge variant="normal" className={KPI}>{`Wake steering +${yaw.data.yaw.power_gain_percent.toFixed(1)} % (${yaw.data.yaw.baseline_power_mw.toFixed(0)} → ${yaw.data.yaw.optimized_power_mw.toFixed(0)} MW)`}</Badge>
              <Badge variant="neutral" className={KPI}>{`${yaw.data.yaw.optimal_yaw_angles_deg.filter((a) => Math.abs(a) > 0.5).length} of ${yaw.data.yaw.optimal_yaw_angles_deg.length} turbines yawed, up to ${Math.max(...yaw.data.yaw.optimal_yaw_angles_deg.map(Math.abs)).toFixed(0)}°`}</Badge>
              <Badge variant="neutral" className={KPI}>{`Derating +${yaw.data.derate.power_gain_percent.toFixed(1)} % (best fraction ${yaw.data.derate.optimal_derating_fraction.toFixed(2)})`}</Badge>
            </div>
            <p className="text-xs text-text-muted">
              Yawing costs the steered turbine roughly cos³ of its misalignment, but lifts the turbines
              behind it more. Derating rarely pays: the thrust a turbine sheds comes with almost the same
              share of its power, so studies with current wake models find little or no gain from it.
            </p>
          </>
        )}
      </Panel>

      <Panel
        title="Wake steering over a year"
        intro="The same optimisation for 12 directions, used as a lookup table over the year (steering only below rated, and only in bins where it pays). Takes about a minute."
        runLabel="Run (≈ 1 min)"
        busy={yawYear.busy}
        error={yawYear.error}
        onRun={() => void yawYear.run(() => optimiseYawFarm(wind, STEERING_WIND_MS))}
      >
        {yawYear.data && (
          <>
            <div className="flex gap-2 flex-wrap">
              <Badge variant="normal" className={KPI}>{`AEP +${yawYear.data.aep_gain_percent.toFixed(2)} % (${yawYear.data.baseline_aep_gwh.toFixed(0)} → ${yawYear.data.optimized_aep_gwh.toFixed(0)} GWh/yr)`}</Badge>
              <Badge variant="neutral" className={KPI}>{`Per direction at ${STEERING_WIND_MS} m/s: mean +${yawYear.data.mean_power_gain_percent.toFixed(1)} %, best +${yawYear.data.max_power_gain_percent.toFixed(1)} % from ${yawYear.data.best_direction_deg.toFixed(0)}°`}</Badge>
            </div>
            <p className="text-xs text-text-muted">
              Several per cent in one aligned direction becomes a fraction of a per cent of AEP: most
              energy comes above rated or from directions where the wakes miss anyway. Published
              wake-steering AEP estimates are likewise around one per cent or less.
            </p>
          </>
        )}
      </Panel>

      <Panel
        title="Which wind input drives the spread?"
        intro="A polynomial-chaos surrogate of PyWake over the uncertain wind climate (A ± 0.54 m/s, the NEWA mean-speed spread; k ± 0.15; TI 6 ± 1 %), 30 runs. First-order Sobol indices split the AEP variance by input. This is the wind-climate part of the uncertainty only, not the bankable total of the AEP tab."
        busy={pce.busy}
        error={pce.error}
        onRun={() => void pce.run(() => pceUncertainty(activeLayout))}
      >
        {pce.data && (
          <>
            <div className="flex gap-2 flex-wrap">
              <Badge variant="info" className={KPI}>{`Mean ${pce.data.mean_aep_gwh.toFixed(0)} GWh/yr, σ ${pce.data.std_aep_gwh.toFixed(0)} (${pce.data.cov_percent.toFixed(1)} %)`}</Badge>
              <Badge variant={pce.data.q2_loo >= 0.9 ? "normal" : "warning"} className={KPI}>{`Leave-one-out Q² ${pce.data.q2_loo.toFixed(3)}`}</Badge>
            </div>
            <div className="space-y-1.5 max-w-xl">
              {pce.data.sobol_indices.map((s) => (
                <div key={s.parameter} className="flex items-center gap-2 text-sm">
                  <span className="w-52 shrink-0">{PARAM_LABEL[s.parameter] ?? s.parameter}</span>
                  <div className="flex-1 h-2.5 rounded bg-bg-elevated">
                    <div className="h-2.5 rounded bg-accent" style={{ width: `${(s.first_order * 100).toFixed(1)}%` }} />
                  </div>
                  <span className="w-14 text-right tabular-nums">{`${(s.first_order * 100).toFixed(1)} %`}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-text-muted">
              The mean speed dominates: AEP follows it almost one to one at this site. That is why an
              on-site measurement campaign (lidar buoy) is the first thing that narrows a P90.
            </p>
          </>
        )}
      </Panel>
    </div>
  );
}
