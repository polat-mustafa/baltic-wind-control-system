/**
 * Wind and wake, drawn from physics rather than decoration.
 *
 * WindFlow (wind frame: +z = upwind, rotor at z ≈ 6 m, hub 150 m)
 *   ~1100 particles advected through a velocity field and drawn as fading
 *   pathlines (the last ~2 s of each particle's path), like smoke/PIV:
 *   • induction zone / near wake — actuator-disc momentum theory,
 *       u(s) = U·[1 − a·(1 + s/√(s² + R²))], a from Ct = 4a(1−a);
 *     the radial velocity follows from continuity, v_r = −(r/2)·∂u/∂s, so the
 *     stream tube widens smoothly through the rotor instead of being placed;
 *   • far wake — Bastankhah & Porté-Agel (2014) Gaussian deficit, k* = 0.035;
 *   • wake swirl opposite to the rotor, ω_w = 2a′Ω, a′ = a(1−a)/λ²;
 *   • the other turbines' wakes (Ct from their own simulated wind), Katic
 *     quadratic superposition;
 *   • turbulence — spatially coherent random-Fourier-mode field with a
 *     von Kármán spectrum, frozen and advected with the wind
 *     (model/turbulence), σ = U·√(TI₀² + ΔTI²) with Crespo–Hernández added
 *     TI in the wakes: eddies carry groups of streaks together;
 *   • wake meandering (DWM, Larsen 2008) — the deficit centre is displaced by
 *     the large eddies, δ = v_LS·s/U_c, so the far wake snakes.
 *   Colour = local speed ratio u/U (pale cyan free stream → orange deficit).
 *   Time runs ×4 so the flow crosses 8 D in ~40 s.
 *   A label names the upstream turbine that wakes the viewed one and the
 *   resulting wind deficit, power loss (∝ u³) and added turbulence.
 *
 * WindCompass — compass ring on the sea around the tower (orientation only;
 *   the wind itself is shown in the air by WindProfile).
 *
 * TipVortices (rotor frame) — the three helical tip vortices shed by the
 *   blades, locked to the rotor azimuth, convected at U(1−a), expanding with
 *   the stream tube and diffusing with age.
 */

