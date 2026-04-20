/**
 * Viewer control buttons overlaid on top of the 3D canvas.
 *
 * Grouped into 6 collapsible sections (native <details>/<summary>):
 *   View         — Reset, Mode (Normal/Cutaway/Exploded), Interior (3D/Schematic)
 *   Environment  — Sky preset (Overcast/Golden/Night)
 *   Overlays     — Measurements, Scale, Thermal, Sensors, Power Flow, Wind Field, Triangle
 *   Blade        — Off / Thermal / Pressure / Strain
 *   Data HUDs    — Losses, Cp Curve
 *   Simulation   — Run/Pause + Wind speed slider (only section open by default)
 */

import type { ReactNode } from "react";
import {
  RotateCcw, Layers, Ruler, User, ScanLine, Box, Play, Pause, Wind,
  Thermometer, Radio, Zap, Cloud, Sun, Moon, Grid3x3,
  Triangle, TrendingDown, LineChart, Activity, ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../../../../lib/utils";
import type { SkyPreset } from "../scene/Environment";

interface ViewerControlsProps {
  viewerMode: "normal" | "cutaway" | "exploded";
  interiorView: "3d" | "schematic";
  skyPreset: SkyPreset;
  showAnnotationLayer: boolean;
  showHumanFigure: boolean;
  showThermalOverlay: boolean;
  showSensorMarkers: boolean;
  showPowerFlow: boolean;
  showWindField: boolean;
  showWindTriangle: boolean;
  bladeFieldMode: "off" | "thermal" | "pressure" | "strain";
  showLossHUD: boolean;
  showCpWidget: boolean;
  onResetCamera: () => void;
  onViewerModeChange: (mode: "normal" | "cutaway" | "exploded") => void;
  onInteriorViewChange: (v: "3d" | "schematic") => void;
  onSkyPresetChange: (p: SkyPreset) => void;
  onToggleAnnotations: () => void;
  onToggleHumanFigure: () => void;
  onToggleThermal: () => void;
  onToggleSensors: () => void;
  onTogglePowerFlow: () => void;
  onToggleWindField: () => void;
  onToggleWindTriangle: () => void;
  onBladeFieldModeChange: (m: "off" | "thermal" | "pressure" | "strain") => void;
  onToggleLossHUD: () => void;
  onToggleCpWidget: () => void;
  onToggleRun?: () => void;
  isRunning?: boolean;
  manualWindMs?: number;
  onWindSpeedChange?: (v: number) => void;
}

const btn = cn(
  "flex items-center gap-1 rounded px-2 py-1 w-full",
  "bg-bg-secondary/80 border border-border-primary backdrop-blur-sm",
  "text-text-muted hover:text-text-primary hover:bg-bg-hover",
  "transition-colors duration-150 text-[10px] font-medium",
);

const btnActive = cn(
  "flex items-center gap-1 rounded px-2 py-1 w-full",
  "bg-accent/20 border border-accent/40 backdrop-blur-sm",
  "text-accent",
  "transition-colors duration-150 text-[10px] font-medium",
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
      className="group pointer-events-auto w-44"
      {...(defaultOpen ? { open: true } : {})}
    >
      <summary
        className={cn(
          "flex items-center gap-1 rounded px-2 py-1 cursor-pointer select-none list-none",
          "bg-bg-secondary/80 border border-border-primary backdrop-blur-sm",
          "text-text-secondary hover:text-text-primary hover:bg-bg-hover",
          "text-[10px] font-semibold uppercase tracking-wide",
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
  interiorView,
  skyPreset,
  showAnnotationLayer,
  showHumanFigure,
  showThermalOverlay,
  showSensorMarkers,
  showPowerFlow,
  showWindField,
  showWindTriangle,
  bladeFieldMode,
  showLossHUD,
  showCpWidget,
  onResetCamera,
  onViewerModeChange,
  onInteriorViewChange,
  onSkyPresetChange,
  onToggleAnnotations,
  onToggleHumanFigure,
  onToggleThermal,
  onToggleSensors,
  onTogglePowerFlow,
  onToggleWindField,
  onToggleWindTriangle,
  onBladeFieldModeChange,
  onToggleLossHUD,
  onToggleCpWidget,
  onToggleRun,
  isRunning,
  manualWindMs,
  onWindSpeedChange,
}: ViewerControlsProps) {
  return (
    <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 items-end pointer-events-none max-h-[calc(100vh-120px)] overflow-y-auto pr-1">
      {/* View — camera reset, viewer mode, interior view */}
      <Section title="View" icon={Box}>
        <button
          className={btn}
          onClick={onResetCamera}
          title="Reset all overlays, modes, and camera (R)"
        >
          <RotateCcw size={11} />
          <span>Reset</span>
        </button>
        <div className="grid grid-cols-3 gap-0.5">
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
        <div className="grid grid-cols-2 gap-0.5">
          <button
            className={interiorView === "3d" ? btnActive : btn}
            onClick={() => onInteriorViewChange("3d")}
            title="3D photoreal view (S)"
          >
            <Box size={11} />
            <span>3D</span>
          </button>
          <button
            className={interiorView === "schematic" ? btnActive : btn}
            onClick={() => onInteriorViewChange("schematic")}
            title="Isometric technical schematic (S)"
          >
            <Grid3x3 size={11} />
            <span>Schem</span>
          </button>
        </div>
      </Section>

      {/* Environment — sky preset */}
      <Section title="Environment" icon={Cloud}>
        <div className="grid grid-cols-3 gap-0.5">
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
        <div className="grid grid-cols-2 gap-0.5">
          {(["off", "thermal", "pressure", "strain"] as const).map((m) => (
            <button
              key={m}
              className={bladeFieldMode === m ? btnActive : btn}
              onClick={() => onBladeFieldModeChange(m)}
              title={
                m === "off"      ? "Blade field: off — no overlay"
              : m === "thermal"  ? "Blade field: thermal — leading-edge friction, tip cool"
              : m === "pressure" ? "Blade field: pressure Cp — suction near tip, stagnation near root"
              :                    "Blade field: strain — max bending at root → zero at tip"
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
          <span className="text-[9px] font-mono text-text-muted w-10 shrink-0 text-right tabular-nums">
            {(manualWindMs ?? 11).toFixed(1)}
          </span>
        </div>
      </Section>
    </div>
  );
}
