/**
 * Container for all annotation markers in the 3D scene.
 *
 * Renders inside the R3F Canvas. Only mounts when showAnnotationLayer is true.
 *
 * Features:
 *   - Filter by kind: all | dimension | telemetry | component
 *   - Mode-aware: only renders annotations whose visibleInModes includes current mode
 *   - Clicking a marker opens AnnotationDetailPopup (state held here)
 *   - Clicking a marker with relatedPartId also fires setSelectedTurbinePart
 *
 * STRICT: this component and its children live entirely inside the R3F Canvas.
 * It is NEVER rendered in the Leaflet WindFarmMap subtree.
 */

import { useState } from "react";
import {
  useLandingStore,
  selectViewerMode,
} from "../../../../store/landingStore";
import type { Annotation } from "../data/annotationCatalog";
import { AnnotationMarker } from "./AnnotationMarker";
import { AnnotationDetailPopup } from "../ui/AnnotationDetailPopup";
import type { TurbinePartId } from "../../../../constants/turbinePartEducation";

type FilterKind = "all" | "dimension" | "telemetry" | "component";

interface MeasurementLayerProps {
  annotations: Annotation[];
}

export function MeasurementLayer({ annotations }: MeasurementLayerProps) {
  const viewerMode = useLandingStore(selectViewerMode);
  const setSelectedPart = useLandingStore((s) => s.setSelectedTurbinePart);
  const [activeAnnotation, setActiveAnnotation] = useState<Annotation | null>(null);
  const [filterKind, setFilterKind] = useState<FilterKind>("all");

  const visible = annotations.filter((a) => {
    // Kind filter
    if (filterKind !== "all" && a.kind !== filterKind) return false;
    // Mode-aware visibility
    if (a.visibleInModes && !a.visibleInModes.includes(viewerMode)) return false;
    return true;
  });

  const handleMarkerClick = (annotation: Annotation) => {
    setActiveAnnotation((prev) => (prev?.id === annotation.id ? null : annotation));
    if (annotation.relatedPartId) {
      setSelectedPart(annotation.relatedPartId as TurbinePartId);
    }
  };

  return (
    <>
      {/* Filter chips — rendered as Html overlay at a fixed position */}
      <FilterChips filterKind={filterKind} onChange={setFilterKind} />

      {/* Annotation markers */}
      {visible.map((a) => (
        <AnnotationMarker
          key={a.id}
          annotation={a}
          isSelected={activeAnnotation?.id === a.id}
          onClick={handleMarkerClick}
        />
      ))}

      {/* Detail popup — anchored near the active annotation */}
      {activeAnnotation && (
        <group position={activeAnnotation.anchor}>
          <AnnotationPopupWrapper
            annotation={activeAnnotation}
            onClose={() => setActiveAnnotation(null)}
          />
        </group>
      )}
    </>
  );
}

// ── Filter chips (rendered as Html inside Canvas) ─────────────────

import { Html } from "@react-three/drei";

function FilterChips({
  filterKind,
  onChange,
}: {
  filterKind: FilterKind;
  onChange: (k: FilterKind) => void;
}) {
  const kinds: FilterKind[] = ["all", "dimension", "telemetry", "component"];

  return (
    <Html position={[-80, 170, 0]} distanceFactor={150} style={{ pointerEvents: "none" }}>
      <div style={{ display: "flex", gap: 4, pointerEvents: "auto" }}>
        {kinds.map((k) => (
          <button
            key={k}
            onClick={() => onChange(k)}
            style={{
              fontSize: 9,
              fontFamily: "JetBrains Mono, monospace",
              padding: "2px 6px",
              borderRadius: 4,
              border: filterKind === k ? "1px solid #3b82f6" : "1px solid rgba(255,255,255,0.15)",
              background: filterKind === k ? "rgba(59,130,246,0.25)" : "rgba(0,0,0,0.5)",
              color: filterKind === k ? "#93c5fd" : "#94a3b8",
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {k}
          </button>
        ))}
      </div>
    </Html>
  );
}

// ── Popup wrapper rendered inside Canvas via Html ─────────────────

function AnnotationPopupWrapper({
  annotation,
  onClose,
}: {
  annotation: Annotation;
  onClose: () => void;
}) {
  // The popup handles its own layout (SVG leader line + offset card).
  // We give Html a zero-size container anchored at the annotation point so
  // the popup's internal coordinate system (0, 0) = marker anchor.
  return (
    <Html distanceFactor={80} style={{ pointerEvents: "none" }} zIndexRange={[50, 200]}>
      <AnnotationDetailPopup annotation={annotation} onClose={onClose} />
    </Html>
  );
}
