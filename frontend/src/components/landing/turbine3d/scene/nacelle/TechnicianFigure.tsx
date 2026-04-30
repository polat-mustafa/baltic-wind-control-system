/**
 * TechnicianFigure — low-poly offshore service technician at nacelle catwalk.
 *
 * Provides a 1.85 m scale reference so viewers grasp the V236 nacelle size
 * (20 m long × 9 m tall ≈ 10 × human height). Stylised geometry only —
 * helmet, torso, legs in safety-orange overalls + yellow hard hat.
 *
 * Position is relative to the NacelleInteriorDetail group at world [0, 151, 0].
 * Catwalk deck sits at local y = -3.8, so feet at y = -3.8, head at y = -3.8 + 1.85 = -1.95.
 */

import { memo } from "react";

export const TechnicianFigure = memo(function TechnicianFigure() {
  return (
    <group position={[0.3, -3.8, 4.0]}>
      {/* Legs — dark navy work trousers */}
      <mesh position={[-0.1, 0.4, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.8, 6]} />
        <meshStandardMaterial color="#1e3a5f" roughness={0.85} metalness={0.1} />
      </mesh>
      <mesh position={[0.1, 0.4, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.8, 6]} />
        <meshStandardMaterial color="#1e3a5f" roughness={0.85} metalness={0.1} />
      </mesh>

      {/* Boots */}
      {([-0.1, 0.1] as number[]).map((x) => (
        <mesh key={x} position={[x, 0.04, 0.04]}>
          <boxGeometry args={[0.12, 0.08, 0.22]} />
          <meshStandardMaterial color="#111827" roughness={0.9} metalness={0.2} />
        </mesh>
      ))}

      {/* Torso — safety orange overalls */}
      <mesh position={[0, 1.05, 0]}>
        <cylinderGeometry args={[0.18, 0.14, 0.75, 8]} />
        <meshStandardMaterial color="#f97316" roughness={0.8} metalness={0.05} />
      </mesh>

      {/* High-vis vest stripes — two emissive bands across torso */}
      {([0.95, 1.15] as number[]).map((y) => (
        <mesh key={y} position={[0, y, 0.185]}>
          <boxGeometry args={[0.34, 0.05, 0.01]} />
          <meshStandardMaterial
            color="#fbbf24"
            emissive="#fbbf24"
            emissiveIntensity={0.6}
          />
        </mesh>
      ))}

      {/* Arms (at sides) */}
      {([-0.22, 0.22] as number[]).map((x) => (
        <mesh key={x} position={[x, 1.0, 0]} rotation={[0, 0, x > 0 ? 0.3 : -0.3]}>
          <cylinderGeometry args={[0.055, 0.055, 0.65, 6]} />
          <meshStandardMaterial color="#f97316" roughness={0.8} metalness={0.05} />
        </mesh>
      ))}

      {/* Neck */}
      <mesh position={[0, 1.52, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.12, 8]} />
        <meshStandardMaterial color="#d4a574" roughness={0.7} metalness={0.0} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 1.68, 0]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color="#d4a574" roughness={0.7} metalness={0.0} />
      </mesh>

      {/* Hard hat — IEC EN 397 yellow safety helmet */}
      <mesh position={[0, 1.81, 0]}>
        <sphereGeometry args={[0.145, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#fbbf24" roughness={0.5} metalness={0.1} />
      </mesh>
      {/* Helmet brim */}
      <mesh position={[0, 1.73, 0]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.02, 12]} />
        <meshStandardMaterial color="#fbbf24" roughness={0.5} metalness={0.1} />
      </mesh>
    </group>
  );
});