import { memo, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Html, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";

import { inductionFromCt, turbulenceIntensity, turbineThrustCoefficient } from "../../../../utils/landingPhysics";
import { rotorPhase } from "../hooks/useRotorSpin";
import { useLandingStore } from "../../../../store/landingStore";
import { farmAround } from "../model/farm";
import { HUB } from "../model/layout";
import { FIELD, FLOW_TIME_X, turbAt } from "../model/turbulence";
import { addedTI, D, deficit, R, wakeSources, type WakeSource } from "../model/wakeModel";

const NV = 800; // particles in a slab around the vertical plane through the rotor axis
const NH = 300; // particles in a slab at hub height (wake meandering seen from above)
const N = NV + NH;
const K = 16; // pathline samples per particle
const SAMPLE_DT = 0.12; // s (real) between samples → ~2 s trail
const Z_SPAWN = 2.5 * D; // upstream spawn plane [m]
const Z_END = -6 * D; // recycle 6 D downstream
const SEED_R = 1.7 * R; // half-height of the vertical slab
const XH = 1.6 * D; // half-width of the horizontal slab

/** Compass bearing (wind FROM, °) → rotation that puts local +z upwind. */
const windFrameYaw = (fromDeg: number) => -(fromDeg * Math.PI) / 180;

function seedPos(i: number, out: THREE.Vector3) {
  if (i < NV) {
    const y = HUB[1] + (Math.random() * 2 - 1) * SEED_R;
    return out.set((Math.random() * 2 - 1) * 10, y < 6 ? 6 + Math.random() * 30 : y, 0);
  }
  return out.set((Math.random() * 2 - 1) * XH, HUB[1] + (Math.random() * 2 - 1) * 8, 0);
}

export const WindFlow = memo(function WindFlow({
  turbineId,
  windMs,
  windFromDeg,
  rotorRpm,
}: {
  turbineId: string;
  windMs: number;
  windFromDeg: number;
  rotorRpm: number;
}) {
  const frameRef = useRef<THREE.Group>(null);
  const ct = rotorRpm > 0.1 ? turbineThrustCoefficient(windMs) : 0;
  const a = inductionFromCt(ct);
  const farm = useMemo(() => farmAround(turbineId).filter((t) => t.id !== turbineId), [turbineId]);
  const neighbours = useRef<WakeSource[]>([]);
  const [waked, setWaked] = useState<{ id: string; dist: number; deficit: number; ti: number } | null>(null);
  const lastLabel = useRef(0);
  const lastSample = useRef(0);

  // hist[(i*K + j)*3]: sample j of particle i, j = 0 is the live head
  const sim = useMemo(() => {
    const hist = new Float32Array(N * K * 3);
    const p = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      seedPos(i, p);
      p.z = Z_END + Math.random() * (Z_SPAWN - Z_END);
      for (let j = 0; j < K; j++) hist.set([p.x, p.y, p.z], (i * K + j) * 3);
    }
    return { hist, p };
  }, []);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * (K - 1) * 2 * 3), 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(N * (K - 1) * 2 * 4), 4));
    return g;
  }, []);
  const tmp = useMemo(
    () => ({
      t: { x: 0, y: 0, z: 0 },
      ls: { x: 0, y: 0, z: 0 },
      cam: new THREE.Vector3(),
      c: new THREE.Color(),
      fast: new THREE.Color("#e0f7ff"),
      slow: new THREE.Color("#fb7a1c"),
    }),
    [],
  );

  useFrame(({ camera, clock }, dtReal) => {
    if (windMs < 0.5) return;
    const map = useLandingStore.getState().turbineMap;
    const upstream = wakeSources(farm, map, windFromDeg);
    neighbours.current = upstream.filter((nb) => nb.ct > 0 && Math.abs(nb.x) < XH + 3 * R && nb.z > Z_END - D);

    // which upstream rotor shadows the viewed one most (label, 2 Hz)
    if (clock.elapsedTime - lastLabel.current > 0.5) {
      lastLabel.current = clock.elapsedTime;
      let best: { id: string; dist: number; deficit: number; ti: number } | null = null;
      for (const nb of upstream) {
        const s = nb.z - HUB[2];
        const d = deficit(s, Math.abs(nb.x), nb.a, nb.ct);
        if (d > 0.01 && (!best || d > best.deficit)) best = { id: nb.id, dist: s / D, deficit: d, ti: addedTI(s, Math.abs(nb.x), nb.a) };
      }
      setWaked((prev) =>
        prev?.id === best?.id && Math.abs((prev?.deficit ?? 0) - (best?.deficit ?? 0)) < 0.005 ? prev : best,
      );
    }

    if (frameRef.current) frameRef.current.worldToLocal(tmp.cam.copy(camera.position));
    const dt = Math.min(dtReal, 0.05) * FLOW_TIME_X;
    const tSim = clock.elapsedTime * FLOW_TIME_X;
    const U = windMs;
    const omega = (rotorRpm * 2 * Math.PI) / 60;
    const lambda = omega > 0 ? (omega * R) / U : 0;
    const aPrime = lambda > 0 ? (a * (1 - a)) / (0.5 * lambda) ** 2 : 0; // at r ≈ R/2
    const swirl = 2 * aPrime * omega; // rad/s, opposite to the rotor
    const uc = U * (1 - a); // wake convection speed
    const ti0 = turbulenceIntensity(U); // ambient TI (utils/landingPhysics)
    const shift = clock.elapsedTime - lastSample.current > SAMPLE_DT;
    if (shift) lastSample.current = clock.elapsedTime;
    const nbs = neighbours.current;
    const { hist, p } = sim;
    const pos = geometry.getAttribute("position") as THREE.BufferAttribute;
    const col = geometry.getAttribute("color") as THREE.BufferAttribute;
    const P = pos.array as Float32Array;
    const C = col.array as Float32Array;

    for (let i = 0; i < N; i++) {
      const o = i * K * 3;
      if (shift) hist.copyWithin(o + 3, o, o + (K - 1) * 3);
      let x = hist[o];
      let y = hist[o + 1];
      let z = hist[o + 2];
      const s = HUB[2] - z; // downstream distance from the viewed disc
      const ry = y - HUB[1];
      // wake meandering: centre moved by eddies > 2 D released s/U_c ago
      let mx = 0;
      let my = 0;
      if (s > 0 && ct > 0) {
        turbAt(FIELD, 0, HUB[1], HUB[2], tSim - s / uc, U, tmp.ls, true);
        const k = Math.min(0.6 * D, (ti0 * U * s) / uc);
        mx = tmp.ls.x * k;
        my = tmp.ls.y * k * 0.6;
      }
      const dx = x - mx;
      const dy = ry - my;
      const r = Math.hypot(dx, dy);
      let d2 = deficit(s, r, a, ct, true) ** 2;
      let ti2 = addedTI(s, r, a) ** 2;
      for (let k2 = 0; k2 < nbs.length; k2++) {
        const nb = nbs[k2];
        const sj = nb.z - z;
        if (sj <= 0) continue;
        const rj = Math.hypot(x - nb.x, ry);
        if (rj > 3 * R) continue;
        d2 += deficit(sj, rj, nb.a, nb.ct) ** 2;
        ti2 += addedTI(sj, rj, nb.a) ** 2;
      }
      const rat = 1 - Math.min(0.9, Math.sqrt(d2));
      // mean velocity: axial + continuity-driven radial expansion near the disc
      const u = U * rat;
      let vx = 0;
      let vy = 0;
      if (ct > 0 && s > -3 * R && s < 3 * D) {
        const dUds = (-U * a * R * R) / (s * s + R * R) ** 1.5;
        const vr = r < R ? -(r / 2) * dUds : -((R * R) / (2 * Math.max(r, 1))) * dUds;
        const rr = Math.max(r, 1e-3);
        vx += (vr * dx) / rr;
        vy += (vr * dy) / rr;
        if (s > 0 && r < R * 1.1) {
          // swirl, opposite to the clockwise-from-upwind rotor
          vx += -swirl * dy;
          vy += swirl * dx;
        }
      }
      // coherent turbulence, σ grows in wakes
      turbAt(FIELD, x, y, z, tSim, U, tmp.t);
      const sig = U * Math.sqrt(ti0 * ti0 + ti2);
      x += (vx + sig * tmp.t.x) * dt;
      y += (vy + sig * tmp.t.y) * dt;
      z += (-u + sig * tmp.t.z) * dt;
      if (z < Z_END || y < 2 || Math.abs(x) > XH + 2 * R) {
        seedPos(i, p);
        p.z = Z_SPAWN - Math.random() * 40;
        for (let j = 0; j < K; j++) hist.set([p.x, p.y, p.z], o + j * 3);
        x = p.x;
        y = p.y;
        z = p.z;
      }
      hist[o] = x;
      hist[o + 1] = y;
      hist[o + 2] = z;

      // pathline segments, alpha fading along the trail, at the domain ends
      // and next to the camera
      const near = Math.hypot(x - tmp.cam.x, y - tmp.cam.y, z - tmp.cam.z);
      const edge = Math.max(0, Math.min(1, (Z_SPAWN - z) / 150, (z - Z_END) / 250, (near - 30) / 90));
      tmp.c.lerpColors(tmp.slow, tmp.fast, Math.min(1, Math.max(0, (rat - 0.55) / 0.4)));
      for (let j = 0; j < K - 1; j++) {
        const v = (i * (K - 1) + j) * 2;
        const h0 = o + j * 3;
        const h1 = o + (j + 1) * 3;
        P[v * 3] = hist[h0];
        P[v * 3 + 1] = hist[h0 + 1];
        P[v * 3 + 2] = hist[h0 + 2];
        P[v * 3 + 3] = hist[h1];
        P[v * 3 + 4] = hist[h1 + 1];
        P[v * 3 + 5] = hist[h1 + 2];
        const a0 = edge * (1 - j / (K - 1)) * 0.9;
        const a1 = edge * (1 - (j + 1) / (K - 1)) * 0.9;
        C.set([tmp.c.r, tmp.c.g, tmp.c.b, a0, tmp.c.r, tmp.c.g, tmp.c.b, a1], v * 4);
      }
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
  });

  if (windMs < 0.5) return null;
  return (
    <group ref={frameRef} rotation={[0, windFrameYaw(windFromDeg), 0]}>
      <lineSegments geometry={geometry} frustumCulled={false}>
        <lineBasicMaterial vertexColors transparent depthWrite={false} toneMapped={false} />
      </lineSegments>
      {waked && (
        <Html position={[0, HUB[1] + R + 25, HUB[2]]} center zIndexRange={[9, 0]} style={{ pointerEvents: "none" }}>
          <div className="whitespace-nowrap rounded-md border-2 border-status-warning bg-bg-secondary/90 px-2.5 py-1 text-center text-text-primary shadow-lg">
            <div className="text-[12px] font-bold text-status-warning">
              In the wake of {waked.id} · {waked.dist.toFixed(1)} D upstream
            </div>
            <div className="text-[11px] font-semibold text-text-primary">
              wind −{(waked.deficit * 100).toFixed(0)} % · power ≈ −{((1 - (1 - waked.deficit) ** 3) * 100).toFixed(0)} %
              {waked.ti > 0.001 ? ` · TI +${(waked.ti * 100).toFixed(1)} pts` : " · wake edge"}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
});

// ── Compass ring on the sea (orientation reference) ─────────────────

/** Bearing (°) → direction on the water: N = +z, E = −x. */
const bearingVec = (deg: number, r: number): [number, number, number] => {
  const b = (deg * Math.PI) / 180;
  return [-Math.sin(b) * r, 0.6, Math.cos(b) * r];
};

/**
 * Compass ring around the tower base: 10° ticks, cardinal letters and a
 * short mark at the wind FROM bearing. The wind itself (direction, speed,
 * shear, gusts) is shown in the air by <WindProfile/>.
 */
export const WindCompass = memo(function WindCompass({ windFromDeg }: { windFromDeg: number }) {
  const ringR = 70;
  const ticks = useMemo(() => {
    const pts: number[] = [];
    for (let d = 0; d < 360; d += 10) {
      const inner = d % 90 === 0 ? ringR - 7 : d % 30 === 0 ? ringR - 4.5 : ringR - 2.5;
      const a = bearingVec(d, inner);
      const b = bearingVec(d, ringR);
      pts.push(a[0], 0.7, a[2], b[0], 0.7, b[2]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  const from = bearingVec(windFromDeg, ringR + 6);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.65, 0]}>
        <ringGeometry args={[ringR - 0.8, ringR + 0.8, 128]} />
        <meshBasicMaterial color="#e2e8f0" transparent opacity={0.6} depthWrite={false} />
      </mesh>
      <lineSegments geometry={ticks}>
        <lineBasicMaterial color="#e2e8f0" transparent opacity={0.7} />
      </lineSegments>
      {["N", "E", "S", "W"].map((l, i) => {
        const p = bearingVec(i * 90, ringR - 15);
        return (
          <Text key={l} position={[p[0], 0.8, p[2]]} rotation={[-Math.PI / 2, 0, Math.PI]} fontSize={9}
            color={l === "N" ? "#f87171" : "#f8fafc"} outlineWidth={0.4} outlineColor="#0f172a" anchorX="center" anchorY="middle">
            {l}
          </Text>
        );
      })}
      {/* wind FROM marker on the ring */}
      <mesh position={[from[0], 0.9, from[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[4, 24]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.9} depthWrite={false} />
      </mesh>
    </group>
  );
});

// ── Tip vortices (rotor frame) ────────────────────────────────────────

const VORTEX_PER_BLADE = 150;
const VORTEX_DT = 0.2; // s of age between tube segments (≈ 1.6 m at 8 m/s)

export const TipVortices = memo(function TipVortices({
  windMs,
  rotorRpm,
  tipZ,
}: {
  windMs: number;
  rotorRpm: number;
  /** Tip axial position in the rotor frame (precone + prebend − deflection) [m]. */
  tipZ: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const tmp = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      c: new THREE.Color(),
      p0: new THREE.Vector3(),
      p1: new THREE.Vector3(),
      mid: new THREE.Vector3(),
      dir: new THREE.Vector3(),
      q: new THREE.Quaternion(),
      s: new THREE.Vector3(),
      yAxis: new THREE.Vector3(0, 1, 0),
    }),
    [],
  );
  const ct = rotorRpm > 0.1 ? turbineThrustCoefficient(windMs) : 0;
  const a = inductionFromCt(ct);
  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const omega = (rotorRpm * 2 * Math.PI) / 60;
    const phi = rotorPhase.value;
    const uConv = windMs * (1 - a); // tip vortices convect near U(1−a)
    const tip = (b: number, age: number, out: THREE.Vector3) => {
      const s = uConv * age;
      const uc = 1 - a * (1 + s / Math.hypot(s, R));
      const rt = R * Math.sqrt((1 - a) / Math.max(uc, 0.3));
      const ang = (2 * Math.PI * b) / 3 - (phi - omega * age);
      return out.set(-rt * Math.sin(ang), rt * Math.cos(ang), tipZ - s);
    };
    let i = 0;
    for (let b = 0; b < 3; b++) {
      for (let k = 0; k < VORTEX_PER_BLADE; k++) {
        const age = k * VORTEX_DT;
        tip(b, age, tmp.p0);
        tip(b, age + VORTEX_DT, tmp.p1);
        tmp.mid.addVectors(tmp.p0, tmp.p1).multiplyScalar(0.5);
        tmp.dir.subVectors(tmp.p1, tmp.p0);
        const len = tmp.dir.length();
        tmp.q.setFromUnitVectors(tmp.yAxis, tmp.dir.normalize());
        const fade = Math.max(0, 1 - age / (VORTEX_PER_BLADE * VORTEX_DT));
        const core = (0.3 + 0.02 * age) * (0.4 + 0.6 * fade); // viscous core growth, fading
        tmp.s.set(core, len * 1.02, core);
        tmp.m.compose(tmp.mid, tmp.q, tmp.s);
        mesh.setMatrixAt(i, tmp.m);
        tmp.c.setRGB(0.55 + 0.4 * fade, 0.7 + 0.25 * fade, 1.0);
        mesh.setColorAt(i, tmp.c);
        i++;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });
  if (rotorRpm < 0.1 || windMs < 0.5) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, 3 * VORTEX_PER_BLADE]} frustumCulled={false}>
      <cylinderGeometry args={[1, 1, 1, 8, 1, true]} />
      <meshBasicMaterial transparent opacity={0.28} depthWrite={false} toneMapped={false} />
    </instancedMesh>
  );
});
