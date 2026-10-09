/**
 * Wind shown in the air, the way a met-mast / lidar report shows it.
 *
 * A measurement mast 0.75 D upwind and beside the rotor (so it never hides
 * it), with one arrow every 20 m of height:
 *   • arrow direction = local flow direction (downwind, in the wind frame);
 *   • arrow length ∝ u(z) = u_hub·(z/150)^α, α = 0.10 (neutral offshore
 *     boundary layer over a smooth sea — utils/landingPhysics, single
 *     source): top tip (268 m) ≈ 1.06·u_hub, bottom tip (32 m) ≈ 0.86·u_hub,
 *     Δu ≈ 20 % of hub wind — wind shear, the main source of 1P blade load
 *     cycles;
 *   • plus the turbulent gust u′ of the shared synthetic field (same eddies
 *     as the flow streaks) — gusts visibly travel up and down the profile.
 * The mean-profile envelope, the rotor-swept band and a windsock (droop from
 * wind speed) complete it. Everything lives in the wind frame: local +z
 * points upwind, so the whole instrument turns with the wind.
 */

import { memo, useMemo, useRef } from "react";
import * as THREE from "three";
import { Html, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";

import { HUB } from "../model/layout";
import { D, R } from "../model/wakeModel";
import { FIELD, FLOW_TIME_X, turbAt } from "../model/turbulence";
import { SHEAR_ALPHA, turbulenceIntensity, windAtHeight } from "../../../../utils/landingPhysics";

const shearU = (uHub: number, z: number) => windAtHeight(uHub, Math.max(z, 1));

const MAST_X = R + 40; // beside the rotor, on the side away from the default camera
const MAST_Z = HUB[2] + 0.75 * D; // upwind
const HEIGHTS = Array.from({ length: 14 }, (_, i) => 20 + i * 20); // 20 … 280 m
const M_PER_MS = 5.5; // arrow length per m/s
const TIP_LOW = HUB[1] - R;
const TIP_HIGH = HUB[1] + R;
const CARD16 = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];


const cSlow = new THREE.Color("#1d4ed8");
const cFast = new THREE.Color("#e0f2fe");

