/**
 * Farm Config Panel — M04 Multi-Farm Comparison.
 *
 * Editable card for a single farm configuration.
 * Inputs: name, turbine count, rated MW, Weibull A/K, array voltage, export length.
 * Parent: FarmComparisonDashboard (renders one per farm slot).
 */

import { useFarmComparisonStore } from "../../store/farmComparisonStore";
import type { FarmConfig } from "../../types/farmComparison";

interface Props {
  index: number;
  config: FarmConfig;
}

function Field({
  label,
  value,
  unit,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="text-[10px] text-text-muted block mb-0.5">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full bg-bg-tertiary border border-border-primary rounded px-1.5 py-0.5 text-xs text-text-primary font-mono focus:outline-none focus:border-accent"
        />
        <span className="text-[10px] text-text-muted whitespace-nowrap">{unit}</span>
      </div>
    </div>
  );
}

export default function FarmConfigPanel({ index, config }: Props) {
  const { updateFarm, removeFarm, farms } = useFarmComparisonStore();

  const update = (partial: Partial<FarmConfig>) => updateFarm(index, partial);

  const installedMW = config.n_turbines * config.turbine_rated_mw;

  return (
    <div className="bg-bg-secondary rounded-lg border border-border-primary p-3 flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <input
          type="text"
          value={config.name}
          onChange={(e) => update({ name: e.target.value })}
          className="text-sm font-semibold text-text-primary bg-transparent border-b border-transparent hover:border-border-primary focus:border-accent outline-none w-full"
        />
        {farms.length > 2 && (
          <button
            onClick={() => removeFarm(index)}
            className="text-[10px] text-status-alarm hover:underline ml-2 shrink-0"
          >
            Remove
          </button>
        )}
      </div>

      {/* Capacity badge */}
      <div className="text-xs text-text-muted">
        <span className="font-mono font-bold text-accent">{installedMW.toFixed(0)} MW</span> installed
        ({config.n_turbines} × {config.turbine_rated_mw} MW)
      </div>

      {/* Parameter grid */}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Turbines" value={config.n_turbines} unit="" min={1} max={200} step={1} onChange={(v) => update({ n_turbines: v })} />
        <Field label="Rated MW" value={config.turbine_rated_mw} unit="MW" min={1} max={20} step={0.5} onChange={(v) => update({ turbine_rated_mw: v })} />
        <Field label="Weibull A (scale)" value={config.weibull_a} unit="m/s" min={5} max={15} step={0.1} onChange={(v) => update({ weibull_a: v })} />
        <Field label="Weibull k (shape)" value={config.weibull_k} unit="" min={1} max={3.5} step={0.05} onChange={(v) => update({ weibull_k: v })} />
        <Field label="Array voltage" value={config.array_voltage_kv} unit="kV" min={33} max={132} step={33} onChange={(v) => update({ array_voltage_kv: v })} />
        <Field label="Export length" value={config.export_length_km} unit="km" min={5} max={200} step={1} onChange={(v) => update({ export_length_km: v })} />
      </div>
    </div>
  );
}
