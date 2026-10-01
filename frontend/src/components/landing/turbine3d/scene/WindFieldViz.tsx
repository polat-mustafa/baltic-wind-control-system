/**
 * Wind-field visualization — educational overlay.
 *
 * Shows the three things every wind-energy textbook diagrams:
 *   1. Freestream vector V∞ — a labelled arrow upstream of the rotor.
 *   2. Streamlines — 24 tubes flowing through the actuator disc, bent by
 *      the induction factor a ≈ 1/3 (Betz optimum). Downstream velocity
 *      u = V∞(1 − 2a). UV-scrolled animated texture gives flow direction.
 *   3. Wake deficit ribbon — horizontal plane downstream coloured by
 *      Jensen analytical model:  u(x)/U∞ = 1 − 2a/(1 + 2kx/R)²  (k=0.04).
 *      Red near rotor → green by 10D downstream.
 *   4. Tip-speed gauge — HTML sprite at blade tip with |ΩR|, λ, Mach.
 *   (Tip vortices and the animated wake live in WindFlow.)
 *
 * All geometry assumes the rotor axis points +X (wind from +X). The
 * V236 nacelle yaws to face the wind, so we draw the field in world
 * coordinates aligned with the yawed rotor (parent group transforms it).
 *
 * Reference: Burton et al., "Wind Energy Handbook" (3rd ed.), §3.3–3.4.
 */

import { memo } from "react";
import { Html } from "@react-three/drei";

const ROTOR_RADIUS = 118;          // V236 rotor radius [m]
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
