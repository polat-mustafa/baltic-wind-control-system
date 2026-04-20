/**
 * Complete V236-15.0 MW turbine scene graph.
 *
 * Composition:
 *   Monopile + Transition piece  (y = -40 → 26)
 *   Tower                        (y = 26 → 150)
 *   YawAssembly                  (y ≈ 147.5)
 *   NacelleGroup (yaw-driven)
 *     └─ Nacelle shell
 *     └─ Drivetrain (cutaway/exploded)
 *     └─ Cooler
 *     └─ Anemometer
 *   Rotor (at y=150, inside nacelle group for correct yaw)
 *
 * The nacelleGroupRef is driven by useYawRotation (rotates around Y).
 * Only the nacelle + rotor + internals yaw; the tower stays fixed.
 */

import { memo, useRef } from "react";
import { Group } from "three";
import { useFrame } from "@react-three/fiber";

import type { TurbinePartId } from "../../../../constants/turbinePartEducation";
import { selectTurbine, useLandingStore } from "../../../../store/landingStore";
import { useYawRotation } from "../hooks/useYawRotation";
import { Anemometer } from "./Anemometer";
import { Cooler } from "./Cooler";
import { Drivetrain } from "./Drivetrain";
import { Monopile } from "./Monopile";
import { Nacelle } from "./Nacelle";
import { NacelleSubsystems } from "./NacelleSubsystems";
import { Rotor } from "./Rotor";
import { Tower } from "./Tower";
import { YawAssembly } from "./YawAssembly";

interface V236TurbineProps {
  turbineId: string;
  selectedPart: TurbinePartId | null;
  viewerMode: "normal" | "cutaway" | "exploded";
  explodedOffset: number;
  showHumanFigure?: boolean;
  overridePitch?: number;
  overrideRpm?: number;
  /** Wind speed for sway/deflection amplitude (m/s). */
  windMs?: number;
  /** Blade surface vertex-color field mode. */
  bladeFieldMode?: "off" | "thermal" | "pressure" | "strain";
}

export const V236Turbine = memo(function V236Turbine({
  turbineId,
  selectedPart,
  viewerMode,
  explodedOffset,
  overridePitch,
  overrideRpm,
  windMs = 11,
  bladeFieldMode = "off",
}: V236TurbineProps) {
  const turbine = useLandingStore(selectTurbine(turbineId));
  const nacelleGroupRef = useRef<Group>(null);
  const swayRef = useRef<Group>(null);
  const nacellePositionDeg = turbine?.nacellePositionDeg ?? 225;

  useYawRotation(nacelleGroupRef, nacellePositionDeg);

  // Tower sway — first bending mode of 150 m monopile (T ≈ 3 s).
  // Amplitude scales with wind²/rated² as a crude thrust proxy.
  useFrame(({ clock }) => {
    if (!swayRef.current) return;
    const t = clock.getElapsedTime();
    const amp = Math.min(1, (windMs / 11.1) ** 2);
    // Very small rotation at the base — tip deflection ≈ 0.15 m.
    const swayRad = Math.sin(t * (2 * Math.PI) / 3) * 0.0012 * amp;
    swayRef.current.rotation.z = swayRad;
    swayRef.current.rotation.x = Math.cos(t * (2 * Math.PI) / 3) * 0.0006 * amp;
  });

  const showInternals = viewerMode === "cutaway" || viewerMode === "exploded";

  return (
    <group ref={swayRef}>
      {/* Fixed structure */}
      <Monopile isSelected={selectedPart === "foundation"} />
      <Tower isSelected={selectedPart === "tower"} />
      <YawAssembly isSelected={selectedPart === "yaw"} selectedPart={selectedPart} />

      {/* Yaw-driven group — children use world coordinates directly.
          Rotation about Y is invariant to the group's y-position, so this
          wrapper does NOT lift to y=150. Every child component declares its
          own world-space position (Nacelle at y≈151, Rotor at y=150, etc.),
          and applying a parent lift would double-offset them. */}
      <group ref={nacelleGroupRef}>
        <Nacelle
          viewerMode={viewerMode}
          selectedPart={selectedPart}
        />

        {showInternals && (
          <>
            <Drivetrain
              selectedPart={selectedPart}
              explodedOffset={explodedOffset}
            />
            <NacelleSubsystems
              selectedPart={selectedPart}
            />
          </>
        )}

        <Cooler isSelected={selectedPart === "cooler"} />
        <Anemometer isSelected={selectedPart === "anemometer"} />

        {/* Rotor positions itself at y=150 (hub height) internally. */}
        <Rotor
          turbineId={turbineId}
          selectedPart={selectedPart}
          overridePitch={overridePitch}
          overrideRpm={overrideRpm}
          fieldMode={bladeFieldMode}
        />
      </group>
    </group>
  );
});
