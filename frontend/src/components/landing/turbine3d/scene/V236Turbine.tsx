/**
 * Complete V236-15.0 MW turbine scene graph.
 *
 *   lean group (pivot at the mudline, y = −40 m) — static tower/monopile
 *   bending under rotor thrust (≈ 0.9 m at the tower top at rated) plus the
 *   first fore-aft mode (≈ 0.19 Hz) excited by turbulence
 *     Monopile + transition piece, tower, yaw bearing
 *     yaw group (nacelle heading)
 *       nacelle shell, CoolerTop, anemometer
 *       bedplate + converter + subsystems (cutaway/exploded)
 *       shaft frame at the hub centre, tilted 6° nose-up
 *         rotor (hub + 3 coned, pitched, deflecting blades)
 *         drivetrain (cutaway/exploded)
 */

import { memo, useRef } from "react";
import * as THREE from "three";
import { Group } from "three";
import { useFrame } from "@react-three/fiber";

import type { TurbinePartId } from "../../../../constants/turbinePartEducation";
import { selectTurbine, useLandingStore } from "../../../../store/landingStore";
import { v236ThrustMN, v236TipDeflectionM, v236TowerTopDeflectionM } from "../../../../utils/landingPhysics";
import { useYawRotation } from "../hooks/useYawRotation";
import { HUB, PRECONE, ROTOR_RADIUS, SHAFT_TILT } from "../model/layout";
import { useV236Model } from "../model/useV236Model";
import { Anemometer } from "./Anemometer";
import { Cooler } from "./Cooler";
import { Drivetrain } from "./Drivetrain";
import { NacelleCrew } from "./FaultAndService";
import { NACELLE_YAW_NAME } from "./InNacelleFrame";
import { Monopile } from "./Monopile";
import { Nacelle } from "./Nacelle";
import { NacelleSubsystems } from "./NacelleSubsystems";
import { Rotor } from "./Rotor";
import { Tower } from "./Tower";
import { YawAssembly } from "./YawAssembly";
import { TipVortices } from "./WindFlow";

interface V236TurbineProps {
  turbineId: string;
  selectedPart: TurbinePartId | null;
  viewerMode: "normal" | "cutaway" | "exploded";
  explodedOffset: number;
  showHumanFigure?: boolean;
  overridePitch?: number;
  overrideRpm?: number;
  /** Hub-height wind speed (m/s) — thrust → blade and tower deflection. */
  windMs?: number;
  /** Blade surface vertex-color field mode. */
  bladeFieldMode?: "off" | "thermal" | "pressure" | "strain";
  /** Draw the tip-vortex helices (Wind field overlay). */
  showFlow?: boolean;
}

const MUDLINE_Y = -40;
const TOWER_TOP_ABOVE_MUDLINE = 147 - MUDLINE_Y;
const F_FA1 = 0.19; // Hz, first fore-aft mode of a 15 MW monopile/tower (soft-stiff)

