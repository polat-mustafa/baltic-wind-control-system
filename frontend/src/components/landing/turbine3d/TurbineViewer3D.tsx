/**
 * Interactive 3D viewer of the SB-510 turbine (15 MW "V236 class", modelled with the IEA 15 MW reference).
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
  DepthOfField,
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
  YAW_PAUSE_DEG,
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
  selectWindDirection,
  selectWindTriangle,
  selectBladeFieldMode,
  selectLossHUD,
  selectCpWidget,
} from "../../../store/landingStore";
import { useNacelleSubsystemsStore } from "../../../store/nacelleSubsystemsStore";
import type { TurbinePartId } from "../../../constants/turbinePartEducation";
import type { TurbineData } from "../../../types/landing";

import { V236Turbine } from "./scene/V236Turbine";
import { SeaPlane } from "./scene/SeaPlane";
import { ArrayCables } from "./scene/ArrayCables";
import { HumanScaleFigure } from "./scene/HumanScaleFigure";
import { MeasurementLayer } from "./scene/MeasurementLayer";
import { SceneEnvironment } from "./scene/Environment";
import { ThermalLegend, ThermalOverlay } from "./scene/ThermalOverlay";
import { SensorMarkers, SensorLegend } from "./scene/SensorMarkers";
import { PowerFlowParticles } from "./scene/PowerFlowParticles";
import { HealthBadges } from "./scene/HealthBadges";
import { WindFieldViz } from "./scene/WindFieldViz";
import { WindCompass, WindFlow } from "./scene/WindFlow";
import { FarmTurbines } from "./scene/FarmTurbines";
import { WindProfile } from "./scene/WindProfile";
import { CameraHeadingProbe } from "./hooks/useCameraHeading";
import { WakeField } from "./scene/WakeField";
import { FaultBeacon, ServiceCraft } from "./scene/FaultAndService";
import { InNacelleFrame } from "./scene/InNacelleFrame";
import { HUB, SHAFT_TILT } from "./model/layout";
import { WindTriangle } from "./scene/WindTriangle";
import { NacelleInteriorDetail } from "./scene/NacelleInteriorDetail";
import { ViewerControls } from "./ui/ViewerControls";
import { PartInfoCard, PartRail } from "./ui/PartInfoCard";
import { AnalyticsPanel } from "./ui/AnalyticsPanel";
import { ViewerLegend } from "./ui/ViewerLegend";
import { BladeFieldLegend } from "./ui/BladeFieldLegend";
import { LossBreakdownHUD } from "./ui/LossBreakdownHUD";
import { CpLambdaWidget } from "./ui/CpLambdaWidget";
import { CompassWidget, ScaleBar, CameraModeBadge, KeyboardHelp } from "./ui/ViewerHUD";
import WebGLFallback from "./ui/WebGLFallback";
import { useAnnotationCatalog } from "./hooks/useAnnotationCatalog";
import { useCameraFlyTo } from "./hooks/useCameraFlyTo";
import { useViewerKeyboard } from "./hooks/useViewerKeyboard";
import { DEFAULT_CAMERA_TARGET } from "./registry/partMeshRegistry";
import { NacelleSchematic } from "./schematic/NacelleSchematic";
import { v236PitchDeg, v236RotorRpm } from "../../../utils/landingPhysics";
import { SceneErrorBoundary } from "./SceneErrorBoundary";

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
  showWindDirection: boolean;
  showWindTriangle: boolean;
  bladeFieldMode: "off" | "thermal" | "pressure" | "bending";
  manualWindMs: number;
  windDirectionDeg: number;
  overridePitch?: number;
  overrideRpm?: number;
  onSelectPart: (id: TurbinePartId) => void;
  onMetricsReady?: (metresPerPixel: number) => void;
  /** GPU can't hold the frame rate: skip depth of field and bloom. */
  lowFx: boolean;
  /** Bumped by "Reset view": flies the camera home even with no part selected. */
  resetNonce: number;
}

