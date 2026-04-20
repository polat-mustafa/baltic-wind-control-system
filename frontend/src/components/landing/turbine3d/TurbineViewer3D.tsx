/**
 * Interactive 3D V236-15.0 MW turbine viewer.
 *
 * Top-level canvas component — code-split via React.lazy.
 *
 * Responsibilities:
 *   1. WebGL detection → renders WebGLFallback if unavailable
 *   2. R3F Canvas with ACESFilmic tone mapping
 *   3. SceneEnvironment (Sky, IBL, fog, lights) from Phase 1
 *   4. V236Turbine scene graph driven by live store state
 *   5. MeasurementLayer (annotation overlay) inside Canvas
 *   6. HTML overlays: ViewerControls, ViewerLegend, HUD
 *   7. Camera fly-to on part selection (eased, bounds-derived)
 *   8. Full post-processing stack: SMAA + SSAO + Bloom + Outline + Vignette
 *   9. Keyboard shortcuts (F, R, 1-3, S, Esc, +/-)
 */

import { Suspense, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, PerformanceMonitor } from "@react-three/drei";
import {
  EffectComposer,
  Outline,
  Bloom,
  SMAA,
  ToneMapping,
  Vignette,
} from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import type { Object3D } from "three";

import {
  useLandingStore,
  selectTurbine,
  selectKPIs,
  selectTurbinePart,
  selectViewerMode,
  selectAnnotationFlag,
  selectThermalOverlay,
  selectSensorMarkers,
  selectPowerFlow,
  selectInteriorView,
  selectTimeOfDay,
  selectSkyPreset,
  selectWindField,
  selectWindTriangle,
  selectBladeFieldMode,
  selectLossHUD,
  selectCpWidget,
} from "../../../store/landingStore";
import type { TurbinePartId } from "../../../constants/turbinePartEducation";
import type { TurbineData } from "../../../types/landing";

import { V236Turbine } from "./scene/V236Turbine";
import { SeaPlane } from "./scene/SeaPlane";
import { WakeParticles } from "./scene/WakeParticles";
import { ArrayCables } from "./scene/ArrayCables";
import { HumanScaleFigure } from "./scene/HumanScaleFigure";
import { MeasurementLayer } from "./scene/MeasurementLayer";
import { SceneEnvironment } from "./scene/Environment";
import { ThermalOverlay } from "./scene/ThermalOverlay";
import { SensorMarkers, SensorLegend } from "./scene/SensorMarkers";
import { PowerFlowParticles } from "./scene/PowerFlowParticles";
import { HealthBadges } from "./scene/HealthBadges";
import { WindFieldViz } from "./scene/WindFieldViz";
import { WindTriangle } from "./scene/WindTriangle";
import { NacelleInteriorDetail } from "./scene/NacelleInteriorDetail";
import { ViewerControls } from "./ui/ViewerControls";
import { ViewerLegend } from "./ui/ViewerLegend";
import { LossBreakdownHUD } from "./ui/LossBreakdownHUD";
import { CpLambdaWidget } from "./ui/CpLambdaWidget";
import { CompassWidget, ScaleBar, CameraModeBadge, KeyboardHelp } from "./ui/ViewerHUD";
import WebGLFallback from "./ui/WebGLFallback";
import { useAnnotationCatalog } from "./hooks/useAnnotationCatalog";
import { useCameraFlyTo } from "./hooks/useCameraFlyTo";
import { useViewerKeyboard } from "./hooks/useViewerKeyboard";
import { DEFAULT_CAMERA_TARGET } from "./registry/partMeshRegistry";
import { NacelleSchematic } from "./schematic/NacelleSchematic";

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

interface TurbineSceneProps {
  turbineId: string;
  explodedOffset: number;
  showHumanFigure: boolean;
  showThermal: boolean;
  showSensors: boolean;
  showPowerFlow: boolean;
  showWindField: boolean;
  showWindTriangle: boolean;
  bladeFieldMode: "off" | "thermal" | "pressure" | "strain";
  manualWindMs: number;
  overridePitch?: number;
  overrideRpm?: number;
  onSelectPart: (id: TurbinePartId) => void;
  onMetricsReady?: (metresPerPixel: number) => void;
}

