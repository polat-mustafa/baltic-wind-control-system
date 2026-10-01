/**
 * Fault and service visuals, tied to the map simulation:
 *
 *   FaultBeacon  — when the turbine trips, the part that the SCADA fault maps
 *                  to (constants FAULT_TO_PART) pulses red and gets a label.
 *   ServiceCraft — while a repair job runs on this turbine (landingStore
 *                  `repairs`, started by the map's vessels), the vessel is at
 *                  the turbine: CTV bow-on at the boat landing, or the SOV on
 *                  DP with its walk-to-work gangway on the TP platform — with
 *                  two technicians at the tower door.
 *   NacelleCrew  — two technicians working next to the faulted component
 *                  (rendered inside the yaw group so they follow the nacelle).
 */

import { memo, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";

import { FAULT_TO_PART, type TurbinePartId } from "../../../../constants/turbinePartEducation";
import { selectTurbine, useLandingStore } from "../../../../store/landingStore";
import { PARTS } from "../model/layout";
import { useV236Model } from "../model/useV236Model";
import { TechnicianFigure } from "./nacelle/TechnicianFigure";

type Emissive = THREE.Material & { emissive?: THREE.Color; emissiveIntensity?: number };

export const FaultBeacon = memo(function FaultBeacon({ turbineId }: { turbineId: string }) {
  const turbine = useLandingStore(selectTurbine(turbineId));
  const part = turbine?.status === "fault" && turbine.faultType ? FAULT_TO_PART[turbine.faultType] : null;
  const scene = useThree((s) => s.scene);
  const saved = useRef(new Map<Emissive, [THREE.Color, number]>());
  const labelPos = useRef(new THREE.Vector3());
  const labelRef = useRef<THREE.Group>(null);

  useEffect(() => {
    const store = saved.current;
    return () => {
      store.forEach(([c, i], m) => {
        m.emissive?.copy(c);
        m.emissiveIntensity = i;
      });
      store.clear();
    };
  }, [part]);

  useFrame(({ clock }) => {
    if (!part) return;
    // interior parts exist only in cutaway: fall back to the nacelle shell
    const obj = scene.getObjectByName(part) ?? scene.getObjectByName("nacelle");
    if (labelRef.current) labelRef.current.visible = !!obj;
    if (!obj) return;
    const pulse = 0.35 + 0.65 * Math.abs(Math.sin(clock.getElapsedTime() * 3));
    obj.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const m of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as Emissive[]) {
        if (!m.emissive) continue;
        if (!saved.current.has(m)) saved.current.set(m, [m.emissive.clone(), m.emissiveIntensity ?? 0]);
        m.emissive.setRGB(0.9, 0.05, 0.02);
        m.emissiveIntensity = pulse;
      }
    });
    new THREE.Box3().setFromObject(obj).getCenter(labelPos.current);
    labelRef.current?.position.copy(labelPos.current);
  });

  if (!part || !turbine?.faultType) return null;
  return (
    <group ref={labelRef}>
      <Html center style={{ pointerEvents: "none" }}>
        <div className="whitespace-nowrap rounded border-2 border-red-700 bg-red-600 px-2 py-0.5 text-[13px] font-bold text-white shadow-lg">
          ⚠ {turbine.faultType.replace(/_/g, " ")}
        </div>
      </Html>
    </group>
  );
});

function useRepair(turbineId: string) {
  return useLandingStore((s) => s.repairs[turbineId]);
}

function RepairProgress({ turbineId }: { turbineId: string }) {
  const job = useRepair(turbineId);
  const ref = useRef<HTMLSpanElement>(null);
  useFrame(() => {
    if (!job || !ref.current) return;
    const pct = Math.min(100, ((Date.now() - job.startedAt) / job.durationMs) * 100);
    ref.current.textContent = `${pct.toFixed(0)} %`;
  });
  if (!job) return null;
  return (
    <span>
      {job.crew} · repair <span ref={ref} />
    </span>
  );
}

export const ServiceCraft = memo(function ServiceCraft({ turbineId }: { turbineId: string }) {
  const job = useRepair(turbineId);
  const model = useV236Model();
  const bob = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    // heave/pitch of a vessel in a moderate sea (Tp ≈ 6 s), exaggeration-free
    const t = clock.getElapsedTime();
    if (bob.current) {
      bob.current.position.y = 0.25 * Math.sin((2 * Math.PI * t) / 6);
      bob.current.rotation.z = 0.01 * Math.sin((2 * Math.PI * t) / 6 + 1);
    }
  });
  if (!job || !model) return null;
  const sov = job.crew.startsWith("SOV");
  const geo = sov ? model.sov : model.ctv;
  return (
    <>
      <group ref={bob}>
        {geo && (
          <mesh geometry={geo} castShadow receiveShadow>
            <meshStandardMaterial vertexColors roughness={0.55} metalness={0.2} />
          </mesh>
        )}
      </group>
      {/* two technicians on the TP main platform by the tower door (−x) */}
      <TechnicianFigure position={[-6.2, 25.9, 1.2]} rotationY={Math.PI / 2} />
      <TechnicianFigure position={[-6.4, 25.9, -0.9]} rotationY={Math.PI / 2 + 0.4} />
      <Html position={[-8, 31, 0]} center style={{ pointerEvents: "none" }}>
        <div className="whitespace-nowrap rounded border border-amber-600 bg-amber-400 px-2 py-0.5 text-[12px] font-bold text-black shadow">
          <RepairProgress turbineId={turbineId} />
        </div>
      </Html>
    </>
  );
});

/** Nacelle-frame working position next to the faulted part (catwalk side, +x). */
const CREW_AT: Partial<Record<TurbinePartId, [number, number, number]>> = {
  blades: [2.0, 155.95, 2.5], // roof hatch toward the hub
  hub: [2.0, 155.95, 2.5],
  bearing: [2.3, 147.4, PARTS.mainBearing[2]],
  gearbox: [2.4, 147.4, PARTS.gearbox[2]],
  generator: [2.4, 147.4, PARTS.generator[2]],
  converter: [-2.2, 147.4, PARTS.converter[2]],
  yaw: [2.6, 147.4, 1.0],
  nacelle: [2.4, 147.4, -2.0],
};

export const NacelleCrew = memo(function NacelleCrew({ turbineId }: { turbineId: string }) {
  const job = useRepair(turbineId);
  const turbine = useLandingStore(selectTurbine(turbineId));
  const part = turbine?.faultType ? FAULT_TO_PART[turbine.faultType] : "nacelle";
  const at = useMemo(() => CREW_AT[part] ?? CREW_AT.nacelle!, [part]);
  if (!job) return null;
  return (
    <>
      <TechnicianFigure position={at} rotationY={-Math.PI / 2} />
      <TechnicianFigure position={[at[0] + 0.3, at[1], at[2] - 1.1]} rotationY={-Math.PI / 2 - 0.5} />
    </>
  );
});
