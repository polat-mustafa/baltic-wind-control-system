/**
 * Interactive 3D V236-15.0 MW turbine viewer.
 *
 * Top-level canvas component — code-split via React.lazy.
 *
 * Responsibilities:
 *   1. WebGL detection → renders WebGLFallback if unavailable
 *   2. R3F Canvas with Environment, OrbitControls, lights
 *   3. V236Turbine scene graph driven by live store state
 *   4. MeasurementLayer (annotation overlay) inside Canvas
 *   5. HTML overlays (ViewerControls, ViewerLegend) outside Canvas
 *   6. Camera fly-to on part selection (via useCameraFlyTo effect)
 *   7. Bi-directional part selection: clicks in 3D fire setSelectedTurbinePart
 *
 * Layout: fills its parent container (parent sets width/height).
 * The parent (LandingPage) determines the 600 px width.
 */

import { Suspense, useEffect, useState, useCallback } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, PerformanceMonitor } from "@react-three/drei";
import { EffectComposer, Outline } from "@react-three/postprocessing";
import type { Object3D } from "three";

import {
  useLandingStore,
  selectTurbine,
  selectTurbinePart,
  selectViewerMode,
  selectAnnotationFlag,
} from "../../../store/landingStore";
import type { TurbinePartId } from "../../../constants/turbinePartEducation";
import type { TurbineData } from "../../../types/landing";

import { V236Turbine } from "./scene/V236Turbine";
import { SeaPlane } from "./scene/SeaPlane";
import { WakeParticles } from "./scene/WakeParticles";
import { ArrayCables } from "./scene/ArrayCables";
import { HumanScaleFigure } from "./scene/HumanScaleFigure";
import { MeasurementLayer } from "./scene/MeasurementLayer";
import { ViewerControls } from "./ui/ViewerControls";
import { ViewerLegend } from "./ui/ViewerLegend";
import WebGLFallback from "./ui/WebGLFallback";
import { useAnnotationCatalog } from "./hooks/useAnnotationCatalog";
import { useCameraFlyTo } from "./hooks/useCameraFlyTo";
import { DEFAULT_CAMERA_TARGET } from "./registry/partMeshRegistry";

// ── WebGL detection ──────────────────────────────────────────────

function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

// ── Inner scene (runs inside Canvas context) ─────────────────────

function TurbineScene({
  turbineId,
  explodedOffset,
  showHumanFigure,
  overridePitch,
  overrideRpm,
}: {
  turbineId: string;
  explodedOffset: number;
  showHumanFigure: boolean;
  overridePitch?: number;
  overrideRpm?: number;
}) {
  const selectedPart = useLandingStore(selectTurbinePart);
  const viewerMode = useLandingStore(selectViewerMode);
  const showAnnotations = useLandingStore(selectAnnotationFlag);
  const annotations = useAnnotationCatalog(turbineId);

  const turbineForRpm = useLandingStore(selectTurbine(turbineId));
  const sceneRpm = overrideRpm ?? (turbineForRpm?.rotorSpeedRpm ?? 0);

  // ── Outline glow — find mesh by name matching selectedPart ──────
  const { scene } = useThree();
  const [outlineTargets, setOutlineTargets] = useState<Object3D[]>([]);

  useEffect(() => {
    if (!selectedPart) { setOutlineTargets([]); return; }
    const obj = scene.getObjectByName(selectedPart);
    setOutlineTargets(obj ? [obj] : []);
  }, [selectedPart, scene]);

  // ── Camera fly-to on part selection ─────────────────────────────
  const flyTo = useCameraFlyTo();

  useEffect(() => {
    flyTo(selectedPart);
  }, [selectedPart, flyTo]);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[100, 200, 100]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight position={[-80, 100, -60]} intensity={0.4} color="#b0c8ff" />

      {/* Environment (CC0 neutral — no external fetch needed) */}
      <Environment preset="sunset" />

      {/* Sea */}
      <SeaPlane />
      <WakeParticles rpm={sceneRpm} />
      <ArrayCables />

      {/* Turbine */}
      <V236Turbine
        turbineId={turbineId}
        selectedPart={selectedPart}
        viewerMode={viewerMode}
        explodedOffset={explodedOffset}
        overridePitch={overridePitch}
        overrideRpm={overrideRpm}
      />

      {/* Human scale figure */}
      {showHumanFigure && <HumanScaleFigure />}

      {/* Annotation layer */}
      {showAnnotations && (
        <MeasurementLayer annotations={annotations} />
      )}

      {/* Outline glow on selected part */}
      <EffectComposer autoClear={false} multisampling={4}>
        <Outline
          selection={outlineTargets}
          edgeStrength={6}
          visibleEdgeColor={0x60a5fa}
          hiddenEdgeColor={0x1e3a8a}
          blur
          xRay
        />
      </EffectComposer>

      {/* Camera controls */}
      <OrbitControls
        makeDefault
        minDistance={20}
        maxDistance={500}
        target={[0, 80, 0]}
        enableDamping
        dampingFactor={0.08}
      />
    </>
  );
}

