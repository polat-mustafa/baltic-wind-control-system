/**
 * Colour bar + live read-out for the Blade Analysis overlay
 * (model/bladeField, published by hooks/useBladeField).
 */

import { useLandingStore } from "../../../../store/landingStore";
import { useBladeFieldSummary } from "../hooks/useBladeField";
import { FIELD_RANGE, scaleGradientCss, unitToField, type FieldSummary } from "../model/bladeField";

const TITLE: Record<FieldSummary["mode"], string> = {
  thermal: "Blade surface temperature — aerodynamic heating",
  pressure: "Blade surface pressure p − p∞",
  bending: "Flapwise bending moment",
};

const NOTE: Record<FieldSummary["mode"], string> = {
  thermal: "T = T_air + r·W²/2cp · r = 1 at the LE stagnation line, 0.89 aft · no solar gain",
  pressure: "Cp·½ρW² · thin-airfoil loading + thickness · suction side (downwind) blue; pressure side near p∞ with the red stagnation line at the LE",
  bending: "Thrust/3 per blade, load ∝ r · M(r) = k(R³/3 − rR²/2 + r³/6)",
};

const fmt = (v: number, d = 1) => `${v >= 0 ? "" : "−"}${Math.abs(v).toFixed(d)}`;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-text-muted">{label}</span>
      <span className="tabular-nums text-text-primary">{value}</span>
    </div>
  );
}

export function BladeFieldLegend() {
  const s = useBladeFieldSummary((st) => st.summary);
  const airC = useLandingStore((st) => st.environment.airTemperatureC);
  if (!s) return null;
  const range = FIELD_RANGE[s.mode];
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => unitToField(s.mode, t));
  const tick = (v: number) => {
    const d = Math.abs(v) < 10 && v !== Math.round(v) ? 1 : 0;
    return `${v > 0 && s.mode !== "bending" ? "+" : ""}${fmt(v, d)}`;
  };

  return (
    <div className="w-60 rounded-md border border-border-primary bg-bg-secondary/90 px-2.5 py-1.5 font-mono text-[10px] shadow backdrop-blur-sm">
      <div className="mb-1 text-[11px] font-bold text-text-primary">{TITLE[s.mode]}</div>
      <div className="h-2.5 w-full rounded-sm" style={{ background: scaleGradientCss(s.mode) }} />
      <div className="flex justify-between text-text-secondary">
        {ticks.map((v, i) => (
          <span key={i}>{tick(v)}</span>
        ))}
      </div>
      <div className="text-right text-[9px] text-text-muted">
        {range.unit}
        {s.mode === "thermal" ? " above air" : ""}
        {range.sqrt ? " · √ scale" : ""}
      </div>
      <div className="mt-1 space-y-0.5">
        {s.mode === "thermal" && (
          <>
            <Row label="Air" value={`${airC.toFixed(1)} °C`} />
            <Row label="Tip LE" value={`+${s.tip.toFixed(2)} K → ${(airC + s.tip).toFixed(1)} °C`} />
            <Row label="Tip rel. wind W" value={`${s.tipWindMs.toFixed(0)} m/s`} />
          </>
        )}
        {s.mode === "pressure" && (
          <>
            <Row label="Suction peak" value={`${fmt(s.min, 1)} kPa`} />
            <Row label="Max (stagnation)" value={`+${s.max.toFixed(1)} kPa`} />
            <Row label="Tip q = ½ρW²" value={`${s.tip.toFixed(1)} kPa`} />
            <Row label="α at 75 % R" value={`${fmt(s.alpha75Deg, 1)}°`} />
          </>
        )}
        {s.mode === "bending" && (
          <>
            <Row label="Root M_flap" value={`${s.root.toFixed(1)} MN·m`} />
            <Row label="Tip" value="0 MN·m" />
          </>
        )}
      </div>
      <div className="mt-1 text-[9px] leading-tight text-text-muted">{NOTE[s.mode]}</div>
    </div>
  );
}
