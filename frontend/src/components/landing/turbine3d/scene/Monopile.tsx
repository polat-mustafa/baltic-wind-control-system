/**
 * Monopile foundation + transition piece.
 *
 * Dimensions (V236 Baltic typical):
 *   Diameter: Ø 9 m
 *   Above waterline: ~20 m (y=0 → y=20)
 *   Below seabed: ~40 m (y=0 → y=-40) — shown semi-transparent
 *   Transition piece: tapers from 9 m → 6 m over top 8 m
 *
 * The monopile is grey with a corrosion protection yellow stripe
 * at the splash zone (approx y = -2 to +3 m).
 */

import { memo, useMemo } from "react";
import * as THREE from "three";

import { useFleet } from "../../../../lib/fleet";
import { useLandingStore } from "../../../../store/landingStore";
import { useV236Model } from "../model/useV236Model";

interface MonopileProps {
  isSelected: boolean;
  /** Painted on the transition piece (IALA O-139 structure ID). */
  turbineId?: string;
}

export const Monopile = memo(function Monopile({ isSelected, turbineId = "WTG" }: MonopileProps) {
  const setSelectedPart = useLandingStore((s) => s.setSelectedTurbinePart);
  const model = useV236Model();
  const select = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setSelectedPart("foundation");
  };

  if (model?.transition_piece) {
    // Blender foundation: Ø 9 m monopile to the seabed (−40 m) with anodes and
    // rock scour protection; RAL 1023 yellow transition piece (−2 → 26 m)
    // with boat landing, access ladder, platforms and davit crane.
    const hl = isSelected ? "#60a5fa" : undefined;
    return (
      <group onClick={select}>
        <mesh geometry={model.transition_piece} name="foundation" castShadow receiveShadow>
          <meshStandardMaterial
            vertexColors
            color={hl ?? "#ffffff"}
            roughness={0.45}
            emissive={isSelected ? "#1d4ed8" : "#000000"}
            emissiveIntensity={isSelected ? 0.3 : 0}
          />
        </mesh>
        {model.tp_detail && (
          <mesh geometry={model.tp_detail} castShadow>
            <meshStandardMaterial color="#9aa1a6" roughness={0.4} metalness={0.8} />
          </mesh>
        )}
        {model.monopile && (
          <mesh geometry={model.monopile}>
            <meshStandardMaterial vertexColors color={hl ?? "#ffffff"} roughness={0.7} metalness={0.3} transparent opacity={0.6} />
          </mesh>
        )}
        {model.anodes && (
          <mesh geometry={model.anodes}>
            <meshStandardMaterial color="#8d949a" roughness={0.7} metalness={0.4} transparent opacity={0.55} />
          </mesh>
        )}
        <TpMarking id={turbineId} side={-1} />
        <TpMarking id={turbineId} side={1} />
        {model.scour && (
          <mesh geometry={model.scour}>
            <meshStandardMaterial color="#5d5a52" roughness={0.95} transparent opacity={0.6} />
          </mesh>
        )}
      </group>
    );
  }

  return (
    <group>
      {/* Below-water section (semi-transparent) */}
      <mesh position={[0, -20, 0]}>
        <cylinderGeometry args={[4.5, 4.5, 40, 32]} />
        <meshStandardMaterial
          color="#3a4255"
          roughness={0.8}
          metalness={0.2}
          transparent
          opacity={0.4}
        />
      </mesh>

      {/* Above-water monopile body */}
      <mesh
        position={[0, 10, 0]}
        castShadow
        receiveShadow
        name="foundation"
        onClick={(e) => { e.stopPropagation(); setSelectedPart("foundation"); }}
      >
        <cylinderGeometry args={[4.5, 4.5, 20, 32]} />
        <meshStandardMaterial
          color={isSelected ? "#60a5fa" : "#4a5568"}
          roughness={0.7}
          metalness={0.3}
          emissive={isSelected ? "#1d4ed8" : "#000000"}
          emissiveIntensity={isSelected ? 0.3 : 0}
        />
      </mesh>

      {/* Splash zone corrosion protection (yellow) */}
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[4.55, 4.55, 5, 32]} />
        <meshStandardMaterial color="#d97706" roughness={0.6} metalness={0.1} />
      </mesh>

      {/* Orange safety barrier rings — J-tube / boat landing level */}
      {/* Upper ring: y=21, radius 5.2 sits proud of 4.5 m monopile */}
      <mesh position={[0, 21, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[5.2, 0.3, 8, 32]} />
        <meshStandardMaterial
          color="#FF6600"
          roughness={0.5}
          metalness={0.1}
          emissive="#FF6600"
          emissiveIntensity={0.1}
        />
      </mesh>
      {/* Lower guard ring: y=19 */}
      <mesh position={[0, 19, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[5.0, 0.2, 8, 32]} />
        <meshStandardMaterial color="#FF6600" roughness={0.5} metalness={0.1} />
      </mesh>

      {/* Transition piece (tapers to match tower base Ø 10 m → Ø 9 m) */}
      <mesh position={[0, 23, 0]} castShadow>
        <cylinderGeometry args={[5, 4.5, 6, 32]} />
        <meshStandardMaterial color="#4a5568" roughness={0.5} metalness={0.4} />
      </mesh>
    </group>
  );
});

/**
 * Structure ID on the transition piece — black letters ≥ 1 m high on the
 * yellow TP, readable from a vessel (IALA O-139). One band faces the boat
 * landing (−x), one the opposite side.
 */
function TpMarking({ id, side }: { id: string; side: -1 | 1 }) {
  const fleet = useFleet();
  const farm = fleet.source === "sb510" ? "SB-510 CASE STUDY" : fleet.name.toUpperCase();
  const texture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 256;
    const g = c.getContext("2d");
    if (g) {
      g.fillStyle = "#111111";
      g.font = "bold 150px Arial, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(id, 512, 110);
      g.font = "bold 44px Arial, sans-serif";
      g.fillText(farm, 512, 215);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [id, farm]);
  const arc = 1.3; // rad ≈ 6.4 m of the 4.9 m-radius TP
  const start = side < 0 ? -Math.PI / 2 - arc / 2 : Math.PI / 2 - arc / 2;
  return (
    <mesh position={[0, 21.2, 0]}>
      <cylinderGeometry args={[4.93, 4.93, 1.6, 48, 1, true, start, arc]} />
      <meshStandardMaterial map={texture} transparent roughness={0.6} polygonOffset polygonOffsetFactor={-2} depthWrite={false} />
    </mesh>
  );
}