// ── Main component ────────────────────────────────────────────────

interface TurbineViewer3DProps {
  turbineId: string;
  turbine: TurbineData;
}

export default function TurbineViewer3D({ turbineId, turbine }: TurbineViewer3DProps) {
  const [webGLOk] = useState(() => isWebGLAvailable());
  const [explodedOffset, setExplodedOffset] = useState(0);
  const [showHumanFigure, setShowHumanFigure] = useState(false);
  const [dpr, setDpr] = useState(Math.min(window.devicePixelRatio, 2));
  const [manualRun, setManualRun] = useState<boolean | null>(null); // null=auto, false=stopped
  const [manualWindMs, setManualWindMs] = useState<number>(11);

  // Derived overrides — undefined means "let store drive"
  const overridePitch = manualRun === false ? 90 : manualRun === true ? 0 : undefined;
  const overrideRpm   = manualRun === false ? 0  : undefined;

  const selectedPart = useLandingStore(selectTurbinePart);
  const viewerMode = useLandingStore(selectViewerMode);
  const showAnnotationLayer = useLandingStore(selectAnnotationFlag);
  const setSelectedPart = useLandingStore((s) => s.setSelectedTurbinePart);
  const setViewerMode = useLandingStore((s) => s.setViewerMode);
  const setShowAnnotations = useLandingStore((s) => s.setShowAnnotationLayer);

  // When an internal part is selected, auto-switch to cutaway
  useEffect(() => {
    const internalParts: TurbinePartId[] = ["gearbox", "generator", "shaft", "bearing", "brake", "converter"];
    if (selectedPart && internalParts.includes(selectedPart) && viewerMode === "normal") {
      setViewerMode("cutaway");
    }
  }, [selectedPart, viewerMode, setViewerMode]);

  // Exploded offset from slider (0 when not in exploded mode)
  useEffect(() => {
    if (viewerMode !== "exploded") setExplodedOffset(0);
  }, [viewerMode]);

  const handleResetCamera = useCallback(() => {
    setSelectedPart(null);
  }, [setSelectedPart]);

  const handleToggleRun = useCallback(() => {
    setManualRun((prev) => (prev === false ? null : false));
  }, []);

  if (!webGLOk) {
    return <WebGLFallback turbine={turbine} />;
  }

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden border border-border-primary bg-[#06090f]">
      {/* R3F Canvas */}
      <Canvas
        dpr={dpr}
        camera={{
          position: DEFAULT_CAMERA_TARGET.position,
          fov: 45,
          near: 0.5,
          far: 2000,
        }}
        shadows
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <PerformanceMonitor
          onDecline={() => setDpr(1)}
          onIncline={() => setDpr(Math.min(window.devicePixelRatio, 2))}
        />
        <Suspense fallback={null}>
          <TurbineScene
            turbineId={turbineId}
            explodedOffset={explodedOffset}
            showHumanFigure={showHumanFigure}
            overridePitch={overridePitch}
            overrideRpm={overrideRpm}
          />
        </Suspense>
      </Canvas>

      {/* HTML overlays — outside Canvas */}
      <ViewerControls
        viewerMode={viewerMode}
        showAnnotationLayer={showAnnotationLayer}
        showHumanFigure={showHumanFigure}
        onResetCamera={handleResetCamera}
        onViewerModeChange={setViewerMode}
        onToggleAnnotations={() => setShowAnnotations(!showAnnotationLayer)}
        onToggleHumanFigure={() => setShowHumanFigure((v) => !v)}
        onToggleRun={handleToggleRun}
        isRunning={manualRun !== false}
        manualWindMs={manualWindMs}
        onWindSpeedChange={setManualWindMs}
      />

      {viewerMode === "exploded" && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-bg-secondary/80 rounded px-3 py-1.5 border border-border-primary">
          <span className="text-[9px] text-text-muted font-mono">Explode</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={explodedOffset}
            onChange={(e) => setExplodedOffset(parseFloat(e.target.value))}
            className="w-24 accent-accent"
          />
          <span className="text-[9px] text-text-muted font-mono w-6">{Math.round(explodedOffset * 100)}%</span>
        </div>
      )}

      <ViewerLegend turbineId={turbineId} />

      {/* Turbine ID badge */}
      <div className="absolute top-2 left-2 z-10 bg-bg-secondary/80 backdrop-blur-sm rounded px-2 py-0.5 border border-border-primary">
        <span className="text-[10px] font-mono text-text-muted">{turbineId}</span>
        <span className="text-[9px] font-mono text-text-muted opacity-60 ml-1">· V236-15.0 MW</span>
      </div>
    </div>
  );
}
