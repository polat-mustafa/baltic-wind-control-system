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

import type { TurbinePartId } from "../../../../constants/turbinePartEducation";
import { selectTurbine, useLandingStore } from "../../../../store/landingStore";
import { useYawRotation } from "../hooks/useYawRotation";
import { Anemometer } from "./Anemometer";
import { Cooler } from "./Cooler";
import { Drivetrain } from "./Drivetrain";
import { Monopile } from "./Monopile";
import { Nacelle } from "./Nacelle";
import { Rotor } from "./Rotor";
import { Tower } from "./Tower";
import { YawAssembly } from "./YawAssembly";

interface V236TurbineProps {
  turbineId: string;
  selectedPart: TurbinePartId | null;
  viewerMode: "normal" | "cutaway" | "exploded";
  explodedOffset: number;
  showHumanFigure?: boolean;
}

export const V236Turbine = memo(function V236Turbine({
  turbineId,
  selectedPart,
  viewerMode,
  explodedOffset,
}: V236TurbineProps) {
  const turbine = useLandingStore(selectTurbine(turbineId));
  const nacelleGroupRef = useRef<Group>(null);
  const nacellePositionDeg = turbine?.nacellePositionDeg ?? 225;

  useYawRotation(nacelleGroupRef, nacellePositionDeg);

  const showInternals = viewerMode === "cutaway" || viewerMode === "exploded";

  return (
    <group>
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
          <Drivetrain
            selectedPart={selectedPart}
            explodedOffset={explodedOffset}
          />
        )}

        <Cooler isSelected={selectedPart === "cooler"} />
        <Anemometer isSelected={selectedPart === "anemometer"} />

        {/* Rotor positions itself at y=150 (hub height) internally. */}
        <Rotor
          turbineId={turbineId}
          selectedPart={selectedPart}
        />
      </group>
    </group>
  );
});
