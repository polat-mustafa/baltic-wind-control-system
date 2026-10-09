/**
 * AEP Explainer — "What is AEP and why does it matter?" in five animated steps.
 *
 *   1 Wind      hours per year in each wind-speed bin (Weibull A, k)
 *   2 Turbine   V236 power curve: cut-in, P ∝ v³, rated, cut-out
 *   3 Energy    energy = hours × power → gross AEP
 *   4 Losses    multiplicative cascade gross → net
 *   5 Certainty P50 / P90 bell curve and what it means in €
 *
 * All numbers are computed live from utils/aepMath (mirrors the backend) and
 * the Weibull sliders are the same store values that drive "Run Analysis".
 * If the analysis has run, step 4 uses its real loss factors.
 */

import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useElementWidth } from "../../hooks/useElementWidth";

import { useWindResourceStore } from "../../store/windResourceStore";
import {
  exceedance,
  grossTurbineMWh,
  lossCascade,
  rss,
  speedBins,
  UNCERTAINTY_SOURCES,
  weibullMean,
  Z,
} from "../../utils/aepMath";
import { V236, turbinePowerMW } from "../../utils/landingPhysics";

const N_TURBINES = 34;
const W = 600;
const H = 250;
const PAD = { l: 52, r: 16, t: 16, b: 40 };
const PW = W - PAD.l - PAD.r;
const PH = H - PAD.t - PAD.b;
const EASE = [0.22, 1, 0.36, 1] as const;

const C = {
  wind: "#5cc3d2",
  power: "#4cc38a",
  energy: "#f0b13e",
  loss: "#f25c54",
  net: "#4cc38a",
  muted: "var(--color-border-secondary)",
  text: "var(--color-text-secondary)",
  strong: "var(--color-text-primary)",
};

/** Illustrative losses when no analysis has run (backend defaults, typical wake/blockage). */
const DEFAULT_LOSSES: [string, number][] = [
  ["wake", 9.0],
  ["blockage", 2.0],
  ["electrical", 2.0],
  ["availability", 5.0],
  ["environmental", 1.0],
];

/** Waterfall labels for narrow charts. */
const SHORT: Record<string, string> = {
  blockage: "block.",
  electrical: "elec.",
  availability: "avail.",
  environmental: "env.",
  "Net P50": "Net",
};

const STEPS = ["Wind", "Turbine", "Energy", "Losses", "Certainty"] as const;

// ── Small SVG helpers ─────────────────────────────────────────────

function Axes({ xLabel, yLabel, yMax, yFmt = (v: number) => v.toFixed(0), xTicks }: {
  xLabel: string;
  yLabel: string;
  yMax: number;
  yFmt?: (v: number) => string;
  xTicks: { x: number; label: string }[];
}) {
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * yMax);
  return (
    <g fill={C.text} fontFamily="'IBM Plex Mono', monospace">
      {yTicks.map((v) => {
        const y = PAD.t + PH - (v / yMax) * PH;
        return (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke={C.muted} strokeOpacity={0.5} />
            <text x={PAD.l - 6} y={y + 4} textAnchor="end">{yFmt(v)}</text>
          </g>
        );
      })}
      {xTicks.map((t) => (
        <text key={t.label} x={t.x} y={H - PAD.b + 16} textAnchor="middle">{t.label}</text>
      ))}
      <text x={PAD.l + PW / 2} y={H - 4} textAnchor="middle" fontFamily="Inter, sans-serif">{xLabel}</text>
      <text transform={`translate(12 ${PAD.t + PH / 2}) rotate(-90)`} textAnchor="middle" fontFamily="Inter, sans-serif">{yLabel}</text>
    </g>
  );
}

/** Round an axis maximum up to 4 × a nice step (1, 2, 2.5, 5 × 10ⁿ). */
const niceMax = (v: number) => {
  const raw = (v * 1.08) / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((f) => f * mag).find((x) => x >= raw) ?? 10 * mag;
  return step * 4;
};

const xOf = (v: number, vMax: number) => PAD.l + (v / vMax) * PW;
const yOf = (val: number, yMax: number) => PAD.t + PH - (val / yMax) * PH;

