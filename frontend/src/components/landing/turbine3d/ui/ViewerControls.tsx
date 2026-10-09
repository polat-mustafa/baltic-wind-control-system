/**
 * Viewer control buttons overlaid on top of the 3D canvas.
 *
 * Grouped into 6 collapsible sections (native <details>/<summary>):
 *   View         — Reset, Mode (Normal/Cutaway/Exploded), Interior (3D/Schematic)
 *   Environment  — Sky preset (Overcast/Golden/Night)
 *   Overlays     — Measurements, Scale, Thermal, Sensors, Power Flow, Wind Field, Triangle
 *   Blade        — Off / Thermal / Pressure / Bending (live physics fields)
 *   Data HUDs    — Losses, Cp Curve
 *   Simulation   — Run/Pause + Wind speed slider (only section open by default)
 */

import { useState, type ReactNode } from "react";
import {
  RotateCcw, Layers, Ruler, User, ScanLine, Box, Play, Pause, Wind,
  Thermometer, Radio, Zap, Cloud, Sun, Moon,
  Triangle, TrendingDown, LineChart, Activity, ChevronRight, Navigation, SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../../../../lib/utils";
import { useLandingStore } from "../../../../store/landingStore";
import type { SkyPreset } from "../scene/Environment";

interface ViewerControlsProps {
  viewerMode: "normal" | "cutaway" | "exploded";
  skyPreset: SkyPreset;
  showAnnotationLayer: boolean;
  showHumanFigure: boolean;
  showThermalOverlay: boolean;
  showSensorMarkers: boolean;
  showPowerFlow: boolean;
  showWindField: boolean;
  showWindDirection: boolean;
  showWindTriangle: boolean;
  bladeFieldMode: "off" | "thermal" | "pressure" | "bending";
  showLossHUD: boolean;
  showCpWidget: boolean;
  onResetCamera: () => void;
  onViewerModeChange: (mode: "normal" | "cutaway" | "exploded") => void;
  onSkyPresetChange: (p: SkyPreset) => void;
  onToggleAnnotations: () => void;
  onToggleHumanFigure: () => void;
  onToggleThermal: () => void;
  onToggleSensors: () => void;
  onTogglePowerFlow: () => void;
  onToggleWindField: () => void;
  onToggleWindDirection: () => void;
  onToggleWindTriangle: () => void;
  onBladeFieldModeChange: (m: "off" | "thermal" | "pressure" | "bending") => void;
  onToggleLossHUD: () => void;
  onToggleCpWidget: () => void;
  onToggleRun?: () => void;
  isRunning?: boolean;
  manualWindMs?: number;
  onWindSpeedChange?: (v: number) => void;
}

const btn = cn(
  "flex items-center gap-1 rounded px-1.5 py-1 w-full min-w-0",
  "bg-bg-secondary/80 border border-border-primary backdrop-blur-sm",
  "text-text-muted hover:text-text-primary hover:bg-bg-hover",
  "transition-colors duration-150 text-xs font-medium",
);

const btnActive = cn(
  "flex items-center gap-1 rounded px-1.5 py-1 w-full min-w-0",
  "bg-accent/20 border border-accent/40 backdrop-blur-sm",
  "text-accent",
  "transition-colors duration-150 text-xs font-medium",
);

interface SectionProps {
  title: string;
  icon: LucideIcon;
  defaultOpen?: boolean;
  children: ReactNode;
}

function Section({ title, icon: Icon, defaultOpen, children }: SectionProps) {
  return (
    <details
      className="group pointer-events-auto w-48"
      {...(defaultOpen ? { open: true } : {})}
    >
      <summary
        className={cn(
          "flex items-center gap-1 rounded px-2 py-1 cursor-pointer select-none list-none",
          "bg-bg-secondary/80 border border-border-primary backdrop-blur-sm",
          "text-text-secondary hover:text-text-primary hover:bg-bg-hover",
          "text-xs font-semibold uppercase tracking-wide",
          "[&::-webkit-details-marker]:hidden",
        )}
      >
        <ChevronRight
          size={11}
          className="chevron transition-transform duration-150 group-open:rotate-90"
        />
        <Icon size={11} />
        <span>{title}</span>
      </summary>
      <div className="mt-1 flex flex-col gap-0.5 pl-1">{children}</div>
    </details>
  );
}

export function ViewerControls({
  viewerMode,
  skyPreset,
  showAnnotationLayer,
  showHumanFigure,
  showThermalOverlay,
  showSensorMarkers,
  showPowerFlow,
  showWindField,
  showWindDirection,
  showWindTriangle,
  bladeFieldMode,
  showLossHUD,
  showCpWidget,
  onResetCamera,
  onViewerModeChange,
  onSkyPresetChange,
  onToggleAnnotations,
  onToggleHumanFigure,
  onToggleThermal,
  onToggleSensors,
  onTogglePowerFlow,
  onToggleWindField,
  onToggleWindDirection,
  onToggleWindTriangle,
  onBladeFieldModeChange,
  onToggleLossHUD,
  onToggleCpWidget,
  onToggleRun,
  isRunning,
  manualWindMs,
  onWindSpeedChange,
}: ViewerControlsProps) {
  // Narrow viewer (phone): the section stack hides behind one "Controls" button
  const [compactOpen, setCompactOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setCompactOpen((o) => !o)}
        aria-expanded={compactOpen}
        className="@lg:hidden absolute top-2 right-2 z-10 flex items-center gap-1 rounded border border-border-primary bg-bg-secondary/90 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-text-secondary"
      >
        <SlidersHorizontal size={11} />
        Controls
      </button>
      <div
        className={cn(
          "absolute top-2 right-2 z-10 flex flex-col gap-1 items-end pointer-events-none max-h-[calc(100%-1rem)] overflow-y-auto pr-1",
          compactOpen ? "@max-lg:top-9 @max-lg:max-h-[calc(100%-2.5rem)]" : "@max-lg:hidden",
        )}
      >
        {/* View — mode + interior view, with reset on its own full-width row
            so it can never be pushed outside the panel. */}
        <Section title="View" icon={Box}>
          <div className="grid grid-cols-3 gap-0.5 [&>button]:justify-center">
            <button
              className={viewerMode === "normal" ? btnActive : btn}
              onClick={() => onViewerModeChange("normal")}
              title="Normal view (1)"
            >
              <Box size={11} />
              <span>Normal</span>
            </button>
            <button
              className={viewerMode === "cutaway" ? btnActive : btn}
              onClick={() => onViewerModeChange("cutaway")}
              title="Cutaway — reveals internals (2)"
            >
              <ScanLine size={11} />
              <span>Cut</span>
            </button>
            <button
              className={viewerMode === "exploded" ? btnActive : btn}
              onClick={() => onViewerModeChange("exploded")}
              title="Exploded view (3)"
            >
              <Layers size={11} />
              <span>Exp</span>
            </button>
          </div>
          <button
            className={btn}
            onClick={onResetCamera}
            title="Reset all overlays, modes, and camera (R)"
          >
            <RotateCcw size={11} />
            <span>Reset view</span>
          </button>
        </Section>

        {/* Environment — sky preset */}
        <Section title="Environment" icon={Cloud}>
          <div className="grid grid-cols-3 gap-0.5 [&>button]:justify-center">
            <button
              className={skyPreset === "overcast" ? btnActive : btn}
              onClick={() => onSkyPresetChange("overcast")}
              title="Overcast Baltic sky"
            >
              <Cloud size={11} />
              <span>Cast</span>
            </button>
            <button
              className={skyPreset === "golden" ? btnActive : btn}
              onClick={() => onSkyPresetChange("golden")}
              title="Golden hour"
            >
              <Sun size={11} />
              <span>Gold</span>
            </button>
            <button
              className={skyPreset === "night" ? btnActive : btn}
              onClick={() => onSkyPresetChange("night")}
              title="Night"
            >
              <Moon size={11} />
              <span>Night</span>
            </button>
          </div>
        </Section>

        {/* Overlays — annotations, scale, thermal, sensors, power flow, wind */}
        <Section title="Overlays" icon={Ruler}>
          <button
            className={showAnnotationLayer ? btnActive : btn}
            onClick={onToggleAnnotations}
            title="Measurement & telemetry annotations"
          >
            <Ruler size={11} />
            <span>Measurements</span>
          </button>
          <button
            className={showHumanFigure ? btnActive : btn}
            onClick={onToggleHumanFigure}
            title="1.8 m human-scale figure"
          >
            <User size={11} />
            <span>Scale</span>
          </button>
          <button
            className={showThermalOverlay ? btnActive : btn}
            onClick={onToggleThermal}
            title="Thermal overlay — component temperatures"
          >
            <Thermometer size={11} />
            <span>Thermal</span>
          </button>
          <button
            className={showSensorMarkers ? btnActive : btn}
            onClick={onToggleSensors}
            title="CMS sensor positions"
          >
            <Radio size={11} />
            <span>Sensors</span>
          </button>
          <button
            className={showPowerFlow ? btnActive : btn}
            onClick={onTogglePowerFlow}
            title="Power flow animation"
          >
            <Zap size={11} />
            <span>Power Flow</span>
          </button>
          <button
            className={showWindDirection ? btnActive : btn}
            onClick={onToggleWindDirection}
            title="Always-on wind-direction arrow at hub height"
          >
            <Navigation size={11} />
            <span>Wind Direction</span>
          </button>
          <button
            className={showWindField ? btnActive : btn}
            onClick={onToggleWindField}
            title="Wind field — freestream, streamlines, wake deficit"
          >
            <Wind size={11} />
            <span>Wind Field</span>
          </button>
          <button
            className={showWindTriangle ? btnActive : btn}
            onClick={onToggleWindTriangle}
            title="Pythagorean apparent-wind triangle at 3 blade radii"
          >
            <Triangle size={11} />
            <span>Wind Triangle</span>
          </button>
        </Section>

        {/* Blade Analysis — vertex-color shader modes */}
        <Section title="Blade Analysis" icon={Activity}>
          <div className="grid grid-cols-2 gap-0.5 [&>button]:justify-center">
            {(["off", "thermal", "pressure", "bending"] as const).map((m) => (
              <button
                key={m}
                className={bladeFieldMode === m ? btnActive : btn}
                onClick={() => onBladeFieldModeChange(m)}
                title={
                  m === "off"      ? "Blade field: off — no overlay"
                : m === "thermal"  ? "Surface temperature from aerodynamic heating, T_air + r·W²/2cp — warmest at the tip leading edge"
                : m === "pressure" ? "Surface pressure p − p∞ = Cp·½ρW² — suction side blue, stagnation line red; grows with W² toward the tip"
                :                    "Flapwise bending moment from rotor thrust — maximum at the root, zero at the tip"
                }
              >
                <Activity size={11} />
                <span>{m === "off" ? "Off" : m.charAt(0).toUpperCase() + m.slice(1)}</span>
              </button>
            ))}
          </div>
        </Section>

        {/* Data HUDs */}
        <Section title="Data HUDs" icon={LineChart}>
          <button
            className={showLossHUD ? btnActive : btn}
            onClick={onToggleLossHUD}
            title="Loss cascade — Sankey of power chain"
          >
            <TrendingDown size={11} />
            <span>Losses</span>
          </button>
          <button
            className={showCpWidget ? btnActive : btn}
            onClick={onToggleCpWidget}
            title="Cp(λ,β) power coefficient curve"
          >
            <LineChart size={11} />
            <span>Cp Curve</span>
          </button>
        </Section>

        {/* Simulation — run/pause + wind slider (default open) */}
        <Section title="Simulation" icon={Wind} defaultOpen>
          <button
            className={isRunning === false ? btnActive : btn}
            onClick={onToggleRun}
            title={isRunning === false ? "Pitch to fine — resume" : "Feather blades — stop turbine"}
          >
            {isRunning === false ? <Play size={11} /> : <Pause size={11} />}
            <span>{isRunning === false ? "Run" : "Stop"}</span>
          </button>
          <div className="flex items-center gap-1 bg-bg-secondary/80 border border-border-primary backdrop-blur-sm rounded px-2 py-1">
            <Wind size={11} className="text-text-muted shrink-0" />
            <input
              type="range"
              min={0}
              max={20}
              step={0.5}
              value={manualWindMs ?? 11}
              onChange={(e) => onWindSpeedChange?.(parseFloat(e.target.value))}
              className="flex-1 min-w-0 accent-accent"
            />
            <span className="text-xs font-mono text-text-muted w-10 shrink-0 text-right tabular-nums">
              {(manualWindMs ?? 11).toFixed(1)} m/s
            </span>
          </div>
          <WindDirectionControl />
        </Section>
      </div>
    </>
  );
}

