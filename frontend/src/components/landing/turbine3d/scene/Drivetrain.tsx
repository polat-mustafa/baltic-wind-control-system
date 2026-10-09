/**
 * Drivetrain — Blender geometry (scripts/blender/build_v236.py), rendered in
 * the tilted SHAFT frame (hub centre origin, +z toward the rotor).
 *
 * IEA 15 MW low-speed direct drive (Gaertner et al. 2020, Tables 5-2 / 5-4):
 *
 *   main shaft (hollow, r 3.0 m, 2.2 m)   ω       (bolted to the hub)
 *   main bearings (2, 1.2 m apart)        cage ≈ 0.48 ω — upwind tapered
 *                                         double outer-ring, downwind spherical
 *   PMSG outer rotor (200 magnets)        ω       air gap r 5.08 m, 7.56 rpm
 *                                                  → f_e = 100 · n/60 = 12.6 Hz
 *   stator (240 slots) + turret / nose    static  (the generator sits in front
 *                                                  of the nacelle, no gearbox)
 *
 * The generator is outside the nacelle, so its closed exterior (rotor drum,
 * rear end shield, nose) is always drawn; cutaway / exploded modes swap the
 * end shield for half sections that show bearings, stator and windings.
 *
 * explodedOffset: slides the stator half aft for an exploded view.
 */

import { memo, useRef } from "react";
import type { Group } from "three";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

import type { TurbinePartId } from "../../../../constants/turbinePartEducation";
import { useLandingStore } from "../../../../store/landingStore";
import { rotorPhase } from "../hooks/useRotorSpin";
import { useV236Model } from "../model/useV236Model";

interface DrivetrainProps {
  selectedPart: TurbinePartId | null;
  explodedOffset: number; // 0 = assembled, 1 = fully exploded
  /** Cutaway / exploded view: section the static parts. */
  internals: boolean;
}

const HL = "#5cc3d2";
const HL_EM = "#1d4ed8";

type Look = { color: string; metalness: number; roughness: number };
const STEEL: Look = { color: "#aeb4ba", metalness: 0.9, roughness: 0.3 };
const CAST: Look = { color: "#5b6b7a", metalness: 0.3, roughness: 0.55 };
const DARK: Look = { color: "#3c434a", metalness: 0.6, roughness: 0.45 };
const COPPER: Look = { color: "#b8733a", metalness: 0.9, roughness: 0.35 };
const GENPAINT: Look = { color: "#2f4f6f", metalness: 0.3, roughness: 0.45 };
const RED: Look = { color: "#c1121f", metalness: 0.2, roughness: 0.45 };

/** Roller-cage speed of the main bearings ≈ ½(1 − d/D·cos α)·ω (outer ring turning). */
const CAGE_RATIO = 0.48;

function Mat({ look, selected, vertexColors = false }: { look: Look; selected: boolean; vertexColors?: boolean }) {
  return (
    <meshStandardMaterial
      color={selected ? HL : vertexColors ? "#ffffff" : look.color}
      metalness={look.metalness}
      roughness={look.roughness}
      vertexColors={vertexColors}
      emissive={selected ? HL_EM : "#000000"}
      emissiveIntensity={selected ? 0.35 : 0}
      side={THREE.DoubleSide}
    />
  );
}

function Part({ geo, look, selected, vertexColors }: {
  geo: THREE.BufferGeometry | undefined; look: Look; selected: boolean; vertexColors?: boolean;
}) {
  if (!geo) return null;
  return (
    <mesh geometry={geo} castShadow receiveShadow>
      <Mat look={look} selected={selected} vertexColors={vertexColors} />
    </mesh>
  );
}

export const Drivetrain = memo(function Drivetrain({ selectedPart, explodedOffset, internals }: DrivetrainProps) {
  const model = useV236Model();
  const setSelectedPart = useLandingStore((s) => s.setSelectedTurbinePart);

  // Rotating groups, driven from the shared rotor phase (direct drive: one speed)
  const shaftRef = useRef<Group>(null);
  const rollerRef = useRef<Group>(null);
  const genRotorRef = useRef<Group>(null);

  useFrame(() => {
    const phi = rotorPhase.value % (2 * Math.PI);
    if (shaftRef.current) shaftRef.current.rotation.z = -phi;
    if (genRotorRef.current) genRotorRef.current.rotation.z = -phi;
    if (rollerRef.current) rollerRef.current.rotation.z = -((CAGE_RATIO * rotorPhase.value) % (2 * Math.PI));
  });

  if (!model) return null;

  const pick = (id: TurbinePartId) => (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setSelectedPart(id);
  };
  const sel = (id: TurbinePartId) => selectedPart === id;
  const exp = explodedOffset * 3;

  return (
    <group>
      {/* Main shaft (rotates with the hub) */}
      <group name="shaft" onClick={pick("shaft")}>
        <group ref={shaftRef}>
          <Part geo={model.dt_shaft} look={STEEL} selected={sel("shaft")} />
        </group>
      </group>

      {/* Main bearings on the stationary turret */}
      {internals && (
        <group name="bearing" onClick={pick("bearing")}>
          <Part geo={model.dt_turret} look={CAST} selected={sel("bearing")} />
          <Part geo={model.dt_bearings} look={STEEL} selected={sel("bearing")} />
          <group ref={rollerRef}>
            <Part geo={model.dt_rollers} look={STEEL} selected={sel("bearing")} />
          </group>
        </group>
      )}

      {/* Direct-drive PMSG: outer rotor turns at rotor speed; stator on the turret */}
      <group name="generator" onClick={pick("generator")}>
        <group ref={genRotorRef}>
          <Part geo={model.gen_rotor} look={DARK} selected={sel("generator")} vertexColors />
        </group>
        {internals ? (
          <group position={[0, 0, -exp]}>
            <Part geo={model.gen_stator} look={DARK} selected={sel("generator")} />
            <Part geo={model.gen_windings} look={COPPER} selected={sel("generator")} />
          </group>
        ) : (
          <>
            <Part geo={model.gen_cover} look={GENPAINT} selected={sel("generator")} />
            <Part geo={model.dt_nose} look={CAST} selected={sel("generator")} />
          </>
        )}
      </group>

      {/* Rotor brake / lock calipers on the generator rotor disc */}
      <group name="brake" onClick={pick("brake")}>
        <Part geo={model.dt_calipers} look={RED} selected={sel("brake")} />
      </group>
    </group>
  );
});
