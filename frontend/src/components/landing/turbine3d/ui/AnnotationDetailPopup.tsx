/**
 * Click-reveal popup for an annotation marker — "node style" with leader arrow.
 *
 * Visual layout: the marker sits at local (0, 0); the card is offset up-and-right
 * and a dashed SVG leader line connects the two with a small arrowhead. This
 * makes the popup read like a workflow-canvas node rather than a detached card.
 *
 *        ┌──────────────────────┐
 *        │ ● Gearbox            │  ← card
 *        │   36:1 ratio         │
 *        │   [formula]          │
 *        └──▲───────────────────┘
 *           ╲  ← dashed leader line
 *            ╲
 *             ●  ← marker anchor (0, 0 of Html wrapper)
 *
 * Shows: title, live value + unit, formula (monospace), source, description.
 * Closed by × button or Escape.
 */

import { useEffect } from "react";
import type { Annotation } from "../data/annotationCatalog";
import { ANNOTATION_CATEGORY_COLOR } from "../data/annotationCatalog";

interface AnnotationDetailPopupProps {
  annotation: Annotation;
  onClose: () => void;
}

// Card offset from the marker anchor, in CSS pixels of the Html wrapper.
const CARD_OFFSET_X = 40;
const CARD_OFFSET_Y = 80; // card sits this many px ABOVE the marker
const CARD_WIDTH = 300;
const CARD_HEIGHT_HINT = 180; // SVG drawing area hint; card auto-grows

export function AnnotationDetailPopup({ annotation, onClose }: AnnotationDetailPopupProps) {
  const detail = annotation.detail;
  const value = typeof detail.value === "function" ? detail.value() : detail.value;
  const color = ANNOTATION_CATEGORY_COLOR[annotation.category];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div style={{ position: "relative", width: 0, height: 0, pointerEvents: "none" }}>
      {/* SVG leader line from marker (0,0) to card bottom-left corner */}
      <svg
        width={CARD_OFFSET_X + 20}
        height={CARD_OFFSET_Y + 20}
        style={{
          position: "absolute",
          left: 0,
          top: -CARD_OFFSET_Y,
          overflow: "visible",
          pointerEvents: "none",
        }}
        aria-hidden="true"
      >
        <defs>
          <marker
            id={`arrow-${annotation.id}`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
          </marker>
        </defs>
        {/* Line goes from (0, CARD_OFFSET_Y) [the marker] to (CARD_OFFSET_X, 0) [card corner] */}
        <line
          x1={0}
          y1={CARD_OFFSET_Y}
          x2={CARD_OFFSET_X - 2}
          y2={2}
          stroke={color}
          strokeWidth={1.4}
          strokeDasharray="4 3"
          markerEnd={`url(#arrow-${annotation.id})`}
        />
        {/* Origin dot — small ring at the marker anchor */}
        <circle cx={0} cy={CARD_OFFSET_Y} r={2.5} fill={color} opacity={0.85} />
      </svg>

      {/* The node card itself */}
      <div
        role="dialog"
        aria-label={detail.title}
        style={{
          position: "absolute",
          left: CARD_OFFSET_X,
          top: -CARD_OFFSET_Y - CARD_HEIGHT_HINT + 20,
          width: CARD_WIDTH,
          pointerEvents: "auto",
          borderLeft: `3px solid ${color}`,
        }}
        className="rounded-lg border border-border-primary bg-bg-secondary/95 backdrop-blur-md shadow-xl p-3 text-left"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-1.5 right-1.5 text-text-muted hover:text-text-primary text-[14px] leading-none"
          title="Close"
          aria-label="Close"
        >
          ×
        </button>

        {/* Header */}
        <div className="flex items-center gap-1.5 mb-2 pr-4">
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ background: color }}
          />
          <span className="text-[13px] font-semibold text-text-primary">
            {detail.title}
          </span>
        </div>

        {/* Value */}
        <div className="mb-1.5">
          <span className="text-[16px] font-mono font-bold text-text-primary">{value}</span>
          {detail.unit && (
            <span className="text-[12px] text-text-muted ml-1">{detail.unit}</span>
          )}
        </div>

        {/* Formula */}
        {detail.formula && (
          <div className="mb-1.5 px-2 py-1 bg-bg-primary rounded border border-border-primary">
            <code className="text-[11px] font-mono text-accent">{detail.formula}</code>
          </div>
        )}

        {/* Description */}
        {detail.description && (
          <p className="text-[12px] text-text-muted leading-relaxed mb-1.5">
            {detail.description}
          </p>
        )}

        {/* Source */}
        <div className="text-[10px] text-text-muted opacity-60 font-mono">{detail.source}</div>
      </div>
    </div>
  );
}
