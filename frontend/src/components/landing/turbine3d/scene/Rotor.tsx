/**
 * Rotor assembly — hub + 3 blades at 120°, placed at the origin of the
 * tilted shaft frame (V236Turbine puts that frame at the hub centre, 6°
 * nose-up).
 *
 *   spin group   turns clockwise seen from upwind (useRotorSpin)
 *   azimuth      blade b at 120°·b about the rotor axis (+z)
 *   precone      4° about the blade-local x axis → tips move upwind
 *   pitch group  about the blade's own span axis (usePitchAngle)
 *
 * Flapwise deflection: tip displacement from thrust (landingPhysics), applied
 * in the blade vertex shader (bladeShader), lagged ~2 s like the first flap
 * mode's aeroelastic response to a mean-thrust change.
 */

import { forwardRef, memo, useRef } from "react";
import { Group } from "three";
import { useFrame } from "@react-three/fiber";

import type { TurbinePartId } from "../../../../constants/turbinePartEducation";
import { selectTurbine, useLandingStore } from "../../../../store/landingStore";
import { v236ThrustMN, v236TipDeflectionM } from "../../../../utils/landingPhysics";
import { usePitchAngle } from "../hooks/usePitchAngle";
import { useRotorSpin } from "../hooks/useRotorSpin";
import { PRECONE } from "../model/layout";
import { Blade } from "./Blade";
import { bladeDeflection } from "./bladeShader";
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
  windMs?: number;          // hub-height wind [m/s] for the thrust load
  fieldMode?: "off" | "thermal" | "pressure" | "strain";
}

export const Rotor = memo(
  forwardRef<Group, RotorProps>(function Rotor(
    { turbineId, selectedPart, overridePitch, overrideRpm, windMs = 11, fieldMode = "off" },
    ref,
  ) {
    const turbine = useLandingStore(selectTurbine(turbineId));
    const status = turbine?.status ?? "operating";
    const rawRpm = overrideRpm ?? (turbine?.rotorSpeedRpm ?? 0);
    // Faulted/offline turbines must not spin even if an override RPM is provided
    const stopped = status === "fault" || status === "offline";
    const rpm = stopped ? 0 : rawRpm;
    const rawPitch = overridePitch ?? (turbine?.pitchAngleDeg ?? 0);
    // Faulted/offline turbines feather to 90°
    const pitch = stopped ? 90 : rawPitch;

    const rotorRef = useRef<Group>(null);
    const b1Ref = useRef<Group>(null);
    const b2Ref = useRef<Group>(null);
    const b3Ref = useRef<Group>(null);

    useRotorSpin(rotorRef, rpm);
    usePitchAngle(b1Ref, b2Ref, b3Ref, pitch);

    // Tip deflection vector in the blade frame: downwind (−z of the rotor)
    // expressed after the blade's pitch rotation β: (sin β, 0, −cos β).
    const tipRef = useRef(0);
    useFrame((_, dt) => {
      const target = stopped ? 0 : v236TipDeflectionM(v236ThrustMN(windMs));
      tipRef.current += (target - tipRef.current) * Math.min(1, dt / 2);
      const beta = b1Ref.current?.rotation.y ?? 0;
      bladeDeflection.value.set(Math.sin(beta), 0, -Math.cos(beta)).multiplyScalar(tipRef.current);
    });

    const isBladeSelected = selectedPart === "blades";
    const isHubSelected = selectedPart === "hub";
    const statusColor = STATUS_EMISSIVE[status] ?? "#000000";
    const bladeRefs = [b1Ref, b2Ref, b3Ref];

    return (
      <group ref={ref}>
        <group ref={rotorRef} name="rotor-spin">
          <Hub isSelected={isHubSelected} />
          {bladeRefs.map((bRef, b) => (
            <group key={b} rotation={[0, 0, (b * 2 * Math.PI) / 3]}>
              <group rotation={[PRECONE, 0, 0]}>
                <group ref={bRef}>
                  <Blade isSelected={isBladeSelected} statusColor={statusColor} fieldMode={fieldMode} />
                </group>
              </group>
            </group>
          ))}
        </group>
      </group>
    );
  }),
);
