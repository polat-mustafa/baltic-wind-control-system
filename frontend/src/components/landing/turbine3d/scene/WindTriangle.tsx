/**
 * Apparent-wind triangle — Pythagorean composition W = V_wind + (−ΩR).
 *
 * Drawn at three blade radii (r/R = 0.3, 0.6, 0.9). Each triangle has:
 *   V_wind   (sky-blue, axial +X)        — freestream through the disc
 *   −ΩR      (emerald, tangential)        — blade's own motion opposing air
 *   W        (amber, resultant)           — apparent wind felt by the aerofoil
 *
 * Angle of attack α = arctan(V_wind/(ΩR)) − β    (β = pitch)
 * Inflow angle φ   = arctan(V_wind/(ΩR))
 *
 * Pure client-side geometry — the backend doesn't expose BEM so we compute
 * the trig directly from wind speed and rpm.
 *
 * Reference: Manwell et al., "Wind Energy Explained" (2nd ed.), §3.5.
 */

import { memo, useMemo } from "react";
import * as THREE from "three";
import { Html, Line } from "@react-three/drei";

const ROTOR_RADIUS = 118;
const HUB_HEIGHT = 151;
const RADII_FRACTION = [0.3, 0.6, 0.9];

interface WindTriangleProps {
  windMs: number;
  rotorSpeedRpm: number;
  /** Rotor azimuth in radians — where the "up" blade currently points. */
  rotorAzimuth: number;
  /** Blade pitch in degrees. */
  pitchDeg: number;
  /** Nacelle yaw in degrees (0 = +X upstream). Triangle rotates with nacelle. */
  yawDeg: number;
}

export const WindTriangle = memo(function WindTriangle({
  windMs,
  rotorSpeedRpm,
  rotorAzimuth,
  pitchDeg,
  yawDeg,
}: WindTriangleProps) {
  if (windMs < 0.5 || rotorSpeedRpm < 0.1) return null;

  const omega = (rotorSpeedRpm * 2 * Math.PI) / 60;
  const yawRad = (yawDeg * Math.PI) / 180;

  return (
    <group position={[0, HUB_HEIGHT, 0]} rotation={[0, yawRad, 0]}>
      {RADII_FRACTION.map((frac) => (
        <TriangleAtRadius
          key={frac}
          radius={frac * ROTOR_RADIUS}
          windMs={windMs}
          omega={omega}
          azimuth={rotorAzimuth}
          pitchDeg={pitchDeg}
          label={`r/R = ${frac.toFixed(1)}`}
        />
      ))}
    </group>
  );
});

interface TriangleAtRadiusProps {
  radius: number;
  windMs: number;
  omega: number;
  azimuth: number;
  pitchDeg: number;
  label: string;
}

function TriangleAtRadius({
  radius,
  windMs,
  omega,
  azimuth,
  pitchDeg,
  label,
}: TriangleAtRadiusProps) {
  // Blade tangential speed at this radius [m/s].
  const tangentialSpeed = omega * radius;

  // Trig values.
  const inflowAngle = Math.atan2(windMs, tangentialSpeed);   // φ
  const alphaDeg = (inflowAngle * 180) / Math.PI - pitchDeg; // α

  const points = useMemo(() => {
    // All three vectors scale so the triangle is readable — pick ~12 m display size.
    const maxSpeed = Math.max(windMs, tangentialSpeed);
    const scale = maxSpeed > 0 ? 14 / maxSpeed : 0;

    // Blade points along +Y (vertical up) at azimuth=0. Rotate around +X by azimuth.
    // Position the triangle at the blade location and in the rotor plane.
    const bladeY = radius * Math.cos(azimuth);
    const bladeZ = radius * Math.sin(azimuth);

    // Local axes at the station:
    //   axial   = +X (freestream direction)
    //   tangent = perpendicular to blade, in rotor plane
    const tangent = new THREE.Vector3(0, -Math.sin(azimuth), Math.cos(azimuth));

    const origin = new THREE.Vector3(0, bladeY, bladeZ);
    const vWindEnd = origin.clone().add(new THREE.Vector3(windMs * scale, 0, 0));
    const minusOmegaREnd = origin
      .clone()
      .add(tangent.clone().multiplyScalar(tangentialSpeed * scale));
    const wEnd = origin
      .clone()
      .add(new THREE.Vector3(windMs * scale, 0, 0))
      .add(tangent.clone().multiplyScalar(tangentialSpeed * scale));

    return { origin, vWindEnd, minusOmegaREnd, wEnd };
  }, [radius, windMs, tangentialSpeed, azimuth]);

  return (
    <group>
      {/* V_wind — sky-blue axial */}
      <Line
        points={[points.origin, points.vWindEnd]}
        color="#38bdf8"
        lineWidth={2}
      />
      {/* −ΩR — emerald tangential */}
      <Line
        points={[points.origin, points.minusOmegaREnd]}
        color="#10b981"
        lineWidth={2}
      />
      {/* Resultant W — amber diagonal */}
      <Line
        points={[points.origin, points.wEnd]}
        color="#f59e0b"
        lineWidth={2.5}
      />
      {/* Closing line to show the triangle (from V_wind tip to W tip) */}
      <Line
        points={[points.vWindEnd, points.wEnd]}
        color="#10b981"
        lineWidth={1}
        dashed
        dashScale={40}
      />

      {/* Label */}
      <Html position={[points.wEnd.x + 2, points.wEnd.y + 1, points.wEnd.z]} center>
        <div className="text-[9px] font-mono bg-black/70 text-amber-200 px-1.5 py-0.5 rounded border border-amber-500/40 whitespace-nowrap leading-tight">
          <div>{label}</div>
          <div>φ = {((inflowAngle * 180) / Math.PI).toFixed(1)}°</div>
          <div>α = {alphaDeg.toFixed(1)}°</div>
          <div>|W| = {Math.hypot(windMs, tangentialSpeed).toFixed(1)} m/s</div>
        </div>
      </Html>
    </group>
  );
}
