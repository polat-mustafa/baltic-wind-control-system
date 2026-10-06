/**
 * D1 — Thermal overlay (cutaway / exploded).
 *
 * IR-camera style: a soft glow on each monitored hot spot, tinted with an
 * ironbow palette, plus a numbered temperature tag. The full read-out —
 * temperature, a bar against the alarm / trip limits, state and data source
 * — is the HTML table in <ThermalLegend/>, which stays readable at any zoom.
 * Temperatures come from model/nacelleThermal: live main-bearing and
 * gearbox-oil telemetry where available, the load-loss model elsewhere.
 */

import { Html } from "@react-three/drei";
import * as THREE from "three";

import { useNacelleReadings } from "../hooks/useNacelleReadings";
import { onShaft, PARTS, SHAFT_Z } from "../model/layout";
import {
  irColour,
  irGradientCss,
  IR_RANGE_C,
  type ThermalId,
  type ThermalReading,
} from "../model/nacelleThermal";

/** Hot-spot anchor [m, yaw frame] and glow radius [m], numbered 1…6. */
const HOT_SPOTS: { id: ThermalId; position: [number, number, number]; radius: number }[] = [
  { id: "mainBearing", position: onShaft(SHAFT_Z.bearingUnit), radius: 2.2 },
  { id: "hsBearing", position: onShaft(SHAFT_Z.gearboxStage[2]), radius: 1.4 },
  { id: "gearboxOil", position: onShaft(SHAFT_Z.gearbox, 0, -1.4), radius: 1.6 },
  { id: "generator", position: PARTS.generator, radius: 2.8 },
  { id: "converter", position: PARTS.converter, radius: 1.5 },
  { id: "transformer", position: [PARTS.transformer[0], PARTS.transformer[1] + 0.5, PARTS.transformer[2]], radius: 2.0 },
];

const STATE_STYLE = {
  ok: { text: "OK", color: "#22c55e" },
  alarm: { text: "ALARM", color: "#f59e0b" },
  trip: { text: "TRIP", color: "#ef4444" },
} as const;

let glowTexture: THREE.Texture | null = null;
function getGlowTexture(): THREE.Texture {
  if (glowTexture) return glowTexture;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,0.95)");
  g.addColorStop(0.4, "rgba(255,255,255,0.55)");
  g.addColorStop(0.75, "rgba(255,255,255,0.15)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  glowTexture = new THREE.CanvasTexture(canvas);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

export function ThermalOverlay({ turbineId }: { turbineId: string }) {
  const readings = useNacelleReadings(turbineId);
  return (
    <group name="thermal-overlay">
      {HOT_SPOTS.map((hs, i) => (
        <HotSpot key={hs.id} n={i + 1} position={hs.position} radius={hs.radius} reading={readings[hs.id]} />
      ))}
    </group>
  );
}

function HotSpot({
  n,
  position,
  radius,
  reading,
}: {
  n: number;
  position: [number, number, number];
  radius: number;
  reading: ThermalReading;
}) {
  const colour = irColour(reading.tempC);
  // Hotter parts glow larger (normalised over the IR range).
  const heat = Math.max(0, Math.min(1, (reading.tempC - IR_RANGE_C.min) / (IR_RANGE_C.max - IR_RANGE_C.min)));
  const size = radius * (1.5 + 0.9 * heat);
  const st = STATE_STYLE[reading.state];

  return (
    <group position={position}>
      {/* normal blending: cool (dark) parts must stay visible, not vanish as
          they would under additive blending */}
      <sprite scale={[size, size, 1]} renderOrder={10}>
        <spriteMaterial
          map={getGlowTexture()}
          color={colour}
          transparent
          opacity={0.7}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </sprite>
      <Html center distanceFactor={40} style={{ pointerEvents: "none" }} zIndexRange={[20, 0]}>
        <div
          className="flex select-none items-center gap-1 whitespace-nowrap rounded-full border bg-slate-950/80 py-0.5 pl-0.5 pr-2 font-mono text-[12px] font-bold tabular-nums text-white shadow-md shadow-black/50"
          style={{ borderColor: reading.state === "ok" ? colour : st.color }}
        >
          <span
            className="flex h-4 w-4 items-center justify-center rounded-full text-[10px] text-slate-950"
            style={{ background: colour }}
          >
            {n}
          </span>
          {reading.tempC.toFixed(0)} °C
        </div>
      </Html>
    </group>
  );
}

/** IR palette + read-out table (HTML, outside the Canvas). */
export function ThermalLegend({ turbineId }: { turbineId: string }) {
  const readings = useNacelleReadings(turbineId);
  return (
    <div className="w-60 rounded-md border border-border-primary bg-bg-secondary/90 px-2.5 py-1.5 font-mono text-[10px] shadow backdrop-blur-sm">
      <div className="mb-1 text-[11px] font-bold text-text-primary">Nacelle thermal (IR palette)</div>
      <div className="h-2.5 w-full rounded-sm" style={{ background: irGradientCss() }} />
      <div className="flex justify-between text-text-secondary">
        <span>{IR_RANGE_C.min} °C</span>
        <span>{(IR_RANGE_C.min + IR_RANGE_C.max) / 2} °C</span>
        <span>≥ {IR_RANGE_C.max} °C</span>
      </div>
      <div className="mt-1.5 space-y-1">
        {HOT_SPOTS.map((hs, i) => {
          const r = readings[hs.id];
          const colour = irColour(r.tempC);
          const st = STATE_STYLE[r.state];
          const top = r.spec.tripC + 10;
          const pct = (v: number) => Math.max(0, Math.min(100, ((v - IR_RANGE_C.min) / (top - IR_RANGE_C.min)) * 100));
          return (
            <div key={hs.id}>
              <div className="flex items-center gap-1">
                <span
                  className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-slate-950"
                  style={{ background: colour }}
                >
                  {i + 1}
                </span>
                <span className="truncate text-text-secondary">{r.spec.label}</span>
                <span className="ml-auto font-semibold tabular-nums text-text-primary">{r.tempC.toFixed(0)} °C</span>
                <span className="w-9 text-right text-[8px] font-bold" style={{ color: st.color }}>
                  {st.text}
                </span>
              </div>
              <div
                className="relative ml-[18px] mt-0.5 h-1 rounded-full bg-slate-500/30"
                title={`alarm ${r.spec.alarmC} °C · trip ${r.spec.tripC} °C · ${r.live ? "live" : "model"}`}
              >
                <div className="h-1 rounded-full" style={{ width: `${pct(r.tempC)}%`, background: colour }} />
                <div className="absolute top-[-2px] h-2 w-px bg-amber-500" style={{ left: `${pct(r.spec.alarmC)}%` }} />
                <div className="absolute top-[-2px] h-2 w-px bg-red-500" style={{ left: `${pct(r.spec.tripC)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 text-[9px] leading-tight text-text-muted">
        bar ticks: alarm (amber) · trip (red) · T = T_air + ΔT_rated·(k₀ + (1−k₀)·pⁿ), n = 2 windings (I²R) · live:
        main bearing, gearbox oil
      </div>
    </div>
  );
}
