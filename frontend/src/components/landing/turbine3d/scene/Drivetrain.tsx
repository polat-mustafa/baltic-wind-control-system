/**
 * Drivetrain — Blender geometry (scripts/blender/build_v236.py), rendered in
 * the tilted SHAFT frame (hub centre origin, +z toward the rotor), visible in
 * cutaway / exploded modes.
 *
 *   main shaft + rotor-lock disc   ω            (locked to the blades)
 *   main bearings (2)              cage ≈ 0.45 ω
 *   planetary stage 1 carrier      ω       sun1 = stage-2 carrier 4 ω
 *   planetary stage 2              4 ω     sun2 = stage-3 carrier 16 ω
 *   planetary stage 3              16 ω    sun3 = HSS 48 ω
 *   HSS + brake disc + coupling    48 ω    (400 rpm at rated)
 *   PMSG rotor (40 magnets)        48 ω
 *
 * Fixed-ring planetary: i = 1 + Z_ring/Z_sun; planets spin relative to the
 * carrier at −(Z_ring/Z_planet)·ω_carrier. Static casings are half sections
 * (port half) so the moving parts stay visible.
 *
 * explodedOffset: slides the gearbox and generator aft for an exploded view.
 */

import { memo, useRef, type ReactNode } from "react";
import type { Group } from "three";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

import type { TurbinePartId } from "../../../../constants/turbinePartEducation";
import { useLandingStore } from "../../../../store/landingStore";
import { rotorPhase } from "../hooks/useRotorSpin";
import { GEAR_STAGES } from "../model/layout";
import { nodePos, useV236Model, type V236Model } from "../model/useV236Model";

interface DrivetrainProps {
  selectedPart: TurbinePartId | null;
  explodedOffset: number; // 0 = assembled, 1 = fully exploded
}

const HL = "#60a5fa";
const HL_EM = "#1d4ed8";

type Look = { color: string; metalness: number; roughness: number };
const STEEL: Look = { color: "#aeb4ba", metalness: 0.9, roughness: 0.3 };
const CAST: Look = { color: "#5b6b7a", metalness: 0.3, roughness: 0.55 };
const DARK: Look = { color: "#3c434a", metalness: 0.6, roughness: 0.45 };
const COPPER: Look = { color: "#b8733a", metalness: 0.9, roughness: 0.35 };
const GENPAINT: Look = { color: "#2f4f6f", metalness: 0.3, roughness: 0.45 };
const RED: Look = { color: "#c1121f", metalness: 0.2, roughness: 0.45 };

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

