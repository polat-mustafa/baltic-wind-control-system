/**
 * Live analytics next to the 3D turbine — three engineering views of the same
 * simulated SCADA stream:
 *
 *   Trends       small multiples over the last 10 min (5 s tick): active
 *                power, hub wind vs free stream, rotor speed, pitch, yaw error
 *                with the ±45° yaw-stop band. One y-scale per chart (no dual
 *                axes); a shared time cursor on hover reads every row at once.
 *   Power curve  the V236 curve with regions I / II / III, the recent
 *                operating points and the live one, plus Cp(U) with Betz.
 *                Points below the curve are wake, yaw or reserve losses.
 *   Losses       waterfall from the free wind's kinetic power to MW at
 *                66 kV (model/lossWaterfall — closes on the SCADA value).
 *
 * Plain SVG, theme tokens for ink, grid and surfaces; series colours from
 * .bw-viz (index.css), validated categorical slots 1–2.
 */

import { memo, useState, type ReactNode } from "react";
import { X } from "lucide-react";

import { YAW_PAUSE_DEG, selectKPIs, selectTurbine, useLandingStore } from "../../../../store/landingStore";
import { V236, v236PowerChain, turbinePowerMW, v236RotorRpm } from "../../../../utils/landingPhysics";
import { cn } from "../../../../lib/utils";
import { HISTORY_SAMPLES, useTurbineHistory, type Sample } from "../hooks/useTurbineHistory";
import { discPowerMW, lossWaterfall } from "../model/lossWaterfall";

type Tab = "trends" | "curve" | "losses";

const W = 372;
const ML = 38; // left margin (y ticks)
const MR = 12;
const PW = W - ML - MR;
const TICK_S = 5;

