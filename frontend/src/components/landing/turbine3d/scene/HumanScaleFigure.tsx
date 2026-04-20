/**
 * 1.8 m human-scale figure on the transition-piece service platform.
 *
 * Placed at y=26 (top of transition piece, where service crew boards)
 * with a 10 m bright-yellow scale pole beside the figure so the location
 * is clearly visible from the overview camera at [180, 160, 180].
 *
 * Pole segments (each 2 m) alternate yellow / white, functioning as a
 * barber-pole scale ruler — a common technique in engineering renders.
 */

import { memo } from "react";

const POLE_HEIGHT = 10;      // m
const POLE_SEGMENTS = 5;     // 2 m each
const POLE_RADIUS = 0.12;    // m

export const HumanScaleFigure = memo(function HumanScaleFigure() {
  return (
    // x=12 puts the figure clear of the tower (tower base radius ~4-5 m)
    // y=26 is the transition-piece / boat-landing platform level
    <group position={[12, 26, 0]}>
      {/* ── Person ─────────────────────────────────────────────── */}
      {/* Body */}
      <mesh position={[0, 0.9, 0]}>
        <capsuleGeometry args={[0.2, 1.0, 4, 8]} />
        <meshStandardMaterial color="#fbbf24" roughness={0.6} metalness={0.0} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.65, 0]}>
        <sphereGeometry args={[0.22, 8, 8]} />
        <meshStandardMaterial color="#fde68a" roughness={0.5} metalness={0.0} />
      </mesh>

      {/* ── Scale pole (10 m, 2 m alternating segments) ────────── */}
      {Array.from({ length: POLE_SEGMENTS }, (_, i) => (
        <mesh key={i} position={[1.2, i * 2 + 1, 0]}>
          <cylinderGeometry args={[POLE_RADIUS, POLE_RADIUS, 2, 8]} />
          <meshStandardMaterial
            color={i % 2 === 0 ? "#eab308" : "#f8fafc"}
            roughness={0.4}
            metalness={0.1}
            emissive={i % 2 === 0 ? "#713f12" : "#000000"}
            emissiveIntensity={0.15}
          />
        </mesh>
      ))}

      {/* Pole cap */}
      <mesh position={[1.2, POLE_HEIGHT + 0.15, 0]}>
        <sphereGeometry args={[POLE_RADIUS * 1.6, 6, 6]} />
        <meshStandardMaterial color="#eab308" roughness={0.3} metalness={0.2} />
      </mesh>
    </group>
  );
});