export const Drivetrain = memo(function Drivetrain({ selectedPart, explodedOffset }: DrivetrainProps) {
  const model = useV236Model();
  const setSelectedPart = useLandingStore((s) => s.setSelectedTurbinePart);

  // Rotating groups, driven from the shared rotor phase
  const shaftRef = useRef<Group>(null);
  const rollerRef = useRef<Group>(null);
  const carrierRefs = [useRef<Group>(null), useRef<Group>(null), useRef<Group>(null)];
  const planetRefs = useRef<(Group | null)[]>([]);
  const sunRefs = [useRef<Group>(null), useRef<Group>(null), useRef<Group>(null)];
  const hssRef = useRef<Group>(null);
  const genRotorRef = useRef<Group>(null);

  useFrame(() => {
    const phi = rotorPhase.value;
    const wrap = (a: number) => a % (2 * Math.PI);
    if (shaftRef.current) shaftRef.current.rotation.z = -wrap(phi);
    if (rollerRef.current) rollerRef.current.rotation.z = -wrap(0.45 * phi);
    let k = 1; // carrier speed multiple of ω
    GEAR_STAGES.forEach((st, i) => {
      const carrier = carrierRefs[i].current;
      if (carrier) carrier.rotation.z = -wrap(k * phi);
      for (let p = 0; p < 3; p++) {
        const planet = planetRefs.current[i * 3 + p];
        if (planet) planet.rotation.z = wrap((st.zRing / st.zPlanet) * k * phi);
      }
      k *= st.ratio;
      const sun = sunRefs[i].current;
      if (sun) sun.rotation.z = -wrap(k * phi);
    });
    if (hssRef.current) hssRef.current.rotation.z = -wrap(k * phi); // k = 48
    if (genRotorRef.current) genRotorRef.current.rotation.z = -wrap(k * phi);
  });

  if (!model) return null;

  const pick = (id: TurbinePartId) => (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setSelectedPart(id);
  };
  const sel = (id: TurbinePartId) => selectedPart === id;
  const exp = explodedOffset * 6;

  return (
    <group>
      {/* Main shaft + main bearing unit */}
      <group name="shaft" onClick={pick("shaft")}>
        <group ref={shaftRef}>
          <Part geo={model.dt_shaft} look={STEEL} selected={sel("shaft")} />
        </group>
      </group>
      <group name="bearing" onClick={pick("bearing")}>
        <Part geo={model.dt_bearing_housing} look={CAST} selected={sel("bearing")} />
        <Part geo={model.dt_bearings} look={STEEL} selected={sel("bearing")} />
        <group ref={rollerRef}>
          <Part geo={model.dt_rollers} look={STEEL} selected={sel("bearing")} />
        </group>
      </group>

      {/* 3-stage planetary gearbox 48:1 */}
      <group name="gearbox" position={[0, 0, -exp * 0.4]} onClick={pick("gearbox")}>
        <Part geo={model.gb_housing} look={CAST} selected={sel("gearbox")} />
        {GEAR_STAGES.map((st, i) => (
          <GearStage
            key={i}
            model={model}
            stage={i + 1}
            orbit={st.orbit}
            selected={sel("gearbox")}
            carrierRef={carrierRefs[i]}
            sunRef={sunRefs[i]}
            planetRef={(p, g) => (planetRefs.current[i * 3 + p] = g)}
          />
        ))}
      </group>

      {/* High-speed shaft: brake disc (calipers static) + coupling */}
      <group position={[0, 0, -exp * 0.7]}>
        <group name="coupling" onClick={pick("coupling")}>
          <group ref={hssRef}>
            <Part geo={model.dt_hss} look={STEEL} selected={sel("coupling")} />
          </group>
        </group>
        <group name="brake" onClick={pick("brake")}>
          <Part geo={model.dt_calipers} look={RED} selected={sel("brake")} />
        </group>
      </group>

      {/* PMSG generator */}
      <group name="generator" position={[0, 0, -exp]} onClick={pick("generator")}>
        <Part geo={model.gen_housing} look={GENPAINT} selected={sel("generator")} />
        <Part geo={model.gen_stator} look={DARK} selected={sel("generator")} />
        <Part geo={model.gen_windings} look={COPPER} selected={sel("generator")} />
        <group ref={genRotorRef}>
          <Part geo={model.gen_rotor} look={DARK} selected={sel("generator")} vertexColors />
        </group>
      </group>
    </group>
  );
});

function GearStage({
  model, stage, orbit, selected, carrierRef, sunRef, planetRef,
}: {
  model: V236Model;
  stage: number;
  orbit: number;
  selected: boolean;
  carrierRef: React.RefObject<Group | null>;
  sunRef: React.RefObject<Group | null>;
  planetRef: (p: number, g: Group | null) => void;
}): ReactNode {
  const z = nodePos(`gb_carrier${stage}`)[2];
  return (
    <group position={[0, 0, z]}>
      <group ref={sunRef}>
        <Part geo={model[`gb_sun${stage}`]} look={STEEL} selected={selected} />
      </group>
      <group ref={carrierRef}>
        <Part geo={model[`gb_carrier${stage}`]} look={DARK} selected={selected} />
        {[0, 1, 2].map((p) => {
          const a = (p * 2 * Math.PI) / 3;
          return (
            <group key={p} position={[orbit * Math.cos(a), orbit * Math.sin(a), 0]} ref={(g) => planetRef(p, g)}>
              <Part geo={model[`gb_planet${stage}`]} look={STEEL} selected={selected} />
            </group>
          );
        })}
      </group>
    </group>
  );
}
