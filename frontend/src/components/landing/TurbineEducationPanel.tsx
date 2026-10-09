/**
 * Educational side panel for turbine cross-section parts.
 *
 * Expands inline inside the turbine detail panel (below the cross-section)
 * when a user clicks a part in the cross-section SVG.
 *
 * Sections (top to bottom):
 * 1. Header — part title + close button
 * 2. Fault Diagnostic (conditional, red-tinted)
 * 3. Overview — plain-language description
 * 4. Formulas — mono-font boxes with variable lists
 * 5. Design — value of the modelled turbine (IEA 15 MW), reasoning, factors
 * 6. Efficiency — loss name, typical %, dissipation
 * 7. Standards — badge/chip list
 * 8. Simple vs Technical — collapsible sections
 */

import { useEffect, useRef, useState } from "react";
import { X, ChevronDown, ChevronRight } from "lucide-react";

import {
  PART_EDUCATION_MAP,
  FAULT_TO_PART,
  type TurbinePartId,
} from "../../constants/turbinePartEducation";
import { FAULT_CATEGORIES } from "../../constants/faultCategories";
import type { TurbineData } from "../../types/landing";
import type { CurtailmentInfo } from "../../utils/curtailmentReason";

interface TurbineEducationPanelProps {
  partId: TurbinePartId;
  turbine: TurbineData;
  onClose: () => void;
  curtailmentInfo?: CurtailmentInfo | null;
}

