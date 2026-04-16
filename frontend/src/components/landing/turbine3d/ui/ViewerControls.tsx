/**
 * Viewer control buttons overlaid on top of the 3D canvas.
 *
 * Controls:
 *   [Reset]     — fly camera back to overview position
 *   [Normal|Cutaway|Exploded] — viewerMode toggle
 *   [📐 Measurements] — toggle annotation layer on/off
 *   [Person] — toggle human-scale figure
 *
 * Positioned in the top-right corner of the viewer container.
 */

import { RotateCcw, Layers, Ruler, User, ScanLine, Box, Play, Pause, Wind } from "lucide-react";
import { cn } from "../../../../lib/utils";

interface ViewerControlsProps {
  viewerMode: "normal" | "cutaway" | "exploded";
  showAnnotationLayer: boolean;
  showHumanFigure: boolean;
  onResetCamera: () => void;
  onViewerModeChange: (mode: "normal" | "cutaway" | "exploded") => void;
  onToggleAnnotations: () => void;
  onToggleHumanFigure: () => void;
  onToggleRun?: () => void;
  isRunning?: boolean;       // false = stopped, true/undefined = running/auto
  manualWindMs?: number;
  onWindSpeedChange?: (v: number) => void;
}

const btn = cn(
  "flex items-center gap-1 rounded px-2 py-1",
  "bg-bg-secondary/80 border border-border-primary backdrop-blur-sm",
  "text-text-muted hover:text-text-primary hover:bg-bg-hover",
  "transition-colors duration-150 text-[10px] font-medium",
);

const btnActive = cn(
  "flex items-center gap-1 rounded px-2 py-1",
  "bg-accent/20 border border-accent/40 backdrop-blur-sm",
  "text-accent",
  "transition-colors duration-150 text-[10px] font-medium",
);

export function ViewerControls({
  viewerMode,
  showAnnotationLayer,
  showHumanFigure,
  onResetCamera,
  onViewerModeChange,
  onToggleAnnotations,
  onToggleHumanFigure,
  onToggleRun,
  isRunning,
  manualWindMs,
  onWindSpeedChange,
}: ViewerControlsProps) {
  return (
    <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 items-end pointer-events-none">
      {/* Reset camera */}
      <button className={cn(btn, "pointer-events-auto")} onClick={onResetCamera} title="Reset view">
        <RotateCcw size={11} />
        <span>Reset</span>
      </button>

      {/* View mode */}
      <div className="flex gap-0.5 pointer-events-auto">
        <button
          className={viewerMode === "normal" ? btnActive : btn}
          onClick={() => onViewerModeChange("normal")}
          title="Normal view"
        >
          <Box size={11} />
          <span>Normal</span>
        </button>
        <button
          className={viewerMode === "cutaway" ? btnActive : btn}
          onClick={() => onViewerModeChange("cutaway")}
          title="Cutaway — reveals internals"
        >
          <ScanLine size={11} />
          <span>Cutaway</span>
        </button>
        <button
          className={viewerMode === "exploded" ? btnActive : btn}
          onClick={() => onViewerModeChange("exploded")}
          title="Exploded view"
        >
          <Layers size={11} />
          <span>Exploded</span>
        </button>
      </div>

      {/* Annotation layer */}
      <button
        className={cn(showAnnotationLayer ? btnActive : btn, "pointer-events-auto")}
        onClick={onToggleAnnotations}
        title="Toggle measurement & telemetry annotations"
      >
        <Ruler size={11} />
        <span>Measurements</span>
      </button>

      {/* Human figure */}
      <button
        className={cn(showHumanFigure ? btnActive : btn, "pointer-events-auto")}
        onClick={onToggleHumanFigure}
        title="Toggle 1.8 m human-scale figure"
      >
        <User size={11} />
        <span>Scale</span>
      </button>

      {/* Run / Stop pitch control */}
      <button
        className={cn(isRunning === false ? btnActive : btn, "pointer-events-auto")}
        onClick={onToggleRun}
        title={isRunning === false ? "Pitch to fine — resume" : "Feather blades — stop turbine"}
      >
        {isRunning === false ? <Play size={11} /> : <Pause size={11} />}
        <span>{isRunning === false ? "Run" : "Stop"}</span>
      </button>

      {/* Wind speed display (always shown; slider = informational when in auto mode) */}
      <div className="flex items-center gap-1 pointer-events-auto bg-bg-secondary/80 border border-border-primary backdrop-blur-sm rounded px-2 py-1">
        <Wind size={11} className="text-text-muted" />
        <input
          type="range"
          min={0}
          max={20}
          step={0.5}
          value={manualWindMs ?? 11}
          onChange={(e) => onWindSpeedChange?.(parseFloat(e.target.value))}
          className="w-20 accent-accent"
        />
        <span className="text-[9px] font-mono text-text-muted w-10">
          {(manualWindMs ?? 11).toFixed(1)} m/s
        </span>
      </div>
    </div>
  );
}