function TurbineScene({
  turbineId,
  explodedOffset,
  showHumanFigure,
  showThermal,
  showSensors,
  showPowerFlow,
  showWindField,
  showWindTriangle,
  bladeFieldMode,
  manualWindMs,
  overridePitch,
  overrideRpm,
  onSelectPart,
  onMetricsReady,
}: TurbineSceneProps) {
  const selectedPart = useLandingStore(selectTurbinePart);
  const viewerMode = useLandingStore(selectViewerMode);
  const interiorView = useLandingStore(selectInteriorView);
  const showAnnotations = useLandingStore(selectAnnotationFlag);
  const timeOfDay = useLandingStore(selectTimeOfDay);
  const skyPreset = useLandingStore(selectSkyPreset);
  const annotations = useAnnotationCatalog(turbineId);

  const turbineForRpm = useLandingStore(selectTurbine(turbineId));
  const sceneRpm = overrideRpm ?? (turbineForRpm?.rotorSpeedRpm ?? 0);

  // ── Outline glow — find mesh by name matching selectedPart ──────
  const { scene, camera, size } = useThree();
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

  // ── Scale-bar metric: metres per screen pixel at camera pivot distance
  useEffect(() => {
    if (!onMetricsReady) return;
    const updateMetric = () => {
      const persp = camera as THREE.PerspectiveCamera;
      if (!persp.isPerspectiveCamera) return;
      const pivot = new THREE.Vector3(0, 80, 0);
      const distance = camera.position.distanceTo(pivot);
      const vFov = (persp.fov * Math.PI) / 180;
      const heightAtDistance = 2 * Math.tan(vFov / 2) * distance;
      onMetricsReady(heightAtDistance / size.height);
    };
    updateMetric();
    const id = setInterval(updateMetric, 500);
    return () => clearInterval(id);
  }, [camera, size.height, onMetricsReady]);

  // Hide 3D scene but keep camera alive when user toggles to schematic.
  // We just render the scene at very low opacity via fog — simpler than teardown.

  return (
    <>
      <SceneEnvironment timeOfDay={timeOfDay} skyPreset={skyPreset} />

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
        windMs={manualWindMs}
        bladeFieldMode={bladeFieldMode}
      />

      {/* Human scale figure */}
      {showHumanFigure && <HumanScaleFigure />}

      {/* Annotation layer */}
      {showAnnotations && (
        <MeasurementLayer annotations={annotations} />
      )}

      {/* D1 — Thermal overlay */}
      {showThermal && (viewerMode === "cutaway" || viewerMode === "exploded") && (
        <ThermalOverlay turbineId={turbineId} />
      )}

      {/* D2 — Sensor markers */}
      {showSensors && (viewerMode === "cutaway" || viewerMode === "exploded") && (
        <SensorMarkers onSelectPart={onSelectPart} />
      )}

      {/* D3 — Power flow animation */}
      {showPowerFlow && <PowerFlowParticles turbineId={turbineId} />}

      {/* D5 — Wind-field visualization (freestream, streamlines, wake, tip-speed) */}
      {showWindField && (
        <WindFieldViz
          windMs={manualWindMs}
          rotorSpeedRpm={turbineForRpm?.rotorSpeedRpm ?? 0}
          yawDeg={turbineForRpm?.nacellePositionDeg ?? 0}
        />
      )}

      {/* D5b — Apparent-wind triangle (Pythagoras) */}
      {showWindTriangle && (
        <WindTriangle
          windMs={manualWindMs}
          rotorSpeedRpm={turbineForRpm?.rotorSpeedRpm ?? 0}
          rotorAzimuth={0}
          pitchDeg={turbineForRpm?.pitchAngleDeg ?? 0}
          yawDeg={turbineForRpm?.nacellePositionDeg ?? 0}
        />
      )}

      {/* D6 — Nacelle interior fine-detail (stator slots, end windings, oil loop, labels) */}
      <NacelleInteriorDetail
        turbineId={turbineId}
        viewerMode={viewerMode}
        showLabels={showAnnotations}
      />

      {/* D4 — Health badges */}
      {(viewerMode === "cutaway" || viewerMode === "exploded") && (
        <HealthBadges turbineId={turbineId} />
      )}

      {/* Post-processing stack */}
      <EffectComposer enableNormalPass multisampling={0}>
        <SMAA />
        <Bloom
          intensity={0.4}
          luminanceThreshold={0.92}
          luminanceSmoothing={0.22}
          mipmapBlur
        />
        <Outline
          selection={outlineTargets}
          edgeStrength={5}
          visibleEdgeColor={0x60a5fa}
          hiddenEdgeColor={0x1e3a8a}
          blur
          xRay
        />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Vignette offset={0.32} darkness={0.38} blendFunction={BlendFunction.NORMAL} />
      </EffectComposer>

      {/* Fade scene when schematic is active — user still feels atmosphere */}
      {interiorView === "schematic" && (
        <mesh position={[0, 80, 0]} renderOrder={999}>
          <sphereGeometry args={[1200, 16, 16]} />
          <meshBasicMaterial color="#0a1320" transparent opacity={0.55} side={THREE.BackSide} depthWrite={false} />
        </mesh>
      )}

      {/* Camera controls */}
      <OrbitControls
        makeDefault
        minDistance={8}
        maxDistance={650}
        target={[0, 80, 0]}
        enableDamping
        dampingFactor={0.12}
        rotateSpeed={0.7}
        zoomSpeed={0.9}
        panSpeed={0.6}
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI * 0.49}
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
  const [manualRun, setManualRun] = useState<boolean | null>(null);
  const [manualWindMs, setManualWindMs] = useState<number>(11);
  const [metresPerPixel, setMetresPerPixel] = useState(0.5);

  const containerRef = useRef<HTMLDivElement>(null);

  // V236 power-curve model driving live rpm & pitch from the slider.
  //   Below cut-in (3 m/s):  rpm=0, pitch=90°
  //   Cut-in → rated (11.1):  rpm ∝ wind, pitch=0
  //   Rated → cut-out (31):   rpm=rated, pitch ramps 0°→25°
  //   Above cut-out:          rpm=0, pitch=90°
  const CUT_IN = 3, RATED = 11.1, CUT_OUT = 31, RATED_RPM = 9.55;
  const windForSim = manualRun === false ? 0 : manualWindMs;
  let computedRpm = 0;
  let computedPitch = 90;
  if (windForSim >= CUT_IN && windForSim <= CUT_OUT) {
    if (windForSim <= RATED) {
      computedRpm = (windForSim / RATED) * RATED_RPM;
      computedPitch = 0;
    } else {
      computedRpm = RATED_RPM;
      computedPitch = ((windForSim - RATED) / (CUT_OUT - RATED)) * 25;
    }
  }
  const overridePitch = computedPitch;
  const overrideRpm   = computedRpm;

  const selectedPart = useLandingStore(selectTurbinePart);
  const viewerMode = useLandingStore(selectViewerMode);
  const interiorView = useLandingStore(selectInteriorView);
  const showAnnotationLayer = useLandingStore(selectAnnotationFlag);
  const showThermalOverlay = useLandingStore(selectThermalOverlay);
  const showSensorMarkers = useLandingStore(selectSensorMarkers);
  const showPowerFlow = useLandingStore(selectPowerFlow);
  const showWindField = useLandingStore(selectWindField);
  const showWindTriangle = useLandingStore(selectWindTriangle);
  const bladeFieldMode = useLandingStore(selectBladeFieldMode);
  const showLossHUD = useLandingStore(selectLossHUD);
  const showCpWidget = useLandingStore(selectCpWidget);
  const skyPreset = useLandingStore(selectSkyPreset);
  const kpis = useLandingStore(selectKPIs);
  const turbineState = useLandingStore(selectTurbine(turbineId));
  const setSelectedPart = useLandingStore((s) => s.setSelectedTurbinePart);
  const setViewerMode = useLandingStore((s) => s.setViewerMode);
  const setInteriorView = useLandingStore((s) => s.setInteriorView);
  const setSkyPreset = useLandingStore((s) => s.setSkyPreset);
  const setShowAnnotations = useLandingStore((s) => s.setShowAnnotationLayer);
  const setShowThermal = useLandingStore((s) => s.setShowThermalOverlay);
  const setShowSensors = useLandingStore((s) => s.setShowSensorMarkers);
  const setShowPowerFlow = useLandingStore((s) => s.setShowPowerFlow);
  const setShowWindField = useLandingStore((s) => s.setShowWindField);
  const setShowWindTriangle = useLandingStore((s) => s.setShowWindTriangle);
  const setBladeFieldMode = useLandingStore((s) => s.setBladeFieldMode);
  const setShowLossHUD = useLandingStore((s) => s.setShowLossHUD);
  const setShowCpWidget = useLandingStore((s) => s.setShowCpWidget);
  const resetViewerDefaults = useLandingStore((s) => s.resetViewerDefaults);

  // Auto-cutaway on interior part
  useEffect(() => {
    const internalParts: TurbinePartId[] = ["gearbox", "generator", "shaft", "bearing", "brake", "converter"];
    if (selectedPart && internalParts.includes(selectedPart) && viewerMode === "normal") {
      setViewerMode("cutaway");
    }
  }, [selectedPart, viewerMode, setViewerMode]);

  useEffect(() => {
    if (viewerMode !== "exploded") setExplodedOffset(0);
  }, [viewerMode]);

  const handleResetCamera = useCallback(() => {
    // Full reset: clears all overlays, modes, sky, selection in the store,
    // plus this component's local UI state (manual run, wind, exploded, scale figure).
    // Clearing selectedTurbinePart also triggers the existing fly-to-default-camera effect.
    resetViewerDefaults();
    setManualRun(null);
    setManualWindMs(11);
    setExplodedOffset(0);
    setShowHumanFigure(false);
  }, [resetViewerDefaults]);

  const handleFitToSelected = useCallback(() => {
    // Trigger a re-run of the fly-to effect by clearing and re-setting the part.
    const current = useLandingStore.getState().selectedTurbinePart;
    if (current) {
      setSelectedPart(null);
      // A tick later, re-select so fly-to fires with current bounds.
      requestAnimationFrame(() => setSelectedPart(current));
    }
  }, [setSelectedPart]);

  const handleZoom = useCallback((delta: number) => {
    // Can't reach OrbitControls directly from here — we adjust minDistance proxy.
    // Simplest: dispatch a wheel event to the canvas.
    const canvas = containerRef.current?.querySelector("canvas");
    if (!canvas) return;
    const event = new WheelEvent("wheel", { deltaY: delta * 80, bubbles: true });
    canvas.dispatchEvent(event);
  }, []);

  useViewerKeyboard({
    containerRef,
    onFit: handleFitToSelected,
    onReset: handleResetCamera,
    onZoom: handleZoom,
  });

  const handleToggleRun = useCallback(() => {
    setManualRun((prev) => (prev === false ? null : false));
  }, []);

  const handleToggleThermal = useCallback(() => {
    if (!showThermalOverlay && viewerMode === "normal") setViewerMode("cutaway");
    setShowThermal(!showThermalOverlay);
  }, [showThermalOverlay, viewerMode, setViewerMode, setShowThermal]);

  const handleToggleSensors = useCallback(() => {
    if (!showSensorMarkers && viewerMode === "normal") setViewerMode("cutaway");
    setShowSensors(!showSensorMarkers);
  }, [showSensorMarkers, viewerMode, setViewerMode, setShowSensors]);

  const handleTogglePowerFlow = useCallback(() => {
    if (!showPowerFlow && viewerMode === "normal") setViewerMode("cutaway");
    setShowPowerFlow(!showPowerFlow);
  }, [showPowerFlow, viewerMode, setViewerMode, setShowPowerFlow]);

  const compassWind = kpis?.windDirectionDeg ?? 225;
  const nacelleYaw = turbineState?.nacellePositionDeg ?? 225;

  const glProps = useMemo(
    () => ({
      antialias: false,            // handled by SMAA in composer
      powerPreference: "high-performance" as const,
      toneMapping: THREE.ACESFilmicToneMapping,
      outputColorSpace: THREE.SRGBColorSpace,
    }),
    [],
  );

  if (!webGLOk) {
    return <WebGLFallback turbine={turbine} />;
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full rounded-lg overflow-hidden border border-border-primary bg-[#06090f] focus:outline-none"
    >
      <Canvas
        dpr={dpr}
        camera={{
          position: DEFAULT_CAMERA_TARGET.position,
          fov: 45,
          near: 0.5,
          far: 6000,
        }}
        shadows
        gl={glProps}
        onCreated={({ gl }) => {
          gl.localClippingEnabled = true;
        }}
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
            showThermal={showThermalOverlay}
            showSensors={showSensorMarkers}
            showPowerFlow={showPowerFlow}
            showWindField={showWindField}
            showWindTriangle={showWindTriangle}
            bladeFieldMode={bladeFieldMode}
            manualWindMs={manualWindMs}
            overridePitch={overridePitch}
            overrideRpm={overrideRpm}
            onSelectPart={setSelectedPart}
            onMetricsReady={setMetresPerPixel}
          />
        </Suspense>
      </Canvas>

      {/* 2D Isometric schematic — overlaid on top of faded 3D canvas */}
      {interiorView === "schematic" && (
        <div className="absolute inset-0 z-20 pointer-events-none">
          <NacelleSchematic turbineId={turbineId} />
        </div>
      )}

      {/* HTML overlays */}
      <ViewerControls
        viewerMode={viewerMode}
        interiorView={interiorView}
        skyPreset={skyPreset}
        showAnnotationLayer={showAnnotationLayer}
        showHumanFigure={showHumanFigure}
        showThermalOverlay={showThermalOverlay}
        showSensorMarkers={showSensorMarkers}
        showPowerFlow={showPowerFlow}
        showWindField={showWindField}
        showWindTriangle={showWindTriangle}
        bladeFieldMode={bladeFieldMode}
        showLossHUD={showLossHUD}
        showCpWidget={showCpWidget}
        onResetCamera={handleResetCamera}
        onViewerModeChange={setViewerMode}
        onInteriorViewChange={setInteriorView}
        onSkyPresetChange={setSkyPreset}
        onToggleAnnotations={() => setShowAnnotations(!showAnnotationLayer)}
        onToggleHumanFigure={() => setShowHumanFigure((v) => !v)}
        onToggleThermal={handleToggleThermal}
        onToggleSensors={handleToggleSensors}
        onTogglePowerFlow={handleTogglePowerFlow}
        onToggleWindField={() => setShowWindField(!showWindField)}
        onToggleWindTriangle={() => setShowWindTriangle(!showWindTriangle)}
        onBladeFieldModeChange={setBladeFieldMode}
        onToggleLossHUD={() => setShowLossHUD(!showLossHUD)}
        onToggleCpWidget={() => setShowCpWidget(!showCpWidget)}
        onToggleRun={handleToggleRun}
        isRunning={manualRun !== false}
        manualWindMs={manualWindMs}
        onWindSpeedChange={setManualWindMs}
      />

      {/* Educational HUDs */}
      {showLossHUD && <LossBreakdownHUD onClose={() => setShowLossHUD(false)} />}
      {showCpWidget && (
        <CpLambdaWidget
          turbineId={turbineId}
          windMs={manualWindMs}
          onClose={() => setShowCpWidget(false)}
        />
      )}

      {viewerMode === "exploded" && interiorView === "3d" && (
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

      {showSensorMarkers && <SensorLegend />}

      {/* HUD widgets */}
      <CompassWidget windDirectionDeg={compassWind} nacelleYawDeg={nacelleYaw} />
      <CameraModeBadge />
      <ScaleBar metresPerPixel={metresPerPixel} />
      <KeyboardHelp />

      {/* Turbine ID badge */}
      <div className="absolute top-2 left-2 z-10 bg-bg-secondary/80 backdrop-blur-sm rounded px-2 py-0.5 border border-border-primary">
        <span className="text-[10px] font-mono text-text-muted">{turbineId}</span>
        <span className="text-[9px] font-mono text-text-muted opacity-60 ml-1">· V236-15.0 MW</span>
      </div>
    </div>
  );
}

