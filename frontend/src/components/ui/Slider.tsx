/** Labelled range input with the value shown on the right of the label. */

interface SliderProps {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}

export function Slider({ label, value, display, min, max, step, onChange }: SliderProps) {
  return (
    <label className="flex flex-col gap-0.5 text-[11px] text-text-muted min-w-[10rem] flex-1">
      <span className="flex justify-between">
        {label} <span className="font-mono text-text-primary">{display}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="accent-accent" />
    </label>
  );
}