export const WindProfile = memo(function WindProfile({ windMs, windFromDeg }: { windMs: number; windFromDeg: number }) {
  const arrows = useRef<(THREE.Group | null)[]>([]);
  const shafts = useRef<(THREE.Mesh | null)[]>([]);
  const heads = useRef<(THREE.Mesh | null)[]>([]);
  const sockRef = useRef<THREE.Group>(null);
  const turb = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);

  const shaftGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.75, 0.75, 1, 10);
    g.rotateX(Math.PI / 2); // along z
    g.translate(0, 0, -0.5); // tail at 0, towards −z
    return g;
  }, []);
  const headGeo = useMemo(() => {
    const g = new THREE.ConeGeometry(2.6, 8, 16);
    g.rotateX(-Math.PI / 2); // tip towards −z
    return g;
  }, []);
  const mats = useMemo(
    () =>
      HEIGHTS.map((z) => {
        const k = Math.min(1, Math.max(0, (shearU(1, z) - 0.72) / 0.38));
        const c = cSlow.clone().lerp(cFast, k);
        const swept = z >= TIP_LOW && z <= TIP_HIGH;
        return new THREE.MeshStandardMaterial({
          color: c,
          emissive: c,
          emissiveIntensity: 0.35,
          roughness: 0.4,
          transparent: true,
          opacity: swept ? 0.95 : 0.55,
        });
      }),
    [],
  );
  // windsock: 5 alternating orange/white rings, open cone along −z
  const sockGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(1.1, 2.3, 12, 20, 5, true);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, -6);
    const pos = g.getAttribute("position");
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const band = Math.min(4, Math.floor((-pos.getZ(i) / 12) * 5 - 1e-3));
      const c = band % 2 === 0 ? [0.95, 0.35, 0.05] : [0.96, 0.96, 0.94];
      col.set(c, i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  }, []);

  const envelope = useMemo(
    () => Array.from({ length: 58 }, (_, i) => {
      const z = 5 + i * 5;
      return new THREE.Vector3(MAST_X, z, MAST_Z - shearU(windMs, z) * M_PER_MS);
    }),
    [windMs],
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * FLOW_TIME_X;
    const sigma = turbulenceIntensity(windMs) * windMs;
    HEIGHTS.forEach((z, i) => {
      turbAt(FIELD, MAST_X, z, MAST_Z, t, windMs, turb);
      const u = Math.max(0.2, shearU(windMs, z) - sigma * turb.z); // +z is upwind → gust = −u′_z
      const len = u * M_PER_MS;
      const shaftLen = Math.max(0.1, len - 8); // cone is 8 m long, tip at −len
      shafts.current[i]?.scale.set(1, 1, shaftLen);
      heads.current[i]?.position.set(0, 0, -shaftLen - 4);
      const g = arrows.current[i];
      if (g) {
        // small lateral/vertical flow angle from v′, w′
        g.rotation.set(Math.atan2(sigma * turb.y, u) * 0.8, Math.atan2(sigma * turb.x, u) * 0.8, 0);
      }
    });
    if (sockRef.current) {
      turbAt(FIELD, MAST_X, 295, MAST_Z, t, windMs, turb);
      const droop = Math.max(0, 1 - (windMs + sigma * turb.z) / 13) * 1.1;
      sockRef.current.rotation.set(-droop, 0.25 * Math.sin(t * 0.7) * (sigma * 0.3), 0);
    }
  });

  if (windMs < 0.3) return null;
  const uLow = shearU(windMs, TIP_LOW);
  const uHigh = shearU(windMs, TIP_HIGH);
  const from = Math.round(windFromDeg);
  const card = CARD16[Math.round((((windFromDeg % 360) + 360) % 360) / 22.5) % 16];

  return (
    <group rotation={[0, -(windFromDeg * Math.PI) / 180, 0]}>
      {/* lattice mast + booms */}
      <mesh position={[MAST_X, 150, MAST_Z]}>
        <cylinderGeometry args={[0.55, 0.9, 300, 8]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.6} roughness={0.45} />
      </mesh>
      {HEIGHTS.map((z, i) => (
        <group key={z} position={[MAST_X, z, MAST_Z]}>
          <mesh position={[0, 0, 1.6]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.18, 0.18, 3.2, 6]} />
            <meshStandardMaterial color="#6b7280" />
          </mesh>
          <group ref={(el) => { arrows.current[i] = el; }}>
            <mesh ref={(el) => { shafts.current[i] = el; }} geometry={shaftGeo} material={mats[i]} />
            <mesh ref={(el) => { heads.current[i] = el; }} geometry={headGeo} material={mats[i]} />
          </group>
        </group>
      ))}
      {/* mean profile u(z) through the arrow tips */}
      <Line points={envelope} color="#f8fafc" lineWidth={2} dashed dashSize={6} gapSize={4} transparent opacity={0.9} />
      {/* rotor-swept band 32 – 268 m */}
      <mesh position={[MAST_X - 0.5, HUB[1], MAST_Z - (windMs * M_PER_MS) / 2]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[windMs * M_PER_MS * 1.25, 2 * R]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.08} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {[TIP_LOW, TIP_HIGH].map((z) => (
        <Line
          key={z}
          points={[[MAST_X, z, MAST_Z + 4], [MAST_X, z, MAST_Z - windMs * M_PER_MS * 1.3]]}
          color="#38bdf8"
          lineWidth={1.2}
          dashed
          dashSize={3}
          gapSize={3}
        />
      ))}
      {/* windsock on top */}
      <group position={[MAST_X, 300, MAST_Z]}>
        <mesh position={[0, 0, 0.8]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 2, 6]} />
          <meshStandardMaterial color="#374151" />
        </mesh>
        <group ref={sockRef}>
          <mesh geometry={sockGeo}>
            <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.8} />
          </mesh>
        </group>
      </group>
      {/* readouts */}
      <Html position={[MAST_X, 318, MAST_Z]} center zIndexRange={[9, 0]} style={{ pointerEvents: "none" }}>
        <div className="whitespace-nowrap rounded-md border border-border-primary bg-bg-secondary/90 px-2.5 py-1 text-center text-text-primary shadow-lg">
          <div className="text-[13px] font-bold text-accent">
            Wind {windMs.toFixed(1)} m/s · from {from}° {card}
          </div>
          <div className="text-xs font-semibold text-text-secondary">
            met mast · u(z) = u<sub>hub</sub>(z/150)<sup>{SHEAR_ALPHA}</sup> · TI {(turbulenceIntensity(windMs) * 100).toFixed(1)} %
          </div>
        </div>
      </Html>
      {[
        [TIP_HIGH, `tip top ${TIP_HIGH.toFixed(1)} m · ${uHigh.toFixed(1)} m/s`],
        [HUB[1], `hub ${HUB[1]} m · ${windMs.toFixed(1)} m/s`],
        [TIP_LOW, `tip bottom ${TIP_LOW.toFixed(1)} m · ${uLow.toFixed(1)} m/s`],
      ].map(([z, label]) => (
        <Html key={String(z)} position={[MAST_X, Number(z), MAST_Z + 10]} center zIndexRange={[9, 0]} style={{ pointerEvents: "none" }}>
          <div className="whitespace-nowrap rounded border border-border-primary bg-bg-secondary/90 px-1.5 py-0.5 font-mono text-xs font-bold text-text-primary">
            {label}
          </div>
        </Html>
      ))}
      <Html position={[MAST_X, TIP_LOW - 16, MAST_Z]} center zIndexRange={[9, 0]} style={{ pointerEvents: "none" }}>
        <div className="whitespace-nowrap rounded border border-border-primary bg-bg-secondary/90 px-1.5 py-0.5 font-mono text-xs font-semibold text-text-primary">
          shear across rotor Δu = {(uHigh - uLow).toFixed(1)} m/s ({(((uHigh - uLow) / windMs) * 100).toFixed(0)} %)
        </div>
      </Html>
    </group>
  );
});