export default function TurbineEducationPanel({
  partId,
  turbine,
  onClose,
  curtailmentInfo,
}: TurbineEducationPanelProps) {
  const education = PART_EDUCATION_MAP[partId];
  const [showSimple, setShowSimple] = useState(false);
  const [showTechnical, setShowTechnical] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // The card opens below the power train — bring it into view on each selection.
  useEffect(() => {
    rootRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  }, [partId]);

  // Determine if this part has an active fault on this turbine
  const faultCategory =
    turbine.status === "fault" && turbine.faultType
      ? FAULT_CATEGORIES.find((c) => c.type === turbine.faultType)
      : null;
  const faultMapsToThisPart =
    faultCategory && turbine.faultType
      ? FAULT_TO_PART[turbine.faultType] === partId
      : false;

  // Does the curtailment affect this specific part?
  const curtailMapsToThisPart =
    curtailmentInfo != null && curtailmentInfo.affectedPart === partId;

  if (!education) return null;

  const panel = (
    <div
      ref={rootRef}
      className="mt-2 scroll-mt-2 overflow-hidden rounded-lg border border-accent/40 bg-bg-secondary/60"
    >
      {/* ── Header ── */}
      <div
        className="px-3 py-2 border-b flex items-center justify-between"
        style={{ borderColor: "#1f3448" }}
      >
        <div className="text-sm font-semibold text-text-primary">
          {education.title}
        </div>
        <button
          onClick={onClose}
          className="text-text-muted hover:text-text-primary transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <div className="px-3 py-2 space-y-3">
        {/* ── Fault Diagnostic (conditional) ── */}
        {faultMapsToThisPart && faultCategory && (
          <div
            className="rounded-md px-2.5 py-2 space-y-1"
            style={{ backgroundColor: "rgba(239,68,68,0.08)" }}
          >
            <div className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: "#f25c54" }}
              />
              <span className="text-xs font-semibold text-status-alarm">
                Active Fault: {faultCategory.label}
              </span>
            </div>
            <div className="text-xs text-text-muted space-y-0.5">
              <div>
                <span className="text-text-secondary">Location:</span> {education.title}
              </div>
              <div>
                <span className="text-text-secondary">Probable cause:</span>{" "}
                {faultCategory.probableCause}
              </div>
              <div>
                <span className="text-text-secondary">Action:</span>{" "}
                {faultCategory.recommendedAction}
              </div>
            </div>
          </div>
        )}

        {/* ── Curtailment Diagnostic (conditional, amber) ── */}
        {curtailMapsToThisPart && curtailmentInfo && (
          <div
            className="rounded-md px-2.5 py-2 space-y-1"
            style={{ backgroundColor: "rgba(245,166,35,0.08)" }}
          >
            <div className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: "#f0b13e" }}
              />
              <span className="text-xs font-semibold text-status-warning">
                {curtailmentInfo.label}
              </span>
            </div>
            <div className="text-xs text-text-muted space-y-0.5">
              <div>{curtailmentInfo.explanation}</div>
              <div className="mt-1 pt-1 border-t" style={{ borderColor: "rgba(245,166,35,0.15)" }}>
                <span className="text-status-warning text-xs font-semibold uppercase tracking-wider">
                  Engineering Note
                </span>
                <div className="mt-0.5 text-text-secondary">{curtailmentInfo.educationalNote}</div>
              </div>
            </div>
          </div>
        )}

        {/* ── Overview ── */}
        <Section title="Overview">
          <p className="text-xs text-text-secondary leading-relaxed">
            {education.overview}
          </p>
        </Section>

        {/* ── Formulas ── */}
        {education.formulas.length > 0 && (
          <Section title="Formulas">
            <div className="space-y-2">
              {education.formulas.map((f, i) => (
                <div
                  key={i}
                  className="rounded border"
                  style={{
                    backgroundColor: "#152637",
                    borderColor: "#1f3448",
                    borderLeftWidth: 3,
                    borderLeftColor: "#45c8d9",
                  }}
                >
                  <div
                    className="px-2 py-1.5 font-mono text-xs text-text-primary"
                    style={{ fontFamily: "IBM Plex Mono, monospace" }}
                  >
                    {f.expression}
                  </div>
                  {f.variables.length > 0 && (
                    <div
                      className="px-2 pb-1.5 space-y-0.5 border-t"
                      style={{ borderColor: "#1f3448" }}
                    >
                      {f.variables.map((v) => (
                        <div
                          key={v.symbol}
                          className="flex items-baseline gap-1.5 text-xs"
                        >
                          <span
                            className="text-accent font-mono shrink-0"
                            style={{ fontFamily: "IBM Plex Mono, monospace" }}
                          >
                            {v.symbol}
                          </span>
                          <span className="text-text-muted">{v.name}</span>
                          <span className="text-border-accent ml-auto shrink-0">
                            [{v.unit}]
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div
                    className="px-2 pb-1.5 text-xs text-text-muted leading-relaxed border-t"
                    style={{ borderColor: "#1f3448" }}
                  >
                    {f.explanation}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Design (modelled turbine) ── */}
        <Section title="SB-510 design (IEA 15 MW)">
          <div className="space-y-1.5">
            <div
              className="rounded px-2 py-1.5 text-xs font-mono text-text-primary"
              style={{
                backgroundColor: "#152637",
                fontFamily: "IBM Plex Mono, monospace",
              }}
            >
              {education.design.v236Value}
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              {education.design.reasoning}
            </p>
            <div className="flex flex-wrap gap-1">
              {education.design.influencingFactors.map((f) => (
                <span
                  key={f}
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: "rgba(59,130,246,0.1)",
                    color: "#8099b0",
                  }}
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
        </Section>

        {/* ── Efficiency ── */}
        {education.efficiencyNotes.length > 0 && (
          <Section title="Efficiency & Losses">
            <div className="space-y-1">
              {education.efficiencyNotes.map((e) => (
                <div
                  key={e.name}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-text-secondary">{e.name}</span>
                  <span className="font-mono text-status-warning" style={{ fontFamily: "IBM Plex Mono, monospace" }}>
                    {e.typicalLossPct}
                  </span>
                </div>
              ))}
              <div className="text-xs text-border-accent mt-0.5">
                {education.efficiencyNotes.map((e) => e.dissipation).join(" | ")}
              </div>
            </div>
          </Section>
        )}

        {/* ── Standards ── */}
        {education.standards.length > 0 && (
          <Section title="Standards">
            <div className="flex flex-wrap gap-1">
              {education.standards.map((s) => (
                <span
                  key={s}
                  className="text-xs font-mono px-1.5 py-0.5 rounded border"
                  style={{
                    borderColor: "#1f3448",
                    color: "#a3b6c8",
                    backgroundColor: "#0f1d2b",
                    fontFamily: "IBM Plex Mono, monospace",
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* ── Simple Explanation (collapsible) ── */}
        <CollapsibleSection
          title="Explain Simply"
          open={showSimple}
          onToggle={() => setShowSimple(!showSimple)}
          borderColor="#4cc38a"
        >
          <p className="text-xs text-text-secondary leading-relaxed">
            {education.simpleExplanation}
          </p>
        </CollapsibleSection>

        {/* ── Technical Explanation (collapsible) ── */}
        <CollapsibleSection
          title="Explain Technically"
          open={showTechnical}
          onToggle={() => setShowTechnical(!showTechnical)}
          borderColor="#45c8d9"
        >
          <p className="text-xs text-text-secondary leading-relaxed">
            {education.technicalExplanation}
          </p>
        </CollapsibleSection>
      </div>
    </div>
  );

  return panel;
}

// ── Helper Components ───────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs text-text-muted uppercase tracking-wider mb-1">
        {title}
      </div>
      {children}
    </div>
  );
}

function CollapsibleSection({
  title,
  open,
  onToggle,
  borderColor,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  borderColor: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded border"
      style={{
        borderColor: "#1f3448",
        borderLeftWidth: 3,
        borderLeftColor: borderColor,
      }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-2 py-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
      >
        <span className="uppercase tracking-wider">{title}</span>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {open && (
        <div className="px-2 pb-2 border-t" style={{ borderColor: "#1f3448" }}>
          <div className="pt-1.5">{children}</div>
        </div>
      )}
    </div>
  );
}
