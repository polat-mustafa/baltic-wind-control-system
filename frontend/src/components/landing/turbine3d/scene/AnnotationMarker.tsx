/**
 * Single annotation marker in the 3D scene.
 *
 * Renders via drei's <Html occlude> so it:
 *   - Follows the 3D anchor point in screen space
 *   - Hides behind the turbine when occluded
 *
 * Visual:
 *   Circle node (12 px, category-colour) — pulsing for telemetry
 *   Label text next to the circle
 *   Dimension arrow drawn as a separate SVG line (for dimension kind)
 *
 * Clicking the circle opens the AnnotationDetailPopup (handled by parent).
 *
 * AnnotationMarkerContent is exported separately so it can be tested
 * without a Canvas context.
 */

import { Html } from "@react-three/drei";
import type { Annotation } from "../data/annotationCatalog";
import { ANNOTATION_CATEGORY_COLOR } from "../data/annotationCatalog";

interface AnnotationMarkerProps {
  annotation: Annotation;
  isSelected: boolean;
  onClick: (annotation: Annotation) => void;
}

/** Pure HTML content — testable without R3F Canvas. */
export function AnnotationMarkerContent({ annotation, isSelected, onClick }: AnnotationMarkerProps) {
  const color = ANNOTATION_CATEGORY_COLOR[annotation.category];
  const label = typeof annotation.label === "function" ? annotation.label() : annotation.label;
  const isPulsing = annotation.kind === "telemetry";

  return (
    <div
      className="annotation-marker"
      style={{ position: "relative", pointerEvents: "auto" }}
      onClick={(e) => { e.stopPropagation(); onClick(annotation); }}
    >
      {/* Circle node */}
      <div
        className={isPulsing ? "annotation-pulse" : ""}
        data-testid="marker-circle"
        style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: color,
          border: isSelected ? "2px solid white" : "1.5px solid rgba(255,255,255,0.4)",
          cursor: "pointer",
          boxShadow: isSelected ? `0 0 10px ${color}` : `0 0 5px ${color}88`,
          flexShrink: 0,
        }}
      />
      {/* Label */}
      <span
        style={{
          marginLeft: 6,
          fontSize: 13,
          fontFamily: "JetBrains Mono, monospace",
          color: "#e2e8f0",
          whiteSpace: "nowrap",
          textShadow: "0 1px 3px rgba(0,0,0,0.9)",
          userSelect: "none",
        }}
      >
        {label}
      </span>
    </div>
  );
}

export function AnnotationMarker({ annotation, isSelected, onClick }: AnnotationMarkerProps) {
  return (
    <Html
      position={annotation.anchor}
      occlude
      distanceFactor={120}
      style={{ pointerEvents: "none" }}
      zIndexRange={[10, 100]}
    >
      <AnnotationMarkerContent
        annotation={annotation}
        isSelected={isSelected}
        onClick={onClick}
      />
    </Html>
  );
}
