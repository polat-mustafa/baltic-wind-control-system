/**
 * Sensitivity panel — parameter sliders for wind resource analysis.
 *
 * Controls: Weibull A (8-13), k (1.5-3.0), TI (0.04-0.10),
 * price (50-120), layout radio buttons (regular/staggered).
 */

import { useWindResourceStore } from "../../store/windResourceStore";

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
}

function Slider({ label, value, min, max, step, unit, onChange }: SliderProps) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-400">{label}</span>
        <span className="text-white font-mono">
          {value.toFixed(step < 0.1 ? 2 : 1)} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
      />
    </div>
  );
}

export default function SensitivityPanel() {
  const {
    weibullA,
    weibullK,
    turbulenceIntensity,
    priceEurMwh,
    activeLayout,
    setWeibullA,
    setWeibullK,
    setTurbulenceIntensity,
    setPriceEurMwh,
    setActiveLayout,
  } = useWindResourceStore();

  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 space-y-4">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
        Parameters
      </h3>

      <Slider
        label="Weibull A (scale)"
        value={weibullA}
        min={8}
        max={13}
        step={0.1}
        unit="m/s"
        onChange={setWeibullA}
      />

      <Slider
        label="Weibull k (shape)"
        value={weibullK}
        min={1.5}
        max={3.0}
        step={0.1}
        unit=""
        onChange={setWeibullK}
      />

      <Slider
        label="Turbulence Intensity"
        value={turbulenceIntensity}
        min={0.04}
        max={0.10}
        step={0.01}
        unit=""
        onChange={setTurbulenceIntensity}
      />

      <Slider
        label="Electricity Price"
        value={priceEurMwh}
        min={50}
        max={120}
        step={1}
        unit={"\u20AC/MWh"}
        onChange={setPriceEurMwh}
      />

      {/* Layout selector */}
      <div>
        <p className="text-xs text-slate-400 mb-2">Layout</p>
        <div className="flex gap-2">
          {["regular", "staggered"].map((layout) => (
            <button
              key={layout}
              onClick={() => setActiveLayout(layout)}
              className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                activeLayout === layout
                  ? "bg-blue-600/20 text-blue-400 border border-blue-500/50"
                  : "bg-slate-700 text-slate-300 border border-slate-600 hover:bg-slate-600"
              }`}
            >
              {layout.charAt(0).toUpperCase() + layout.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