/**
 * Force the farm wind direction (FROM bearing). The whole farm then yaws at
 * the simulated ≤ 1 °/s, so a 90° veer takes ~1.5 min — watch the yaw error
 * on the compass fall and the wakes swing round. "Auto" hands the direction
 * back to the simulation / live weather.
 */
function WindDirectionControl() {
  const manual = useLandingStore((s) => s.manualWindDirDeg);
  const current = useLandingStore((s) => s.kpis.windDirectionDeg);
  const setManual = useLandingStore((s) => s.setManualWindDir);
  const value = manual ?? Math.round(current);
  return (
    <div className="flex items-center gap-1 bg-bg-secondary/80 border border-border-primary backdrop-blur-sm rounded px-2 py-1">
      <Navigation size={11} className="text-text-muted shrink-0" style={{ transform: `rotate(${value + 180 - 45}deg)` }} />
      <input
        type="range"
        min={0}
        max={355}
        step={5}
        value={value}
        onChange={(e) => setManual(parseFloat(e.target.value))}
        className="flex-1 min-w-0 accent-accent"
        aria-label="Wind direction (from)"
        title="Wind direction — FROM bearing"
      />
      <button
        type="button"
        onClick={() => setManual(null)}
        disabled={manual === null}
        title="Hand wind direction back to the simulation"
        className="w-10 shrink-0 text-right font-mono text-xs tabular-nums text-text-muted hover:text-text-primary disabled:hover:text-text-muted"
      >
        {manual === null ? `${value}°` : `${value}° ↺`}
      </button>
    </div>
  );
}