export const AnalyticsPanel = memo(function AnalyticsPanel({
  turbineId,
  onClose,
}: {
  turbineId: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("trends");
  const turbine = useLandingStore(selectTurbine(turbineId));
  const kpis = useLandingStore(selectKPIs);
  const { samples, version } = useTurbineHistory(turbineId);
  if (!turbine) return null;
  const yawErr = ((turbine.nacellePositionDeg - kpis.windDirectionDeg + 540) % 360) - 180;

  return (
    <div className="bw-viz pointer-events-auto w-[396px] max-w-full rounded-lg border border-border-primary bg-bg-secondary/95 text-text-primary shadow-xl backdrop-blur">
      <div className="flex items-center gap-2 border-b border-border-primary px-3 py-1.5">
        <div className="text-[12px] font-bold">Live analytics · {turbineId}</div>
        <div className="ml-auto flex overflow-hidden rounded border border-border-primary text-[11px] font-semibold" role="tablist">
          {(
            [
              ["trends", "Trends"],
              ["curve", "Power curve"],
              ["losses", "Losses"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                "px-2 py-0.5",
                tab === id ? "bg-accent text-white" : "text-text-secondary hover:bg-bg-hover",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <button type="button" onClick={onClose} className="rounded p-0.5 hover:bg-bg-hover" aria-label="Close analytics">
          <X size={13} />
        </button>
      </div>
      <div className="px-2 pb-2 pt-1">
        {tab === "trends" && <Trends samples={samples} version={version} />}
        {tab === "curve" && (
          <PowerCurve samples={samples} version={version} windMs={turbine.windSpeedMs} powerMW={turbine.powerOutputMW} rpm={turbine.rotorSpeedRpm} />
        )}
        {tab === "losses" && (
          <Losses
            freeWindMs={kpis.freestreamWindMs}
            windMs={turbine.windSpeedMs}
            yawErrDeg={yawErr}
            powerMW={turbine.powerOutputMW}
            rpm={turbine.rotorSpeedRpm}
          />
        )}
      </div>
    </div>
  );
});

// ── Trends ────────────────────────────────────────────────────────────

interface Row {
  title: string;
  unit: string;
  min: number;
  max: number;
  ticks: number[];
  get: (s: Sample) => number;
  second?: { label: string; get: (s: Sample) => number };
  ref?: { v: number; label: string };
  band?: { lo: number; hi: number; label: string };
  digits: number;
}

const ROWS: Row[] = [
  { title: "Active power", unit: "MW", min: 0, max: 16, ticks: [0, 5, 10, 15], get: (s) => s.powerMW, ref: { v: V236.ratedMW, label: "rated" }, digits: 2 },
  {
    title: "Wind at hub",
    unit: "m/s",
    min: 0,
    max: 20,
    ticks: [0, 10, 20],
    get: (s) => s.windMs,
    second: { label: "free stream", get: (s) => s.freeWindMs },
    ref: { v: V236.ratedMs, label: "rated" },
    digits: 1,
  },
  { title: "Rotor speed", unit: "rpm", min: 0, max: 10, ticks: [0, 4, 8], get: (s) => s.rotorRpm, ref: { v: V236.ratedRpm, label: "rated" }, digits: 2 },
  { title: "Pitch", unit: "°", min: 0, max: 50, ticks: [0, 25, 50], get: (s) => s.pitchDeg, digits: 1 },
  {
    title: "Yaw error",
    unit: "°",
    min: -90,
    max: 90,
    ticks: [-45, 0, 45],
    get: (s) => s.yawErrDeg,
    band: { lo: -YAW_PAUSE_DEG, hi: YAW_PAUSE_DEG, label: "production" },
    digits: 0,
  },
];
const RH = 52; // row height incl. title
const PH = 34; // plot height

function Trends({ samples, version }: { samples: readonly Sample[]; version: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const n = samples.length;
  const xOf = (i: number) => ML + (PW * (HISTORY_SAMPLES - n + i)) / (HISTORY_SAMPLES - 1);
  // ≤ 120 points × 5 rows: rebuilt on each render (version bumps once per tick)
  void version;
  const paths = ROWS.map((r) => {
    const y = (v: number) => PH - ((Math.min(r.max, Math.max(r.min, v)) - r.min) / (r.max - r.min)) * PH;
    const line = (get: (s: Sample) => number) =>
      samples.map((s, i) => `${i ? "L" : "M"}${xOf(i).toFixed(1)},${y(get(s)).toFixed(1)}`).join("");
    return { y, main: line(r.get), second: r.second ? line(r.second.get) : null };
  });
  const hi = hover ?? n - 1;
  const cur = samples[hi];
  const H = ROWS.length * RH + 16;

  if (n < 2) {
    return <div className="px-2 py-6 text-center text-[12px] font-semibold text-text-muted">Collecting SCADA samples… (5 s tick)</div>;
  }
  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        onMouseMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - box.left) / box.width) * W;
          const i = Math.round(((x - ML) / PW) * (HISTORY_SAMPLES - 1)) - (HISTORY_SAMPLES - n);
          setHover(i >= 0 && i < n ? i : null);
        }}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label="Trends of power, wind, rotor speed, pitch and yaw error over the last 10 minutes"
      >
        {ROWS.map((r, k) => {
          const p = paths[k];
          const v = cur ? r.get(cur) : 0;
          return (
            <g key={r.title} transform={`translate(0 ${k * RH})`}>
              <text x={ML} y={10} fontSize={10.5} fontWeight={700} style={{ fill: "var(--color-text-primary)" }}>
                {r.title}
                {r.second && (
                  <tspan fontWeight={600} style={{ fill: "var(--color-text-muted)" }}>
                    {"  "}— hub{"   "}┄ {r.second.label}
                  </tspan>
                )}
              </text>
              <text x={W - MR} y={10} fontSize={11} fontWeight={800} textAnchor="end" style={{ fill: "var(--color-text-primary)" }}>
                {(Number(v.toFixed(r.digits)) || 0).toFixed(r.digits)} {r.unit}
              </text>
              <g transform="translate(0 14)">
                {r.band && (
                  <rect x={ML} width={PW} y={p.y(r.band.hi)} height={p.y(r.band.lo) - p.y(r.band.hi)}
                    style={{ fill: "var(--color-status-normal)", opacity: 0.1 }} />
                )}
                {r.ticks.map((t) => (
                  <g key={t}>
                    <line x1={ML} x2={W - MR} y1={p.y(t)} y2={p.y(t)} style={{ stroke: "var(--color-border-primary)" }} strokeOpacity={0.35} strokeWidth={0.6} />
                    <text x={ML - 4} y={p.y(t) + 3} fontSize={9} textAnchor="end" style={{ fill: "var(--color-text-muted)" }}>
                      {t}
                    </text>
                  </g>
                ))}
                {r.ref && (
                  <line x1={ML} x2={W - MR} y1={p.y(r.ref.v)} y2={p.y(r.ref.v)} style={{ stroke: "var(--color-text-muted)" }} strokeDasharray="3 3" strokeWidth={0.8} />
                )}
                {p.second && <path d={p.second} fill="none" style={{ stroke: "var(--viz-2)" }} strokeWidth={1.5} strokeDasharray="4 3" />}
                <path d={p.main} fill="none" style={{ stroke: "var(--viz-1)" }} strokeWidth={2} strokeLinejoin="round" />
                {cur && <circle cx={xOf(hi)} cy={p.y(r.get(cur))} r={3} style={{ fill: "var(--viz-1)", stroke: "var(--color-bg-secondary)" }} strokeWidth={1.5} />}
              </g>
            </g>
          );
        })}
        {/* time axis */}
        {[0, 5, 10].map((m) => {
          const x = ML + PW * (1 - (m * 60) / (TICK_S * (HISTORY_SAMPLES - 1)));
          return (
            <text key={m} x={x} y={H - 3} fontSize={9} textAnchor={m === 0 ? "end" : "middle"} style={{ fill: "var(--color-text-muted)" }}>
              {m === 0 ? "now" : `−${m} min`}
            </text>
          );
        })}
        {hover !== null && (
          <line x1={xOf(hover)} x2={xOf(hover)} y1={12} y2={H - 14} style={{ stroke: "var(--color-text-secondary)" }} strokeWidth={0.8} />
        )}
      </svg>
      {hover !== null && cur && (
        <div className="pointer-events-none absolute left-11 top-0 rounded border border-border-primary bg-bg-elevated px-1.5 py-0.5 font-mono text-[10px] font-semibold text-text-secondary shadow">
          {Math.round((cur.t - samples[n - 1].t) / 1000)} s · wind free {cur.freeWindMs.toFixed(1)} m/s
        </div>
      )}
    </div>
  );
}

// ── Power curve + Cp ─────────────────────────────────────────────────

const U_MAX = 32;
const H1 = 150;
const H2 = 70;
const x = (u: number) => ML + (Math.min(u, U_MAX) / U_MAX) * PW;
const yP = (p: number) => 8 + H1 - (p / 16) * H1;
const yC = (c: number) => H1 + 40 + H2 - (c / 0.6) * H2;

/** Static V236 P(U) and Cp(U) paths (utils/landingPhysics). */
const CURVES = (() => {
  let p = "";
  let c = "";
  for (let u = 0; u <= U_MAX; u += 0.25) {
    const pm = turbinePowerMW(u);
    p += `${u ? "L" : "M"}${x(u).toFixed(1)},${yP(pm).toFixed(1)}`;
    if (u >= V236.cutInMs && u <= V236.cutOutMs) {
      const cp = v236PowerChain(pm, u, v236RotorRpm(u)).cp;
      c += `${c ? "L" : "M"}${x(u).toFixed(1)},${yC(cp).toFixed(1)}`;
    }
  }
  return { p, c };
})();

function PowerCurve({
  samples, version, windMs, powerMW, rpm,
}: { samples: readonly Sample[]; version: number; windMs: number; powerMW: number; rpm: number }) {
  const curves = CURVES;
  void version;
  const pts = samples.slice(-60);
  const cpNow = v236PowerChain(powerMW, windMs, rpm).cp;
  const lambda = windMs > 0.5 ? ((rpm * 2 * Math.PI) / 60) * 118 / windMs : 0;
  const regions: [number, number, string][] = [
    [0, V236.cutInMs, ""],
    [V236.cutInMs, V236.ratedMs, "II · max Cp"],
    [V236.ratedMs, V236.cutOutMs, "III · rated, pitch control"],
  ];
  const Hsvg = H1 + H2 + 64;
  return (
    <svg viewBox={`0 0 ${W} ${Hsvg}`} className="w-full" role="img" aria-label="V236 power curve with operating points and Cp curve">
      {regions.map(([a, b, l], i) => (
        <g key={a}>
          <rect x={x(a)} width={x(b) - x(a)} y={8} height={H1} style={{ fill: "var(--color-bg-tertiary)" }} opacity={i % 2 ? 0.25 : 0.55} />
          {l && (
            <text x={i === 1 ? x(a) + 4 : (x(a) + x(b)) / 2} y={yP(i === 1 ? 13 : 7)} fontSize={9.5} fontWeight={700}
              textAnchor={i === 1 ? "start" : "middle"} style={{ fill: "var(--color-text-muted)" }}>
              {l}
            </text>
          )}
        </g>
      ))}
      {[0, 5, 10, 15].map((p) => (
        <g key={p}>
          <line x1={ML} x2={W - MR} y1={yP(p)} y2={yP(p)} style={{ stroke: "var(--color-border-primary)" }} strokeOpacity={0.35} strokeWidth={0.6} />
          <text x={ML - 4} y={yP(p) + 3} fontSize={9} textAnchor="end" style={{ fill: "var(--color-text-muted)" }}>{p}</text>
        </g>
      ))}
      <text x={4} y={12} fontSize={10} fontWeight={700} style={{ fill: "var(--color-text-primary)" }}>P [MW]</text>
      <path d={curves.p} fill="none" style={{ stroke: "var(--color-text-secondary)" }} strokeWidth={2} />
      {pts.map((s, i) => (
        <circle key={s.t} cx={x(s.windMs)} cy={yP(s.powerMW)} r={2.6}
          style={{ fill: Math.abs(s.yawErrDeg) > YAW_PAUSE_DEG ? "var(--color-status-warning)" : "var(--viz-1)" }}
          opacity={0.2 + (0.6 * i) / Math.max(1, pts.length - 1)}>
          <title>{`${s.windMs.toFixed(1)} m/s → ${s.powerMW.toFixed(2)} MW`}</title>
        </circle>
      ))}
      <line x1={x(windMs)} x2={x(windMs)} y1={yP(powerMW)} y2={8 + H1} style={{ stroke: "var(--viz-1)" }} strokeDasharray="2 2" strokeWidth={1} />
      <circle cx={x(windMs)} cy={yP(powerMW)} r={5.5} style={{ fill: "var(--viz-1)", stroke: "var(--color-bg-secondary)" }} strokeWidth={2} />
      <text x={Math.min(x(windMs) + 8, W - 150)} y={Math.max(yP(powerMW) - 8, 30)} fontSize={10.5} fontWeight={800} style={{ fill: "var(--color-text-primary)" }}>
        {powerMW.toFixed(2)} MW @ {windMs.toFixed(1)} m/s
      </text>
      {/* Cp(U) */}
      <text x={4} y={H1 + 34} fontSize={10} fontWeight={700} style={{ fill: "var(--color-text-primary)" }}>
        Cp — now {cpNow.toFixed(3)} · λ {lambda.toFixed(1)}
      </text>
      {[0, 0.3, 0.593].map((c) => (
        <g key={c}>
          <line x1={ML} x2={W - MR} y1={yC(c)} y2={yC(c)} style={{ stroke: c === 0.593 ? "var(--color-text-muted)" : "var(--color-border-primary)" }}
            strokeOpacity={c === 0.593 ? 1 : 0.35} strokeDasharray={c === 0.593 ? "4 3" : undefined} strokeWidth={0.7} />
          <text x={ML - 4} y={yC(c) + 3} fontSize={9} textAnchor="end" style={{ fill: "var(--color-text-muted)" }}>{c === 0.593 ? "Betz" : c}</text>
        </g>
      ))}
      <path d={curves.c} fill="none" style={{ stroke: "var(--color-text-secondary)" }} strokeWidth={1.6} />
      <circle cx={x(windMs)} cy={yC(cpNow)} r={4.5} style={{ fill: "var(--viz-1)", stroke: "var(--color-bg-secondary)" }} strokeWidth={1.5} />
      {[0, 5, 10, 15, 20, 25, 30].map((u) => (
        <text key={u} x={x(u)} y={Hsvg - 12} fontSize={9} textAnchor="middle" style={{ fill: "var(--color-text-muted)" }}>{u}</text>
      ))}
      <text x={W - MR} y={Hsvg - 1} fontSize={9.5} fontWeight={700} textAnchor="end" style={{ fill: "var(--color-text-muted)" }}>
        hub wind U [m/s] · dots: last 5 min{pts.some((s) => Math.abs(s.yawErrDeg) > YAW_PAUSE_DEG) ? " · amber = yaw stop" : ""}
      </text>
    </svg>
  );
}

// ── Loss waterfall ───────────────────────────────────────────────────

const STEP_TONE: Record<string, string> = {
  wake: "var(--viz-2)",
  yaw: "var(--color-status-warning)",
  aero: "var(--viz-3)",
};

function Losses({
  freeWindMs, windMs, yawErrDeg, powerMW, rpm,
}: { freeWindMs: number; windMs: number; yawErrDeg: number; powerMW: number; rpm: number }) {
  const steps = lossWaterfall({
    freeWindMs,
    windMs,
    yawErrDeg,
    yawPaused: Math.abs(yawErrDeg) > YAW_PAUSE_DEG,
    powerMW,
    rotorRpm: rpm,
  });
  const top = steps[0].levelMW || 1;
  const LBL = 118;
  const BW = W - LBL - 78;
  const bx = (mw: number) => LBL + (mw / top) * BW;
  const RH2 = 21;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${steps.length * RH2 + 18}`} className="w-full" role="img" aria-label="Energy conversion waterfall from free wind to grid power">
        {steps.map((s, i) => {
          const y = 4 + i * RH2;
          const endpoint = s.key === "free" || s.key === "grid";
          const x0 = endpoint ? bx(0) : bx(s.levelMW);
          const x1 = endpoint ? bx(s.levelMW) : bx(s.levelMW + s.lossMW);
          const tone = endpoint ? "var(--viz-1)" : (STEP_TONE[s.key] ?? "var(--color-text-muted)");
          const value = endpoint ? s.levelMW : -s.lossMW;
          return (
            <g key={s.key}>
              <text x={LBL - 6} y={y + 12} fontSize={10.5} fontWeight={endpoint ? 800 : 600} textAnchor="end" style={{ fill: "var(--color-text-primary)" }}>
                {s.label}
              </text>
              <rect x={x0} y={y + 3} width={Math.max(1.5, x1 - x0)} height={RH2 - 7} rx={2} style={{ fill: tone }} opacity={endpoint ? 1 : 0.85}>
                <title>{`${s.label}: ${value.toFixed(2)} MW (${((Math.abs(value) / top) * 100).toFixed(1)} % of free wind)`}</title>
              </rect>
              {i < steps.length - 1 && (
                <line x1={bx(s.levelMW)} x2={bx(s.levelMW)} y1={y + RH2 - 4} y2={y + RH2 + 3} style={{ stroke: "var(--color-text-muted)" }} strokeWidth={0.8} />
              )}
              <text x={W - 4} y={y + 12} fontSize={10.5} fontWeight={endpoint ? 800 : 600} textAnchor="end" className="tabular-nums" style={{ fill: "var(--color-text-primary)" }}>
                {endpoint ? `${value.toFixed(2)} MW` : value === 0 ? "—" : `${value.toFixed(2)}`}
                <tspan style={{ fill: "var(--color-text-muted)" }} fontSize={9}>{`  ${((Math.abs(value) / top) * 100).toFixed(1)}%`}</tspan>
              </text>
            </g>
          );
        })}
        <text x={LBL} y={steps.length * RH2 + 14} fontSize={9.5} style={{ fill: "var(--color-text-muted)" }}>
          ½ρA·U³ with U∞ = {freeWindMs.toFixed(1)} m/s → {discPowerMW(freeWindMs).toFixed(1)} MW through the rotor disc
        </text>
      </svg>
      <Note>
        Overall η = {((steps[steps.length - 1].levelMW / top) * 100).toFixed(1)} % of the free wind · Betz caps the rotor at 59.3 % of
        the local wind.
      </Note>
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <div className="px-1 text-[10.5px] font-semibold leading-snug text-text-muted">{children}</div>;
}
