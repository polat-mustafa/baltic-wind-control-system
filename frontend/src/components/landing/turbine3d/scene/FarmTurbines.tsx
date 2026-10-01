/**
 * The rest of the wind farm around the viewed turbine — 33 V236s at their
 * real positions (6 D × 8 D grid, see constants/windFarmLayout), each with
 * its own live nacelle heading, rotor speed and pitch from the landing
 * simulation. Same Blender geometry as the hero turbine, drawn with GPU
 * instancing (one draw call per part), so the whole farm costs ~8 draws.
 *
 * Nearby turbines get a small ID label; a tripped turbine shows its rotor
 * stopped and feathered, exactly as on the map.
 */

import { memo, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";

import { useLandingStore } from "../../../../store/landingStore";
import { farmAround } from "../model/farm";
import { HUB, PRECONE, SHAFT_TILT } from "../model/layout";
import { useV236Model } from "../model/useV236Model";
import { bladeMarkOnBeforeCompile, bladeOnBeforeCompile } from "./bladeShader";

const LABEL_RANGE_M = 3200;
const TWO_PI_OVER_60 = (2 * Math.PI) / 60;
const YAW_RATE_DEG_S = 1; // same as the simulation's yaw drive

export const FarmTurbines = memo(function FarmTurbines({ turbineId }: { turbineId: string }) {
  const model = useV236Model();
  const others = useMemo(() => farmAround(turbineId).filter((t) => t.id !== turbineId), [turbineId]);
  const n = others.length;

  const towerRef = useRef<THREE.InstancedMesh>(null);
  const tpRef = useRef<THREE.InstancedMesh>(null);
  const nacRef = useRef<THREE.InstancedMesh>(null);
  const coolRef = useRef<THREE.InstancedMesh>(null);
  const spinRef = useRef<THREE.InstancedMesh>(null);
  const bladeRef = useRef<THREE.InstancedMesh>(null);
  const markRef = useRef<THREE.InstancedMesh>(null);
  const phase = useRef(new Float32Array(n));
  // nacelle heading actually shown [°], slewed ≤ 1 °/s toward the SCADA value
  const yawShown = useRef(new Float32Array(n).fill(Number.NaN));
  // ID labels only once the camera has pulled back (else they cover the hub)
  const [showLabels, setShowLabels] = useState(false);

  const m = useMemo(
    () => ({
      base: new THREE.Matrix4(),
      yaw: new THREE.Matrix4(),
      hub: new THREE.Matrix4().compose(
        new THREE.Vector3(...HUB),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(-SHAFT_TILT, 0, 0)),
        new THREE.Vector3(1, 1, 1),
      ),
      nacOff: new THREE.Matrix4().makeTranslation(0, 151, -5),
      spin: new THREE.Matrix4(),
      az: new THREE.Matrix4(),
      cone: new THREE.Matrix4().makeRotationX(PRECONE),
      pitch: new THREE.Matrix4(),
      tmp: new THREE.Matrix4(),
      rotor: new THREE.Matrix4(),
      blade: new THREE.Matrix4(),
    }),
    [],
  );

  // static parts once
  useEffect(() => {
    others.forEach((t, i) => {
      m.base.makeTranslation(t.x, 0, t.z);
      towerRef.current?.setMatrixAt(i, m.base);
      tpRef.current?.setMatrixAt(i, m.base);
    });
    for (const r of [towerRef, tpRef]) if (r.current) r.current.instanceMatrix.needsUpdate = true;
  }, [others, m, model]);

  useFrame(({ camera }, dt) => {
    const far = camera.position.length() > 450;
    if (far !== showLabels) setShowLabels(far);
    const map = useLandingStore.getState().turbineMap;
    others.forEach((t, i) => {
      const s = map[t.id];
      const stopped = !s || s.status === "fault" || s.status === "offline";
      const rpm = stopped ? 0 : s.rotorSpeedRpm;
      const pitchDeg = stopped ? 90 : s.pitchAngleDeg;
      phase.current[i] = (phase.current[i] + rpm * TWO_PI_OVER_60 * dt) % (2 * Math.PI);
      m.base.makeTranslation(t.x, 0, t.z);
      const target = s?.nacellePositionDeg ?? 225;
      const cur = yawShown.current[i];
      const err = ((target - cur + 540) % 360) - 180;
      yawShown.current[i] =
        Number.isNaN(cur) || Math.abs(err) > 10 ? target : cur + Math.sign(err) * Math.min(Math.abs(err), YAW_RATE_DEG_S * dt);
      m.yaw.makeRotationY(-((yawShown.current[i] * Math.PI) / 180));
      m.tmp.multiplyMatrices(m.base, m.yaw);
      nacRef.current?.setMatrixAt(i, m.rotor.multiplyMatrices(m.tmp, m.nacOff));
      coolRef.current?.setMatrixAt(i, m.tmp);
      m.spin.makeRotationZ(-phase.current[i]);
      m.rotor.multiplyMatrices(m.tmp, m.hub).multiply(m.spin);
      spinRef.current?.setMatrixAt(i, m.rotor);
      m.pitch.makeRotationY((-pitchDeg * Math.PI) / 180);
      for (let b = 0; b < 3; b++) {
        m.az.makeRotationZ((b * 2 * Math.PI) / 3);
        // rotor · azimuth · precone · pitch, reusing one matrix (no per-frame allocation)
        m.blade.copy(m.rotor).multiply(m.az).multiply(m.cone).multiply(m.pitch);
        bladeRef.current?.setMatrixAt(i * 3 + b, m.blade);
        markRef.current?.setMatrixAt(i * 3 + b, m.blade);
      }
    });
    for (const r of [nacRef, coolRef, spinRef, bladeRef, markRef]) if (r.current) r.current.instanceMatrix.needsUpdate = true;
  });

  if (!model?.blade || !model.tower || !model.nacelle_shell) return null;
  return (
    <group>
      <instancedMesh ref={towerRef} args={[model.tower, undefined, n]} frustumCulled={false} castShadow>
        <meshStandardMaterial vertexColors roughness={0.5} metalness={0.1} />
      </instancedMesh>
      {model.transition_piece && (
        <instancedMesh ref={tpRef} args={[model.transition_piece, undefined, n]} frustumCulled={false}>
          <meshStandardMaterial vertexColors roughness={0.45} />
        </instancedMesh>
      )}
      <instancedMesh ref={nacRef} args={[model.nacelle_shell, undefined, n]} frustumCulled={false} castShadow>
        <meshStandardMaterial color="#cfd3d1" roughness={0.42} />
      </instancedMesh>
      {model.cooler && (
        <instancedMesh ref={coolRef} args={[model.cooler, undefined, n]} frustumCulled={false}>
          <meshStandardMaterial color="#3c434a" roughness={0.45} metalness={0.6} />
        </instancedMesh>
      )}
      {model.spinner && (
        <instancedMesh ref={spinRef} args={[model.spinner, undefined, n]} frustumCulled={false}>
          <meshStandardMaterial color="#eef0ee" roughness={0.35} />
        </instancedMesh>
      )}
      <instancedMesh ref={bladeRef} args={[model.blade, undefined, n * 3]} frustumCulled={false} castShadow>
        <meshStandardMaterial color="#eef0ee" roughness={0.35} onBeforeCompile={bladeOnBeforeCompile} />
      </instancedMesh>
      {model.blade_marks && (
        <instancedMesh ref={markRef} args={[model.blade_marks, undefined, n * 3]} frustumCulled={false}>
          <meshStandardMaterial color="#c1121f" roughness={0.45} onBeforeCompile={bladeMarkOnBeforeCompile} />
        </instancedMesh>
      )}
      {showLabels &&
        others
        .filter((t) => Math.hypot(t.x, t.z) < LABEL_RANGE_M)
        .map((t) => (
          <Html key={t.id} position={[t.x, 30, t.z]} center zIndexRange={[9, 0]} style={{ pointerEvents: "none" }}>
            <div className="whitespace-nowrap rounded border border-border-primary bg-bg-secondary/85 px-1.5 py-0.5 font-mono text-[11px] font-bold text-text-primary">
              {t.id}
            </div>
          </Html>
        ))}
    </group>
  );
});
