/**
 * Velocity triangles at three blade stations (r/R = 0.3, 0.6, 0.9), drawn
 * in the rotor (shaft) frame on the blade at 12 o'clock, BEM-consistent:
 *
 *   axial inflow at the disc      U(1 − a)          (−z, air moves downwind)
 *   tangential, relative to blade Ωr(1 + a′)        (−x; the blade moves +x)
 *   relative wind                 W = √(U²(1−a)² + Ω²r²(1+a′)²)
 *   inflow angle                  φ = atan[U(1−a) / (Ωr(1+a′))]
 *   angle of attack               α = φ − (β + θ_twist(r))
 *
 * a from the thrust coefficient (Ct = 4a(1−a)), a′ = a(1−a)/λ_r².
 * At rated (11.1 m/s, 8.33 rpm) this gives α ≈ 3–6° along the outer blade —
 * where modern airfoils are designed to work.
 *
 * Reference: Burton et al., Wind Energy Handbook (3rd ed.), §3.5; Manwell,
 * Wind Energy Explained (2nd ed.), §3.5.
 */

import { memo, useMemo } from "react";
import * as THREE from "three";
import { Html, Line } from "@react-three/drei";

import { inductionFromCt, v236ThrustCoefficient } from "../../../../utils/landingPhysics";
import { PRECONE, ROTOR_RADIUS } from "../model/layout";
import { bladeTwistDeg } from "./bladeConstants";

const RADII_FRACTION = [0.3, 0.6, 0.9];
const DEG = 180 / Math.PI;

interface WindTriangleProps {
  windMs: number;
  rotorSpeedRpm: number;
  /** Collective pitch [°]. */
  pitchDeg: number;
}

export const WindTriangle = memo(function WindTriangle({ windMs, rotorSpeedRpm, pitchDeg }: WindTriangleProps) {
  if (windMs < 0.5 || rotorSpeedRpm < 0.1) return null;
  const omega = (rotorSpeedRpm * 2 * Math.PI) / 60;
  const a = inductionFromCt(v236ThrustCoefficient(windMs));
  return (
    <>
      {RADII_FRACTION.map((frac) => (
        <TriangleAtRadius key={frac} r={frac * ROTOR_RADIUS} windMs={windMs} omega={omega} a={a} pitchDeg={pitchDeg} />
      ))}
    </>
  );
});

function TriangleAtRadius({
  r, windMs, omega, a, pitchDeg,
}: { r: number; windMs: number; omega: number; a: number; pitchDeg: number }) {
  const ua = windMs * (1 - a);
  const lambdaR = (omega * r) / windMs;
  const aPrime = (a * (1 - a)) / Math.max(lambdaR * lambdaR, 1e-3);
  const ut = omega * r * (1 + aPrime);
  const phi = Math.atan2(ua, ut);
  const twist = bladeTwistDeg(r);
  const alpha = phi * DEG - (pitchDeg + twist);
  const w = Math.hypot(ua, ut);

  const pts = useMemo(() => {
    // Readable size: the longest vector drawn ~16 m
    const k = 16 / Math.max(ua, ut);
    const o = new THREE.Vector3(0, r * Math.cos(PRECONE), r * Math.sin(PRECONE));
    const axial = o.clone().add(new THREE.Vector3(0, 0, -ua * k));
    const tang = o.clone().add(new THREE.Vector3(-ut * k, 0, 0));
    const res = o.clone().add(new THREE.Vector3(-ut * k, 0, -ua * k));
    return { o, axial, tang, res };
  }, [r, ua, ut]);

  return (
    <group>
      <Line points={[pts.o, pts.axial]} color="#38bdf8" lineWidth={3} />
      <Line points={[pts.o, pts.tang]} color="#10b981" lineWidth={3} />
      <Line points={[pts.o, pts.res]} color="#f59e0b" lineWidth={3.5} />
      <Line points={[pts.axial, pts.res]} color="#10b981" lineWidth={1} dashed dashScale={2} />
      <Html position={[pts.res.x - 2, pts.res.y + 2, pts.res.z]} center style={{ pointerEvents: "none" }}>
        <div className="whitespace-nowrap rounded border border-amber-400/60 bg-slate-900/85 px-2 py-1 text-[12px] font-semibold leading-tight text-amber-100 shadow">
          <div className="font-bold">r/R = {(r / ROTOR_RADIUS).toFixed(1)}</div>
          <div><span className="text-sky-300">U(1−a)</span> {ua.toFixed(1)} · <span className="text-emerald-300">Ωr(1+a′)</span> {ut.toFixed(1)} m/s</div>
          <div>W = {w.toFixed(1)} m/s · φ = {(phi * DEG).toFixed(1)}°</div>
          <div>α = φ − (β {pitchDeg.toFixed(1)}° + θ {twist.toFixed(1)}°) = <b>{alpha.toFixed(1)}°</b></div>
        </div>
      </Html>
    </group>
  );
}
