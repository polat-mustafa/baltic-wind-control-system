/**
 * Educational side panel for turbine cross-section parts.
 *
 * Slides in to the right of the 440px detail panel (at left: 472px)
 * when a user clicks a part in the cross-section SVG.
 *
 * Sections (top to bottom):
 * 1. Header — part title + close button
 * 2. Fault Diagnostic (conditional, red-tinted)
 * 3. Overview — plain-language description
 * 4. Formulas — mono-font boxes with variable lists
 * 5. V236 Design — specific value, reasoning, factors
 * 6. Efficiency — loss name, typical %, dissipation
 * 7. Standards — badge/chip list
 * 8. Simple vs Technical — collapsible sections
 *
 * Responsive: if viewport < 880px, renders inline (caller handles positioning).
 */

import { useState, useEffect, useCallback } from "react";
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
  const [isInline, setIsInline] = useState(false);

  // Responsive: inline if viewport < 880px
  const checkWidth = useCallback(() => {
    setIsInline(window.innerWidth < 880);
  }, []);

  useEffect(() => {
    checkWidth();
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, [checkWidth]);

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
      className={
        isInline
          ? "border-t px-3 py-3"
          : "absolute z-1100 rounded-lg shadow-2xl shadow-black/50 border overflow-y-auto"
      }
      style={
        isInline
          ? { borderColor: "#2a3040", backgroundColor: "#0f1117" }
          : {
              backgroundColor: "#0f1117",
              borderColor: "#2a3040",
              width: 360,
              left: 472,
              top: 60,
              maxHeight: "calc(100% - 80px)",
            }
      }
    >
      {/* ── Header ── */}
      <div
        className="px-3 py-2 border-b flex items-center justify-between"
        style={{ borderColor: "#2a3040" }}
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
                style={{ backgroundColor: "#ef4444" }}
              />
              <span className="text-[11px] font-semibold text-status-alarm">
                Active Fault: {faultCategory.label}
              </span>
            </div>
            <div className="text-[10px] text-text-muted space-y-0.5">
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
                style={{ backgroundColor: "#f5a623" }}
              />
              <span className="text-[11px] font-semibold text-status-warning">
                {curtailmentInfo.label}
              </span>
            </div>
            <div className="text-[10px] text-text-muted space-y-0.5">
              <div>{curtailmentInfo.explanation}</div>
              <div className="mt-1 pt-1 border-t" style={{ borderColor: "rgba(245,166,35,0.15)" }}>
                <span className="text-status-warning text-[9px] font-semibold uppercase tracking-wider">
                  Engineering Note
                </span>
                <div className="mt-0.5 text-text-secondary">{curtailmentInfo.educationalNote}</div>
              </div>
            </div>
          </div>
        )}

        {/* ── Overview ── */}
        <Section title="Overview">
          <p className="text-[11px] text-text-secondary leading-relaxed">
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
                    backgroundColor: "#1e2231",
                    borderColor: "#2a3040",
                    borderLeftWidth: 3,
                    borderLeftColor: "#3b82f6",
                  }}
                >
                  <div
                    className="px-2 py-1.5 font-mono text-[11px] text-text-primary"
                    style={{ fontFamily: "JetBrains Mono, monospace" }}
                  >
                    {f.expression}
                  </div>
                  {f.variables.length > 0 && (
                    <div
                      className="px-2 pb-1.5 space-y-0.5 border-t"
                      style={{ borderColor: "#2a3040" }}
                    >
                      {f.variables.map((v) => (
                        <div
                          key={v.symbol}
                          className="flex items-baseline gap-1.5 text-[10px]"
                        >
                          <span
                            className="text-accent font-mono shrink-0"
                            style={{ fontFamily: "JetBrains Mono, monospace" }}
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
                    className="px-2 pb-1.5 text-[10px] text-text-muted leading-relaxed border-t"
                    style={{ borderColor: "#2a3040" }}
                  >
                    {f.explanation}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── V236 Design ── */}
        <Section title="V236-15.0 Design">
          <div className="space-y-1.5">
            <div
              className="rounded px-2 py-1.5 text-[11px] font-mono text-text-primary"
              style={{
                backgroundColor: "#1e2231",
                fontFamily: "JetBrains Mono, monospace",
              }}
            >
              {education.design.v236Value}
            </div>
            <p className="text-[10px] text-text-secondary leading-relaxed">
              {education.design.reasoning}
            </p>
            <div className="flex flex-wrap gap-1">
              {education.design.influencingFactors.map((f) => (
                <span
                  key={f}
                  className="text-[9px] px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: "rgba(59,130,246,0.1)",
                    color: "#6b7490",
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
                  className="flex items-center justify-between text-[10px]"
                >
                  <span className="text-text-secondary">{e.name}</span>
                  <span className="font-mono text-status-warning" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                    {e.typicalLossPct}
                  </span>
                </div>
              ))}
              <div className="text-[9px] text-border-accent mt-0.5">
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
                  className="text-[9px] font-mono px-1.5 py-0.5 rounded border"
                  style={{
                    borderColor: "#2a3040",
                    color: "#9ba3b8",
                    backgroundColor: "#161924",
                    fontFamily: "JetBrains Mono, monospace",
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
          borderColor="#3ecf6e"
        >
          <p className="text-[11px] text-text-secondary leading-relaxed">
            {education.simpleExplanation}
          </p>
        </CollapsibleSection>

        {/* ── Technical Explanation (collapsible) ── */}
        <CollapsibleSection
          title="Explain Technically"
          open={showTechnical}
          onToggle={() => setShowTechnical(!showTechnical)}
          borderColor="#3b82f6"
        >
          <p className="text-[11px] text-text-secondary leading-relaxed">
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
      <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
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
        borderColor: "#2a3040",
        borderLeftWidth: 3,
        borderLeftColor: borderColor,
      }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] text-text-secondary hover:text-text-primary transition-colors"
      >
        <span className="uppercase tracking-wider">{title}</span>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {open && (
        <div className="px-2 pb-2 border-t" style={{ borderColor: "#2a3040" }}>
          <div className="pt-1.5">{children}</div>
        </div>
      )}
    </div>
  );
}