export const V236Turbine = memo(function V236Turbine({
  turbineId,
  selectedPart,
  viewerMode,
  explodedOffset,
  overridePitch,
  overrideRpm,
  windMs = 11,
  bladeFieldMode = "off",
  showFlow = false,
}: V236TurbineProps) {
  const turbine = useLandingStore(selectTurbine(turbineId));
  const nacelleGroupRef = useRef<Group>(null);
  const leanRef = useRef<Group>(null);
  const nacellePositionDeg = turbine?.nacellePositionDeg ?? 225;
  const stopped = turbine?.status === "fault" || turbine?.status === "offline";

  useYawRotation(nacelleGroupRef, nacellePositionDeg);

  // Tower lean toward downwind: static δ from thrust + small FA-mode sway.
  const axis = useRef(new THREE.Vector3());
  const leanM = useRef(0);
  useFrame(({ clock }, dt) => {
    const g = leanRef.current;
    if (!g) return;
    const thrust = stopped ? 0 : v236ThrustMN(windMs);
    leanM.current += (v236TowerTopDeflectionM(thrust) - leanM.current) * Math.min(1, dt / 4);
    const t = clock.getElapsedTime();
    const sway = 0.08 * leanM.current * Math.sin(2 * Math.PI * F_FA1 * t);
    const angle = (leanM.current + sway) / TOWER_TOP_ABOVE_MUDLINE;
    // downwind = −z of the yawed rotor: yaw ψ maps +z to (−sin ψ, 0, cos ψ)
    const psi = (nacellePositionDeg * Math.PI) / 180;
    const dx = Math.sin(psi);
    const dz = -Math.cos(psi);
    axis.current.set(dz, 0, -dx); // up × downwind
    g.quaternion.setFromAxisAngle(axis.current, angle);
  });

  const showInternals = viewerMode === "cutaway" || viewerMode === "exploded";

  return (
    <group position={[0, MUDLINE_Y, 0]}>
      <group ref={leanRef}>
        <group position={[0, -MUDLINE_Y, 0]}>
          {/* Fixed structure */}
          <Monopile isSelected={selectedPart === "foundation"} turbineId={turbineId} />
          <Tower isSelected={selectedPart === "tower"} />
          <YawAssembly isSelected={selectedPart === "yaw"} selectedPart={selectedPart} />

          {/* Yaw-driven group — children use yaw-frame (world-aligned) coordinates */}
          <group ref={nacelleGroupRef} name={NACELLE_YAW_NAME}>
            <Nacelle viewerMode={viewerMode} selectedPart={selectedPart} />

            {showInternals && (
              <>
                <NacelleFrame selectedPart={selectedPart} />
                <NacelleSubsystems selectedPart={selectedPart} />
              </>
            )}

            <NacelleCrew turbineId={turbineId} />
            <Cooler isSelected={selectedPart === "cooler"} />
            <Anemometer isSelected={selectedPart === "anemometer"} />

            {/* Shaft frame: hub centre, 6° nose-up tilt */}
            <group position={HUB} rotation={[-SHAFT_TILT, 0, 0]}>
              <Rotor
                turbineId={turbineId}
                selectedPart={selectedPart}
                overridePitch={overridePitch}
                overrideRpm={overrideRpm}
                windMs={windMs}
                fieldMode={bladeFieldMode}
              />
              {showInternals && <Drivetrain selectedPart={selectedPart} explodedOffset={explodedOffset} />}
              {showFlow && <TipVortices
                windMs={windMs}
                rotorRpm={stopped ? 0 : overrideRpm ?? turbine?.rotorSpeedRpm ?? 0}
                tipZ={ROTOR_RADIUS * Math.sin(PRECONE) + 5 - v236TipDeflectionM(v236ThrustMN(windMs))}
              />}
            </group>
          </group>
        </group>
      </group>
    </group>
  );
});

/** Bedplate (cast front + welded rear frame) and the converter line-up. */
function NacelleFrame({ selectedPart }: { selectedPart: TurbinePartId | null }) {
  const model = useV236Model();
  const setSelectedPart = useLandingStore((s) => s.setSelectedTurbinePart);
  if (!model) return null;
  const pick = (id: TurbinePartId) => (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setSelectedPart(id);
  };
  return (
    <>
      {model.bedplate && (
        <mesh geometry={model.bedplate} name="bedplate" castShadow receiveShadow onClick={pick("bedplate")}>
          <meshStandardMaterial
            color={selectedPart === "bedplate" ? "#60a5fa" : "#5b6b7a"}
            metalness={0.3}
            roughness={0.55}
          />
        </mesh>
      )}
      {model.converter && (
        <mesh geometry={model.converter} name="converter" castShadow onClick={pick("converter")}>
          <meshStandardMaterial
            vertexColors
            color={selectedPart === "converter" ? "#60a5fa" : "#ffffff"}
            metalness={0.5}
            roughness={0.4}
          />
        </mesh>
      )}
    </>
  );
}