function Bars({ values, vMax, yMax, color, opacity = 1, delayStep = 0.015 }: {
  values: { v: number; y: number }[];
  vMax: number;
  yMax: number;
  color: string | ((v: number) => string);
  opacity?: number;
  delayStep?: number;
}) {
  const bw = (PW / (vMax + 1)) * 0.8;
  return (
    <>
      {values.map(({ v, y }, i) => {
        const h = (y / yMax) * PH;
        return (
          <motion.rect
            key={v}
            x={xOf(v, vMax + 1) + (PW / (vMax + 1) - bw) / 2}
            width={bw}
            rx={2}
            fill={typeof color === "function" ? color(v) : color}
            fillOpacity={opacity}
            initial={{ y: PAD.t + PH, height: 0 }}
            animate={{ y: PAD.t + PH - h, height: h }}
            transition={{ duration: 0.6, ease: EASE, delay: i * delayStep }}
          >
            <title>{`${v} m/s: ${y.toFixed(y < 10 ? 1 : 0)}`}</title>
          </motion.rect>
        );
      })}
    </>
  );
}

function Stat({ label, value, unit, tone = "text-text-primary" }: { label: string; value: string; unit?: string; tone?: string }) {
  return (
    <div className="rounded-md border border-border-primary bg-bg-primary/60 px-3 py-2">
      <div className="text-xs text-text-muted">{label}</div>
      <div className={`font-mono text-base font-semibold tabular-nums ${tone}`}>
        {value} {unit && <span className="text-xs font-normal text-text-muted">{unit}</span>}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────

export default function AEPExplainer() {
  const { weibullA, weibullK, priceEurMwh, setWeibullA, setWeibullK, aepCascade } = useWindResourceStore();
  const [step, setStep] = useState(0);
  const [chartRef, chartWidth] = useElementWidth<HTMLDivElement>();
  // SVG text is in viewBox units: grow it as the chart shrinks so it stays ≈ 11 px on screen
  const fs = chartWidth ? Math.min(17, Math.max(11, (11 * W) / chartWidth)) : 11;
  const [playing, setPlaying] = useState(false);
  const [sigmaPct, setSigmaPct] = useState(() => rss(UNCERTAINTY_SOURCES.map(([, s]) => s)));

  useEffect(() => {
    if (!playing) return;
    const id = setTimeout(() => setStep((s) => (s + 1) % STEPS.length), 7000);
    return () => clearTimeout(id);
  }, [playing, step]);

  const m = useMemo(() => {
    const bins = speedBins(weibullA, weibullK, 30);
    const turbineGWh = grossTurbineMWh(weibullA, weibullK) / 1000;
    const grossGWh = turbineGWh * N_TURBINES;
    const totalE = bins.reduce((s, b) => s + b.energyMWh, 0);
    const modeBin = bins.reduce((a, b) => (b.hours > a.hours ? b : a));
    const peakEBin = bins.reduce((a, b) => (b.energyMWh > a.energyMWh ? b : a));
    const aboveRatedShare = bins.filter((b) => b.v >= 12).reduce((s, b) => s + b.energyMWh, 0) / totalE;
    const hoursBelowCutIn = bins.filter((b) => b.v < V236.cutInMs).reduce((s, b) => s + b.hours, 0);
    const hoursAtRated = bins.filter((b) => b.v >= 12 && b.v <= V236.cutOutMs).reduce((s, b) => s + b.hours, 0);
    return { bins, turbineGWh, grossGWh, modeBin, peakEBin, aboveRatedShare, hoursBelowCutIn, hoursAtRated };
  }, [weibullA, weibullK]);

  const fromAnalysis = aepCascade !== null;
  const losses: [string, number][] = aepCascade
    ? aepCascade.loss_factors.map((lf) => [lf.name, lf.loss_percent])
    : DEFAULT_LOSSES;
  const gross = aepCascade ? aepCascade.gross_aep_gwh : m.grossGWh;
  const cascade = lossCascade(gross, losses);
  const net = cascade[cascade.length - 1].after;
  const p90 = exceedance(net, sigmaPct, Z.P90);
  const meur = (gwh: number) => (gwh * priceEurMwh) / 1000;

  return (
    <MotionConfig reducedMotion="user">
      <section className="rounded-lg border border-border-primary bg-bg-secondary shadow-lg shadow-black/20 overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-text-primary">What is AEP — and why does it matter?</h3>
            <p className="text-xs text-text-muted mt-0.5 max-w-3xl">
              Annual Energy Production is the energy a farm delivers to the grid in an average year [GWh/yr]. It sets
              the revenue, the size of the bank loan and the cost per MWh — a 1 % AEP error on this farm is{" "}
              <b className="text-text-secondary font-mono">≈ {meur(net * 0.01).toFixed(1)} M€/yr</b>.
            </p>
          </div>
          <button
            onClick={() => setPlaying((p) => !p)}
            className="flex items-center gap-1.5 rounded-md border border-border-primary px-2.5 py-1 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
          >
            {playing ? <Pause size={12} /> : <Play size={12} />} {playing ? "Pause tour" : "Play tour"}
          </button>
        </div>

        {/* Stepper */}
        <div className="flex gap-1 overflow-x-auto px-4 mt-3" role="tablist">
          {STEPS.map((s, i) => (
            <button
              key={s}
              role="tab"
              aria-selected={step === i}
              onClick={() => { setStep(i); setPlaying(false); }}
              className={`relative flex items-center gap-2 rounded-md px-3 py-1.5 text-xs whitespace-nowrap transition-colors ${
                step === i ? "bg-accent/15 text-text-primary" : "text-text-muted hover:text-text-secondary"
              }`}
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-mono ${
                i <= step ? "bg-accent text-accent-ink" : "bg-bg-tertiary"
              }`}>{i + 1}</span>
              {s}
              {step === i && playing && (
                <motion.span
                  className="absolute bottom-0 left-0 h-0.5 bg-accent"
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 7, ease: "linear" }}
                />
              )}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-4 p-4">
          {/* Chart */}
          <div ref={chartRef} className="rounded-md bg-bg-primary/60 border border-border-primary p-2">
            <AnimatePresence mode="wait">
              <motion.svg
                key={step}
                viewBox={`0 0 ${W} ${H}`}
                className="w-full h-auto"
                style={{ fontSize: fs }}
                role="img"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                {step === 0 && (() => {
                  const yMax = niceMax(Math.max(...m.bins.map((b) => b.hours)));
                  return (
                    <>
                      <Axes xLabel="Wind speed at hub height [m/s]" yLabel="Hours per year" yMax={yMax}
                        xTicks={[0, 5, 10, 15, 20, 25, 30].map((v) => ({ x: xOf(v + 0.5, 31), label: `${v}` }))} />
                      <Bars values={m.bins.map((b) => ({ v: b.v, y: b.hours }))} vMax={30} yMax={yMax}
                        color={(v) => (v < V236.cutInMs ? C.muted : C.wind)} />
                      <line x1={xOf(weibullMean(weibullA, weibullK) + 0.5, 31)} x2={xOf(weibullMean(weibullA, weibullK) + 0.5, 31)}
                        y1={PAD.t} y2={PAD.t + PH} stroke={C.strong} strokeDasharray="4 4" />
                      <text x={xOf(weibullMean(weibullA, weibullK) + 0.5, 31) + 6} y={PAD.t + 12} fill={C.strong}>
                        mean {weibullMean(weibullA, weibullK).toFixed(1)} m/s
                      </text>
                    </>
                  );
                })()}

                {step === 1 && (() => {
                  const pts = Array.from({ length: 341 }, (_, i) => i / 10);
                  const d = pts.map((v, i) => `${i ? "L" : "M"}${xOf(v, 34).toFixed(1)},${yOf(turbinePowerMW(v), 16).toFixed(1)}`).join(" ");
                  const band = (a: number, b: number, fill: string, label: string) => (
                    <g>
                      <rect x={xOf(a, 34)} width={xOf(b, 34) - xOf(a, 34)} y={PAD.t} height={PH} fill={fill} fillOpacity={0.07} />
                      <text x={(xOf(a, 34) + xOf(b, 34)) / 2} y={PAD.t + 14} fill={C.text} textAnchor="middle">{label}</text>
                    </g>
                  );
                  return (
                    <>
                      {band(0, V236.cutInMs, "#ffffff", "idle")}
                      {band(V236.cutInMs, V236.ratedMs, C.power, "P ∝ v³")}
                      {band(V236.ratedMs, V236.cutOutMs, C.wind, "rated 15 MW (pitch control)")}
                      {band(V236.cutOutMs, 34, C.loss, "stop")}
                      <Axes xLabel="Wind speed [m/s]" yLabel="Electrical power [MW]" yMax={16}
                        xTicks={[0, V236.cutInMs, Number(V236.ratedMs.toFixed(1)), 20, V236.cutOutMs].map((v) => ({ x: xOf(v, 34), label: `${v}` }))} />
                      <motion.path d={d} fill="none" stroke={C.power} strokeWidth={2.5}
                        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.6, ease: "easeInOut" }} />
                    </>
                  );
                })()}

                {step === 2 && (() => {
                  const yMax = niceMax(Math.max(...m.bins.map((b) => b.energyMWh)));
                  const hMax = Math.max(...m.bins.map((b) => b.hours));
                  return (
                    <>
                      <Axes xLabel="Wind speed [m/s]" yLabel="Energy per turbine [MWh/yr]" yMax={yMax}
                        yFmt={(v) => (v / 1000).toFixed(v % 1000 ? 1 : 0) + "k"}
                        xTicks={[0, 5, 10, 15, 20, 25, 30].map((v) => ({ x: xOf(v + 0.5, 31), label: `${v}` }))} />
                      {/* hours (ghost) scaled to the same height for shape comparison */}
                      <Bars values={m.bins.map((b) => ({ v: b.v, y: (b.hours / hMax) * yMax * 0.87 }))} vMax={30} yMax={yMax} color={C.wind} opacity={0.18} delayStep={0} />
                      <Bars values={m.bins.map((b) => ({ v: b.v, y: b.energyMWh }))} vMax={30} yMax={yMax} color={C.energy} delayStep={0.03} />
                    </>
                  );
                })()}

                {step === 3 && (() => {
                  const cols = [{ name: "Gross", top: gross, bottom: 0, color: C.wind },
                    ...cascade.map((c) => ({ name: c.name, top: c.after + c.lost, bottom: c.after, color: C.loss })),
                    { name: "Net P50", top: net, bottom: 0, color: C.net }];
                  const yMin = net * 0.8;
                  const yMax = gross * 1.06;
                  const y = (v: number) => PAD.t + PH - ((Math.max(v, yMin) - yMin) / (yMax - yMin)) * PH;
                  const cw = PW / cols.length;
                  return (
                    <>
                      <Axes xLabel="" yLabel="AEP [GWh/yr]" yMax={1} yFmt={(f) => (yMin + f * (yMax - yMin)).toFixed(0)} xTicks={[]} />
                      {cols.map((c, i) => {
                        const x = PAD.l + i * cw + cw * 0.15;
                        return (
                          <g key={c.name}>
                            <motion.rect x={x} width={cw * 0.7} rx={2} fill={c.color}
                              initial={{ y: y(c.top), height: 0, opacity: 0 }}
                              animate={{ y: y(c.top), height: y(c.bottom) - y(c.top), opacity: 1 }}
                              transition={{ duration: 0.5, delay: i * 0.35, ease: EASE }} />
                            <motion.text x={x + cw * 0.35} y={y(c.top) - 5} fill={C.strong} textAnchor="middle"
                              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.35 + 0.3 }}>
                              {i === 0 || i === cols.length - 1 ? c.top.toFixed(0) : `−${(c.top - c.bottom).toFixed(0)}`}
                            </motion.text>
                            <text x={x + cw * 0.35} y={H - PAD.b + 16} fill={C.text} textAnchor="middle">{fs > 13 ? (SHORT[c.name] ?? c.name) : c.name}</text>
                          </g>
                        );
                      })}
                    </>
                  );
                })()}

                {step === 4 && (() => {
                  const s = (net * sigmaPct) / 100;
                  const lo = net - 3.5 * s;
                  const hi = net + 3.5 * s;
                  const x = (v: number) => PAD.l + ((v - lo) / (hi - lo)) * PW;
                  const pdf = (v: number) => Math.exp(-0.5 * ((v - net) / s) ** 2);
                  const pts = Array.from({ length: 201 }, (_, i) => lo + (i / 200) * (hi - lo));
                  const yv = (v: number) => PAD.t + PH - pdf(v) * PH * 0.9;
                  const curve = pts.map((v, i) => `${i ? "L" : "M"}${x(v).toFixed(1)},${yv(v).toFixed(1)}`).join(" ");
                  const shaded = pts.filter((v) => v >= p90);
                  const area = `M${x(p90)},${PAD.t + PH} ` + shaded.map((v) => `L${x(v).toFixed(1)},${yv(v).toFixed(1)}`).join(" ") + ` L${x(hi)},${PAD.t + PH} Z`;
                  const marker = (v: number, label: string, color: string) => (
                    <g>
                      <line x1={x(v)} x2={x(v)} y1={PAD.t} y2={PAD.t + PH} stroke={color} strokeDasharray="4 3" />
                      <text x={x(v)} y={PAD.t + 10} fill={color} textAnchor="middle">{label}</text>
                    </g>
                  );
                  return (
                    <>
                      <Axes xLabel="Long-term net AEP [GWh/yr]" yLabel="Likelihood" yMax={1} yFmt={() => ""}
                        xTicks={[lo + s, net, hi - s].map((v) => ({ x: x(v), label: v.toFixed(0) }))} />
                      <motion.path d={area} fill={C.power} fillOpacity={0.18} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} />
                      <motion.path d={curve} fill="none" stroke={C.power} strokeWidth={2.5}
                        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2 }} />
                      {marker(net, "P50", C.strong)}
                      {marker(p90, "P90", C.energy)}
                      <text x={(x(p90) + x(hi)) / 2} y={PAD.t + PH * 0.75} fill={C.power} textAnchor="middle">90 % of outcomes</text>
                    </>
                  );
                })()}
              </motion.svg>
            </AnimatePresence>
          </div>

          {/* Explanation + controls */}
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.25 }} className="flex flex-col gap-3 text-sm text-text-secondary">
              {step === 0 && (
                <>
                  <p><b className="text-text-primary">Wind is a distribution, not a number.</b> A year has 8 760 hours; the Weibull curve says how many of them blow at each speed. Two parameters describe it: scale <i>A</i> (how windy) and shape <i>k</i> (how steady).</p>
                  <Slider label="Weibull A (scale)" unit="m/s" value={weibullA} min={7} max={13} step={0.1} onChange={setWeibullA} />
                  <Slider label="Weibull k (shape)" unit="" value={weibullK} min={1.5} max={3.2} step={0.05} onChange={setWeibullK} />
                  <div className="grid grid-cols-2 gap-2">
                    <Stat label="Most frequent speed" value={`${m.modeBin.v}`} unit="m/s" />
                    <Stat label="Hours below cut-in (3 m/s)" value={m.hoursBelowCutIn.toFixed(0)} unit="h/yr" />
                  </div>
                  <p className="text-xs text-text-muted">These sliders also set the inputs for <i>Run Analysis</i>.</p>
                </>
              )}
              {step === 1 && (
                <>
                  <p><b className="text-text-primary">The turbine turns wind into power — non-linearly.</b> Wind power through the rotor is ½ρAv³: double the speed, eight times the power. The SB-510 turbine starts at 3 m/s, reaches 15 MW at {V236.ratedMs.toFixed(1)} m/s, then pitches its blades to hold 15 MW, and shuts down above {V236.cutOutMs} m/s to protect itself.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Stat label="Rotor swept area" value="43 744" unit="m²" />
                    <Stat label="Cp at rated (electrical)" value="0.41" unit="< Betz 0.593" />
                  </div>
                  <p className="text-xs text-text-muted">Curve: the IEA 15 MW reference turbine (IEA Wind Task 37, Apache-2.0) — the same table the backend wake model uses. SB-510 is a “V236 class” farm; Vestas publishes no V236 curve.</p>
                </>
              )}
              {step === 2 && (
                <>
                  <p><b className="text-text-primary">Energy = hours × power</b>, summed over every speed. Because of the v³ law the energy peak sits well above the most frequent speed: the commonest wind ({m.modeBin.v} m/s) is not where the money is made — {m.peakEBin.v} m/s is.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Stat label="Gross per turbine" value={m.turbineGWh.toFixed(1)} unit="GWh/yr" tone="text-status-warning" />
                    <Stat label={`Gross farm (× ${N_TURBINES})`} value={m.grossGWh.toFixed(0)} unit="GWh/yr" tone="text-status-warning" />
                    <Stat label="Energy at full power (≥ 11.5 m/s)" value={(m.aboveRatedShare * 100).toFixed(0)} unit="%" />
                    <Stat label="Hours at full power (≥ 11.5 m/s)" value={m.hoursAtRated.toFixed(0)} unit="h/yr" />
                  </div>
                  <p className="text-xs text-text-muted">Faint bars = hours per year (shape only). Gross = before any wake or other loss.</p>
                </>
              )}
              {step === 3 && (
                <>
                  <p><b className="text-text-primary">Not all of it reaches the grid.</b> Turbines shade each other (wake), the farm slows the incoming wind (blockage), cables and transformers heat up, turbines are down for maintenance. Each loss acts on what is left — losses multiply, they don't add.</p>
                  <ul className="space-y-1 font-mono text-xs">
                    {cascade.map((c) => (
                      <li key={c.name} className="flex justify-between gap-2">
                        <span className="capitalize text-text-secondary">{c.name}</span>
                        <span className="tabular-nums text-text-primary">−{c.lossPct.toFixed(1)} % · −{c.lost.toFixed(0)} GWh</span>
                      </li>
                    ))}
                  </ul>
                  <Stat label="Net AEP (P50)" value={net.toFixed(0)} unit={`GWh/yr · CF ${((net / (N_TURBINES * 15 * 8.76)) * 100).toFixed(1)} %`} tone="text-status-success" />
                  <p className="text-xs text-text-muted">
                    {fromAnalysis ? "Loss factors from your last analysis run." : "Illustrative typical losses — press Run Analysis for this farm's PyWake values."} The chart's axis starts near net AEP to make small losses visible.
                  </p>
                </>
              )}
              {step === 4 && (
                <>
                  <p><b className="text-text-primary">P50 is a best guess; banks lend on P90.</b> Wind data, wake model, power curve… each carries uncertainty. Combined by root-sum-square, they give a spread around P50. P90 is the AEP exceeded with 90 % probability — the long-term value lenders size debt on (they also check a 1-year P90/P99 that adds year-to-year wind variability).</p>
                  <Slider label="Combined uncertainty σ" unit="%" value={sigmaPct} min={3} max={12} step={0.1} onChange={setSigmaPct} />
                  <div className="grid grid-cols-2 gap-2">
                    <Stat label="P50 revenue" value={meur(net).toFixed(1)} unit="M€/yr" />
                    <Stat label="P90 revenue" value={meur(p90).toFixed(1)} unit="M€/yr" tone="text-status-warning" />
                  </div>
                  <p className="text-xs text-text-muted">
                    P90 = P50 · (1 − 1.282·σ). Default σ = √(Σσᵢ²) of {UNCERTAINTY_SOURCES.length} sources = {rss(UNCERTAINTY_SOURCES.map(([, s]) => s)).toFixed(2)} %. Better measurements (LiDAR, longer data) shrink σ, lift P90 and the loan the project can raise. Price {priceEurMwh} €/MWh.
                  </p>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between border-t border-border-primary px-4 py-2">
          <button disabled={step === 0} onClick={() => setStep((s) => s - 1)}
            className="flex items-center gap-1 text-xs text-text-secondary disabled:opacity-30 hover:text-text-primary">
            <ChevronLeft size={14} /> Back
          </button>
          <span className="text-xs text-text-muted">Step {step + 1} of {STEPS.length}</span>
          <button disabled={step === STEPS.length - 1} onClick={() => setStep((s) => s + 1)}
            className="flex items-center gap-1 text-xs text-text-secondary disabled:opacity-30 hover:text-text-primary">
            Next <ChevronRight size={14} />
          </button>
        </div>
      </section>
    </MotionConfig>
  );
}

function Slider({ label, unit, value, min, max, step, onChange }: {
  label: string; unit: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex justify-between text-xs">
        <span className="text-text-muted">{label}</span>
        <span className="font-mono text-text-primary tabular-nums">{value.toFixed(step < 0.1 ? 2 : 1)} {unit}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(e.target.valueAsNumber)} className="w-full accent-(--color-accent)" />
    </label>
  );
}
