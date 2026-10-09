/**
 * Gradient descent on a 3D loss landscape (three.js / R3F).
 *
 *   L(w₁, w₂) = 0.35·w₁² + 1.4·w₂² + 0.6·sin(1.3·w₁)·cos(1.1·w₂)
 *   w ← w − η·∇L
 *
 * The valley is steeper along w₂ (curvature ≈ 2.8 + ripples), so stability
 * needs η < 2 / λ_max ≈ 0.6: η = 0.05 crawls, 0.2 glides in, 0.5 zig-zags
 * across the valley, 0.75 diverges — the four regimes every ML engineer
 * meets when choosing a learning rate.
 */

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";

const L = (x: number, y: number) => 0.35 * x * x + 1.4 * y * y + 0.6 * Math.sin(1.3 * x) * Math.cos(1.1 * y);
const grad = (x: number, y: number): [number, number] => [
  0.7 * x + 0.78 * Math.cos(1.3 * x) * Math.cos(1.1 * y),
  2.8 * y - 0.66 * Math.sin(1.3 * x) * Math.sin(1.1 * y),
];
const S = 0.22; // height scale (keeps the bowl inside the view)
const R = 3; // domain ±R
const START: [number, number] = [-2.6, 2.1];
const STEPS = 60;

function descend(eta: number) {
  const pts: [number, number][] = [START];
  let [x, y] = START;
  for (let i = 0; i < STEPS; i++) {
    const [gx, gy] = grad(x, y);
    x -= eta * gx;
    y -= eta * gy;
    if (!Number.isFinite(x) || Math.abs(x) > 50 || Math.abs(y) > 50) break;
    pts.push([x, y]);
  }
  return pts;
}

function Surface() {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(2 * R, 2 * R, 96, 96);
    g.rotateX(-Math.PI / 2);
    const pos = g.getAttribute("position");
    const col = new Float32Array(pos.count * 3);
    const low = new THREE.Color("#1d4ed8");
    const mid = new THREE.Color("#22d3ee");
    const high = new THREE.Color("#f97316");
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = L(x, z);
      pos.setY(i, h * S);
      const t = Math.min(1, h / 12);
      if (t < 0.35) c.lerpColors(low, mid, t / 0.35);
      else c.lerpColors(mid, high, (t - 0.35) / 0.65);
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <group>
      <mesh geometry={geo}>
        <meshStandardMaterial vertexColors roughness={0.55} metalness={0.05} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geo}>
        <meshBasicMaterial color="#0f172a" wireframe transparent opacity={0.08} />
      </mesh>
    </group>
  );
}

export default function GradientDescent3D({ lang }: { lang: "en" | "tr" }) {
  const [eta, setEta] = useState(0.2);
  const [k, setK] = useState(0);
  const path = useMemo(() => descend(eta), [eta]);
  const diverged = path.length < STEPS + 1 || Math.abs(path.at(-1)![0]) > R || Math.abs(path.at(-1)![1]) > R;

  useEffect(() => {
    if (k >= path.length - 1) return;
    const id = setTimeout(() => setK((v) => v + 1), 140);
    return () => clearTimeout(id);
  }, [k, path.length]);

  const clamp = (v: number) => Math.max(-R, Math.min(R, v));
  const pts = path.slice(0, k + 1).map(([x, y]) => new THREE.Vector3(clamp(x), Math.min(L(x, y), 14) * S + 0.06, clamp(y)));
  const [bx, by] = path[Math.min(k, path.length - 1)];
  const t = (en: string, tr: string) => (lang === "tr" ? tr : en);

  return (
    <div className="rounded-lg border border-border-primary bg-bg-primary p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-text-primary">{t("learning rate η", "öğrenme oranı η")}</span>
        {[
          [0.05, t("too small", "çok küçük")],
          [0.2, t("good", "iyi")],
          [0.5, t("zig-zag", "zikzak")],
          [0.75, t("diverges", "ıraksar")],
        ].map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => {
              setEta(v as number);
              setK(0);
            }}
            className={`rounded-md border px-2 py-0.5 font-semibold ${eta === v ? "border-accent bg-accent text-accent-ink" : "border-border-primary hover:bg-bg-hover"}`}
          >
            {v} · {label}
          </button>
        ))}
        <button type="button" onClick={() => setK(0)} className="rounded-md border border-border-primary px-2 py-0.5 hover:bg-bg-hover">
          {t("replay", "tekrar")}
        </button>
        <span className="ml-auto font-mono tabular-nums text-text-secondary">
          {t("step", "adım")} {k} · L = {L(bx, by).toFixed(3)}
          {diverged && k >= path.length - 1 ? ` · ${t("diverged!", "ıraksadı!")}` : ""}
        </span>
      </div>
      <div className="h-[300px] overflow-hidden rounded-md">
        <Canvas camera={{ position: [4.5, 9.5, 6.2], fov: 42 }} dpr={[1, 2]}>
          <color attach="background" args={["#0b1220"]} />
          <ambientLight intensity={0.6} />
          <directionalLight position={[4, 8, 3]} intensity={1.2} />
          <Surface />
          {pts.length > 1 && <Line points={pts} color="#fde047" lineWidth={2.5} />}
          {pts.length > 0 && (
            <mesh position={pts[pts.length - 1]}>
              <sphereGeometry args={[0.16, 24, 24]} />
              <meshStandardMaterial color="#fde047" emissive="#fbbf24" emissiveIntensity={0.6} />
            </mesh>
          )}
          <OrbitControls target={[0, 0.2, 0]} enablePan={false} minDistance={5} maxDistance={16} autoRotate autoRotateSpeed={0.4} />
        </Canvas>
      </div>
      <p className="mt-1.5 text-xs text-text-muted">
        {t(
          "Surface height = loss L(w₁, w₂); colour blue (low) → orange (high). Drag to rotate. The yellow ball is the model's two weights after each update w ← w − η∇L.",
          "Yüzey yüksekliği = kayıp L(w₁, w₂); renk mavi (düşük) → turuncu (yüksek). Döndürmek için sürükleyin. Sarı top, her w ← w − η∇L güncellemesinden sonra modelin iki ağırlığıdır.",
        )}
      </p>
    </div>
  );
}