function TurbineScene({
  turbineId,
  explodedOffset,
  showHumanFigure,
  showThermal,
  showSensors,
  showPowerFlow,
  showWindField,
  showWindDirection,
  showWindTriangle,
  bladeFieldMode,
  manualWindMs,
  windDirectionDeg,
  overridePitch,
  overrideRpm,
  onSelectPart,
  onMetricsReady,
  lowFx,
  resetNonce,
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
  const controls = useThree((st) => st.controls);
  // Dev only: expose camera + controls for scripted visual checks (Chrome MCP)
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    Object.assign(window, { __bwViewer: { camera, controls, scene } });
  }, [camera, controls, scene]);
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

  useEffect(() => {
    if (resetNonce > 0) flyTo(null);
  }, [resetNonce, flyTo]);

  // Entering cutaway/exploded with nothing selected: frame the nacelle so
  // the opened shell is actually in view.
  useEffect(() => {
    const open = viewerMode === "cutaway" || viewerMode === "exploded";
    if (open && interiorView === "3d" && !useLandingStore.getState().selectedTurbinePart) {
      flyTo("nacelle");
    }
  }, [viewerMode, interiorView, flyTo]);

  // ── Scale-bar metric: metres per screen pixel at camera pivot distance
  useEffect(() => {
    if (!onMetricsReady) return;
    const updateMetric = () => {
      const persp = camera as THREE.PerspectiveCamera;
      if (!persp.isPerspectiveCamera) return;
      const pivot = new THREE.Vector3(0, 118, 0);
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
      <ArrayCables turbineId={turbineId} />
      {/* The rest of the farm, live: yaw, rpm, pitch per turbine */}
      <FarmTurbines turbineId={turbineId} />

      {/* Wind: compass ring on the sea, met-mast wind profile in the air,
          physics-driven flow and wake */}
      <CameraHeadingProbe />
      {showWindDirection && <WindCompass windFromDeg={windDirectionDeg} />}
      {showWindDirection && <WindProfile windMs={manualWindMs} windFromDeg={windDirectionDeg} />}
      <WakeField turbineId={turbineId} windFromDeg={windDirectionDeg} />
      {showWindField && (
        <WindFlow turbineId={turbineId} windMs={manualWindMs} windFromDeg={windDirectionDeg} rotorRpm={sceneRpm} />
      )}

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
        showFlow={showWindField}
      />

      {/* Faulted part pulses red; repair vessel + crew while a job runs */}
      <FaultBeacon turbineId={turbineId} />
      <ServiceCraft turbineId={turbineId} />

      {/* Human scale figure */}
      {showHumanFigure && <HumanScaleFigure />}

      {/* Annotation layer */}
      {showAnnotations && (
        <MeasurementLayer annotations={annotations} />
      )}

      {/* D5 — Wind-field visualization (freestream, streamlines, Jensen ribbon, tip speed) */}
      {showWindField && (
        <WindFieldViz
          windMs={manualWindMs}
          rotorSpeedRpm={sceneRpm}
          yawDeg={windDirectionDeg}
        />
      )}

      {/* Nacelle-frame overlays: follow yaw + tower lean */}
      <InNacelleFrame>
        {showThermal && (viewerMode === "cutaway" || viewerMode === "exploded") && (
          <ThermalOverlay turbineId={turbineId} />
        )}
        {showSensors && (viewerMode === "cutaway" || viewerMode === "exploded") && (
          <SensorMarkers turbineId={turbineId} onSelectPart={onSelectPart} />
        )}
        {showPowerFlow && (
          <SceneErrorBoundary area="power-flow">
            <PowerFlowParticles turbineId={turbineId} />
          </SceneErrorBoundary>
        )}
        <NacelleInteriorDetail turbineId={turbineId} viewerMode={viewerMode} showLabels={showAnnotations} />
        {(viewerMode === "cutaway" || viewerMode === "exploded") && <HealthBadges turbineId={turbineId} />}
        {/* D5b — velocity triangles at three blade stations (shaft frame) */}
        {showWindTriangle && (
          <group position={HUB} rotation={[-SHAFT_TILT, 0, 0]}>
            <WindTriangle
              windMs={manualWindMs}
              rotorSpeedRpm={sceneRpm}
              pitchDeg={overridePitch ?? turbineForRpm?.pitchAngleDeg ?? 0}
            />
          </group>
        )}
      </InNacelleFrame>

      {/* Render style demo: toon + ink edges */}

      {/* Post-processing stack */}
      {/* autoClear off: required by the Outline pass (selected-part glow).
          No normal pass: no effect here reads normals (it re-rendered the
          whole scene every frame for nothing). */}
      <EffectComposer multisampling={0} autoClear={false}>
        <SMAA />
        {/* Mild depth of field: the viewed turbine sharp, the farm behind
            softly out of focus — reads as distance, like a telephoto shot.
            Dropped with bloom when the GPU can't hold 50 FPS (lowFx). */}
        {!lowFx ? <DepthOfField target={[0, 118, 0]} worldFocusRange={520} bokehScale={1.6} resolutionScale={0.5} /> : <></>}
        {!lowFx ? <Bloom intensity={0.4} luminanceThreshold={0.92} luminanceSmoothing={0.22} mipmapBlur /> : <></>}
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
        enableZoom
        minDistance={8}
        maxDistance={2600}
        target={[0, 118, 0]}
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
  /** Full map-area view with the part rail + info card. */
  expanded?: boolean;
  onToggleExpand?: () => void;
}

export default function TurbineViewer3D({ turbineId, turbine, expanded = false, onToggleExpand }: TurbineViewer3DProps) {
  const [webGLOk] = useState(() => isWebGLAvailable());
  const [explodedOffset, setExplodedOffset] = useState(0);
  const [resetNonce, setResetNonce] = useState(0);
  const [showHumanFigure, setShowHumanFigure] = useState(false);
  const [dpr, setDpr] = useState(Math.min(window.devicePixelRatio, 2));
  const [lowFx, setLowFx] = useState(false);
  const [manualRun, setManualRun] = useState<boolean | null>(null);
  // Rotor what-if wind: starts at (and resets to) the turbine's live SCADA
  // wind, so the spinning rotor and the telemetry strip agree on open.
  const liveWindMs = Math.min(20, Math.max(0, Math.round(turbine.windSpeedMs * 2) / 2));
  const [manualWindMs, setManualWindMs] = useState<number>(liveWindMs);
  const [metresPerPixel, setMetresPerPixel] = useState(0.5);
  // Realistic by default; the toon + ink look is an opt-in demo
  const [hiddenCardFor, setHiddenCardFor] = useState<TurbinePartId | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);

  // Turbine model (utils/landingPhysics, official IEA 15 MW table) drives live rpm & pitch
  // from the slider: 5.0 rpm minimum, λ = 9 tracking to 7.52 rpm at rated (10.66 m/s), pitch sheds power above it,
  // feathered (90°) and stopped outside 3–25 m/s.
  const kpisForYaw = useLandingStore(selectKPIs);
  const turbineForYaw = useLandingStore(selectTurbine(turbineId));
  // yaw-error stop: while the nacelle is > 45° off the wind the rotor idles
  // feathered (same rule as the farm simulation)
  const yawErrDeg =
    ((((turbineForYaw?.nacellePositionDeg ?? 225) - (kpisForYaw?.windDirectionDeg ?? 225)) + 540) % 360) - 180;
  const yawPaused = Math.abs(yawErrDeg) > YAW_PAUSE_DEG;
  const windForSim = manualRun === false ? 0 : manualWindMs;
  const computedRpm = v236RotorRpm(windForSim) * (yawPaused ? 0.3 : 1);
  const computedPitch = yawPaused ? 45 : v236PitchDeg(windForSim);
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
  const showWindDirection = useLandingStore(selectWindDirection);
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
  const setShowWindDirection = useLandingStore((s) => s.setShowWindDirection);
  const setShowWindTriangle = useLandingStore((s) => s.setShowWindTriangle);
  const setBladeFieldMode = useLandingStore((s) => s.setBladeFieldMode);
  const setShowLossHUD = useLandingStore((s) => s.setShowLossHUD);
  const setShowCpWidget = useLandingStore((s) => s.setShowCpWidget);
  const resetViewerDefaults = useLandingStore((s) => s.resetViewerDefaults);

  // Auto-cutaway on interior part
  useEffect(() => {
    const internalParts: TurbinePartId[] = [
      "shaft", "bearing", "brake", "converter", "transformer",
      "hpu", "control_cabinet", "coolant_skid", "ups", "bedplate",
    ];
    if (selectedPart && internalParts.includes(selectedPart) && viewerMode === "normal") {
      setViewerMode("cutaway");
    }
  }, [selectedPart, viewerMode, setViewerMode]);

  const handleInteriorViewChange = useCallback(
    (next: "3d" | "schematic") => setInteriorView(next),
    [setInteriorView],
  );

  // Live HPU/cooling/safety telemetry from backend nacelle subsystem endpoints.
  useEffect(() => {
    const startPolling = useNacelleSubsystemsStore.getState().startPolling;
    const stopPolling = useNacelleSubsystemsStore.getState().stopPolling;
    startPolling(turbineId, 2000);
    return () => stopPolling(turbineId);
  }, [turbineId]);

  useEffect(() => {
    if (viewerMode !== "exploded") setExplodedOffset(0);
  }, [viewerMode]);

  const handleResetCamera = useCallback(() => {
    // Full reset: clears all overlays, modes, sky, selection in the store,
    // plus this component's local UI state (manual run, wind, exploded, scale figure).
    resetViewerDefaults();
    setResetNonce((n) => n + 1);
    setManualRun(null);
    setManualWindMs(liveWindMs);
    setExplodedOffset(0);
    setShowHumanFigure(false);
  }, [resetViewerDefaults, liveWindMs]);

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
    // Auto-cutaway when enabling from normal mode — the particles render inside
    // the nacelle shell, which is opaque in normal view, so without this the
    // button would silently appear to do nothing.
    if (!showPowerFlow && viewerMode === "normal") setViewerMode("cutaway");
    setShowPowerFlow(!showPowerFlow);
  }, [showPowerFlow, viewerMode, setViewerMode, setShowPowerFlow]);

  const expandButton = onToggleExpand ? (
    <button
      type="button"
      onClick={onToggleExpand}
      title={expanded ? "Back to the map (Esc)" : "Expand the 3D simulation to the full map area"}
      className="rounded border border-border-primary bg-bg-secondary/90 px-2 py-0.5 text-xs font-semibold text-text-primary hover:bg-bg-hover"
    >
      {expanded ? "⤡ Exit full view" : "⤢ Full view"}
    </button>
  ) : null;

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
      // @container: HUD chrome thins out (@max-lg) when the viewer is narrower than 512 px (phones)
      className="@container relative w-full h-full rounded-lg overflow-hidden border border-border-primary bg-bg-primary focus:outline-none"
      // Stop wheel events from bubbling to the underlying Leaflet map / page
      // scroller. Without this, scrolling over the canvas also scrolls the
      // farm overview behind it instead of zooming the turbine.
      onWheel={(e) => e.stopPropagation()}
    >
      <Canvas
        dpr={dpr}
        camera={{
          position: DEFAULT_CAMERA_TARGET.position,
          fov: 45,
          near: 1,
          far: 16000, // whole farm (~10 km) + horizon
        }}
        shadows={{ type: THREE.PCFShadowMap }}
        gl={glProps}
        onCreated={({ gl }) => {
          gl.localClippingEnabled = true;
        }}
      >
        {/* Adaptive quality: below ~50 FPS drop to DPR 1 and skip DoF + bloom;
            restore both when the frame rate recovers */}
        <PerformanceMonitor
          onDecline={() => {
            setDpr(1);
            setLowFx(true);
          }}
          onIncline={() => {
            setDpr(Math.min(window.devicePixelRatio, 2));
            setLowFx(false);
          }}
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
            showWindDirection={showWindDirection}
            showWindTriangle={showWindTriangle}
            bladeFieldMode={bladeFieldMode}
            manualWindMs={manualWindMs}
            windDirectionDeg={compassWind}
            overridePitch={overridePitch}
            overrideRpm={overrideRpm}
            onSelectPart={setSelectedPart}
            onMetricsReady={setMetresPerPixel}
            lowFx={lowFx}
            resetNonce={resetNonce}
          />
        </Suspense>
      </Canvas>

      {/* 2D Isometric schematic — overlaid on top of faded 3D canvas */}
      {interiorView === "schematic" && (
        <div className="absolute inset-0 z-20 pointer-events-none">
          <NacelleSchematic turbineId={turbineId} headerExtra={expandButton} />
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
        showWindDirection={showWindDirection}
        showWindTriangle={showWindTriangle}
        bladeFieldMode={bladeFieldMode}
        showLossHUD={showLossHUD}
        showCpWidget={showCpWidget}
        onResetCamera={handleResetCamera}
        onViewerModeChange={setViewerMode}
        onInteriorViewChange={handleInteriorViewChange}
        onSkyPresetChange={setSkyPreset}
        onToggleAnnotations={() => setShowAnnotations(!showAnnotationLayer)}
        onToggleHumanFigure={() => setShowHumanFigure((v) => !v)}
        onToggleThermal={handleToggleThermal}
        onToggleSensors={handleToggleSensors}
        onTogglePowerFlow={handleTogglePowerFlow}
        onToggleWindField={() => setShowWindField(!showWindField)}
        onToggleWindDirection={() => setShowWindDirection(!showWindDirection)}
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
          <span className="text-xs text-text-muted font-mono">Explode</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={explodedOffset}
            onChange={(e) => setExplodedOffset(parseFloat(e.target.value))}
            className="w-24 accent-accent"
          />
          <span className="text-xs text-text-muted font-mono w-6">{Math.round(explodedOffset * 100)}%</span>
        </div>
      )}

      <ViewerLegend turbineId={turbineId} />

      {/* Colour scales of the active overlays, stacked above the wake legend */}
      {interiorView === "3d" && (
        <div className="pointer-events-none absolute bottom-32 right-2 z-10 flex flex-col gap-1.5 @max-lg:hidden">
          {showSensorMarkers && viewerMode !== "normal" && <SensorLegend />}
          {showThermalOverlay && viewerMode !== "normal" && <ThermalLegend turbineId={turbineId} />}
          {bladeFieldMode !== "off" && <BladeFieldLegend />}
        </div>
      )}

      {/* HUD widgets */}
      <CompassWidget windDirectionDeg={compassWind} nacelleYawDeg={nacelleYaw} windMs={manualWindMs} />
      <CameraModeBadge />
      <ScaleBar metresPerPixel={metresPerPixel} />
      <KeyboardHelp />

      {/* Turbine ID badge */}
      <div className="absolute top-2 left-2 z-10 bg-bg-secondary/80 backdrop-blur-sm rounded px-2 py-0.5 border border-border-primary">
        <span className="text-xs font-mono text-text-muted">{turbineId}</span>
        <span className="text-xs font-mono text-text-muted opacity-60 ml-1">· 15 MW IEA-15-240-RWT</span>
      </div>
      {onToggleExpand && interiorView === "3d" && (
        <div className="absolute left-2 top-9 z-20">{expandButton}</div>
      )}

      {/* Expanded: component rail + info card for the selected part */}
      {expanded && interiorView === "3d" && (
        <>
          <div className="pointer-events-none absolute inset-x-0 bottom-[4.5rem] z-20 flex justify-center px-40 @max-lg:px-2">
            <PartRail selected={selectedPart} onSelect={setSelectedPart} />
          </div>
          {selectedPart && turbineState && hiddenCardFor !== selectedPart && (
            <div className="pointer-events-none absolute bottom-28 left-3 top-24 z-20 flex @max-lg:right-3">
              {/* closing hides the card only — the camera stays on the part */}
              <PartInfoCard part={selectedPart} turbine={turbineState} onClose={() => setHiddenCardFor(selectedPart)} />
            </div>
          )}
          {/* live trends / power curve / loss waterfall — gives way to the part card */}
          {!(selectedPart && hiddenCardFor !== selectedPart) &&
            (showAnalytics ? (
              <div className="absolute left-[9.25rem] top-12 z-20 @max-lg:left-2 @max-lg:right-2">
                <AnalyticsPanel turbineId={turbineId} onClose={() => setShowAnalytics(false)} />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAnalytics(true)}
                className="absolute left-[9.25rem] top-12 z-20 @max-lg:left-auto @max-lg:right-2 @max-lg:top-24 rounded border border-border-primary bg-bg-secondary/90 px-2 py-0.5 text-xs font-semibold text-text-primary hover:bg-bg-hover"
              >
                📈 Live analytics
              </button>
            ))}
        </>
      )}

      {/* Legend of the hub-height wake slice */}
      <div className="pointer-events-none absolute bottom-10 right-2 z-10 rounded-md border border-border-primary bg-bg-secondary/90 px-2.5 py-1.5 @max-lg:hidden text-xs font-semibold text-text-primary shadow">
        <div className="mb-1 font-bold">Wake deficit at hub height (150 m)</div>
        <div className="h-2 w-44 rounded" style={{ background: "linear-gradient(90deg,#fdd95a,#f7731a,#cc1a1a)" }} />
        <div className="flex justify-between font-mono text-xs text-text-secondary">
          <span>3 %</span>
          <span>20 %</span>
          <span>≥ 45 %</span>
        </div>
        <div className="text-xs text-text-muted">Bastankhah wakes · Katic sum · iso-lines 5 %</div>
      </div>
    </div>
  );
}

