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

import { RotateCcw, Layers, Ruler, User, ScanLine, Box } from "lucide-react";
import { cn } from "../../../../lib/utils";

interface ViewerControlsProps {
  viewerMode: "normal" | "cutaway" | "exploded";
  showAnnotationLayer: boolean;
  showHumanFigure: boolean;
  onResetCamera: () => void;
  onViewerModeChange: (mode: "normal" | "cutaway" | "exploded") => void;
  onToggleAnnotations: () => void;
  onToggleHumanFigure: () => void;
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
    </div>
  );
}
