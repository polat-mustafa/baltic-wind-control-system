/**
 * Wind-field overlay — the tip-speed gauge at the blade tip: |ΩR|, tip-speed
 * ratio λ and tip Mach number.
 *
 * The flow itself is drawn elsewhere: the hub-height wake deficit of every
 * running turbine in WakeField (Bastankhah Gaussian wakes, Katic sum, Crespo
 * added turbulence — model/wakeModel.ts) and the tip vortices in WindFlow.
 *
 * The group yaws with the wind bearing (parent transform); local +X points upwind.
 */

import { memo } from "react";
import { Html } from "@react-three/drei";

import { ROTOR_RADIUS } from "../model/layout";

const HUB_HEIGHT = 150;             // hub centre Y [m]

interface WindFieldVizProps {
  /** Measured / slider wind speed in m/s. */
  windMs: number;
  /** Rotor angular speed in rad/s (for tip-speed gauge). */
  rotorSpeedRpm: number;
  /** Nacelle yaw in degrees (0 = +X upstream). Field rotates with nacelle. */
  yawDeg: number;
}

export const WindFieldViz = memo(function WindFieldViz({
  windMs,
  rotorSpeedRpm,
  yawDeg,
}: WindFieldVizProps) {
  const active = windMs > 0.1;

  // Rotation around Y so local +X points upwind. Scene convention (same as
  // the nacelle yaw): bearing ψ lies along (−sin ψ, 0, cos ψ); R_y(φ) maps
  // +X to (cos φ, 0, −sin φ) → φ = −(ψ + 90°). Wind-bearing-driven, not yaw.
  const yawRad = -((yawDeg + 90) * Math.PI) / 180;

  return (
    <group position={[0, HUB_HEIGHT, 0]} rotation={[0, yawRad, 0]}>
      {active && <TipSpeedGauge rotorSpeedRpm={rotorSpeedRpm} windMs={windMs} />}
    </group>
  );
});

// ── Tip-speed gauge ────────────────────────────────────────────────

function TipSpeedGauge({
  rotorSpeedRpm,
  windMs,
}: {
  rotorSpeedRpm: number;
  windMs: number;
}) {
  const omega = (rotorSpeedRpm * 2 * Math.PI) / 60;
  const tipSpeed = omega * ROTOR_RADIUS;
  const tsr = windMs > 0.5 ? tipSpeed / windMs : 0;
  const mach = tipSpeed / 340;  // speed of sound at sea level
  return (
    <Html position={[0, ROTOR_RADIUS + 6, 0]} center>
      <div className="text-[10px] font-mono font-semibold text-text-primary bg-bg-secondary/90 px-2 py-1 rounded border border-border-primary whitespace-nowrap leading-tight">
        <div>|ΩR| = {tipSpeed.toFixed(0)} m/s</div>
        <div>λ = {tsr.toFixed(1)}</div>
        <div>Mach {mach.toFixed(2)}</div>
      </div>
    </Html>
  );
}
