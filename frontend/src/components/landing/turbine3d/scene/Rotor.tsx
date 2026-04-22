/**
 * Rotor assembly — hub + 3 blades at 120° intervals.
 *
 * The outer group (rotorGroupRef) is driven by useRotorSpin (z-axis spin).
 * Each blade inner group is driven by usePitchAngle (z-axis pitch rotation
 * around the blade's own long axis within the hub frame).
 *
 * Blade offset: each blade root is at y=0 in its local group, rotated
 * 120°/240°/360° around the rotor's z-axis to place them radially.
 */

import { forwardRef, memo, useRef } from "react";
import { Group } from "three";

import type { TurbinePartId } from "../../../../constants/turbinePartEducation";
import { selectTurbine, useLandingStore } from "../../../../store/landingStore";
import { usePitchAngle } from "../hooks/usePitchAngle";
import { useRotorSpin } from "../hooks/useRotorSpin";
import { Blade } from "./Blade";
import { Hub } from "./Hub";

const STATUS_EMISSIVE: Record<string, string> = {
  operating: "#000000",
  curtailed: "#7c2d12",
  fault:     "#7f1d1d",
  offline:   "#000000",
};

interface RotorProps {
  turbineId: string;
  selectedPart: TurbinePartId | null;
  overridePitch?: number;   // degrees: 0=fine pitch, 90=feathered
  overrideRpm?: number;     // rpm: 0=stopped
  fieldMode?: "off" | "thermal" | "pressure" | "strain";
}

export const Rotor = memo(
  forwardRef<Group, RotorProps>(function Rotor({ turbineId, selectedPart, overridePitch, overrideRpm, fieldMode = "off" }, ref) {
    const turbine = useLandingStore(selectTurbine(turbineId));
    const status = turbine?.status ?? "operating";
    const rawRpm = overrideRpm ?? (turbine?.rotorSpeedRpm ?? 0);
    // Faulted/offline turbines must not spin even if an override RPM is provided
    const rpm = (status === "fault" || status === "offline") ? 0 : rawRpm;
    const rawPitch = overridePitch ?? (turbine?.pitchAngleDeg ?? 0);
    // Faulted/offline turbines feather to 90°
    const pitch = (status === "fault" || status === "offline") ? 90 : rawPitch;

    const rotorRef = useRef<Group>(null);
    const b1Ref = useRef<Group>(null);
    const b2Ref = useRef<Group>(null);
    const b3Ref = useRef<Group>(null);

    useRotorSpin(rotorRef, rpm);
    usePitchAngle(b1Ref, b2Ref, b3Ref, pitch);

    const isBladeSelected = selectedPart === "blades";
    const isHubSelected = selectedPart === "hub";
    const statusColor = STATUS_EMISSIVE[status] ?? "#000000";

    return (
      <group ref={ref} position={[0, 150, 0]}>
        <group ref={rotorRef}>
          <Hub isSelected={isHubSelected} />

          {/* Blade 1 — pointing up */}
          <group rotation={[0, 0, 0]}>
            <group ref={b1Ref}>
              <Blade isSelected={isBladeSelected} statusColor={statusColor} fieldMode={fieldMode} />
            </group>
          </group>

          {/* Blade 2 — 120° offset */}
          <group rotation={[0, 0, (2 * Math.PI) / 3]}>
            <group ref={b2Ref}>
              <Blade isSelected={isBladeSelected} statusColor={statusColor} fieldMode={fieldMode} />
            </group>
          </group>

          {/* Blade 3 — 240° offset */}
          <group rotation={[0, 0, (4 * Math.PI) / 3]}>
            <group ref={b3Ref}>
              <Blade isSelected={isBladeSelected} statusColor={statusColor} fieldMode={fieldMode} />
            </group>
          </group>
        </group>
      </group>
    );
  }),
);
