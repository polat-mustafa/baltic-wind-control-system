/**
 * Visual turbine detail panel — animated SVG cross-section replaces data tables.
 *
 * Layout (440px wide):
 * - Header: turbine ID + string + status badge + close button
 * - Fault alert (conditional): red-tinted fault with priority/cause/action
 * - SVG cross-section: animated cutaway with data overlaid on parts
 * - Wake cone: educational visualization of downstream wake effects
 * - Sparklines: power + wind history (last 60 seconds)
 * - Health summary: compact availability, energy, hours
 * - Navigation: 6 compact icon buttons (P1-P5 + Physics)
 *
 * A non-engineer should immediately understand what's happening inside the turbine.
 */

import { useState, useEffect, useCallback } from "react";
import { X, Wind, Zap, Monitor, Brain, ClipboardCheck, Activity } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { FAULT_CATEGORIES } from "../../constants/faultCategories";
import { SCADA_COLORS } from "../../constants/scadaColors";
import { FAULT_TO_PART, type TurbinePartId } from "../../constants/turbinePartEducation";
import { useTurbineHistory } from "../../hooks/useTurbineHistory";
import type { TurbineData, TurbineStatus } from "../../types/landing";

import { inferCurtailment } from "../../utils/curtailmentReason";

import TurbineCrossSection from "./TurbineCrossSection";
import TurbineEducationPanel from "./TurbineEducationPanel";
import TurbineSparklines from "./TurbineSparklines";
import TurbineWakeCone from "./TurbineWakeCone";

interface TurbineDetailPanelProps {
  turbine: TurbineData;
  onClose: () => void;
}

const STATUS_COLOR: Record<TurbineStatus, string> = {
  operating: SCADA_COLORS.ENERGIZED,
  curtailed: SCADA_COLORS.WARNING,
  fault: SCADA_COLORS.FAULT,
  offline: SCADA_COLORS.DE_ENERGIZED,
};

const STATUS_LABEL: Record<TurbineStatus, string> = {
  operating: "Operating",
  curtailed: "Curtailed",
  fault: "Fault",
  offline: "Offline",
};

const NAV_ITEMS = [
  { label: "P1", path: "/wind-resource", icon: Wind, color: "#3b82f6", tip: "Wind Resource" },
  { label: "P2", path: "/hv-grid", icon: Zap, color: "#8b5cf6", tip: "HV Grid" },
  { label: "P3", path: "/scada", icon: Monitor, color: "#10b981", tip: "SCADA" },
  { label: "P4", path: "/forecast", icon: Brain, color: "#f59e0b", tip: "Forecasting" },
  { label: "P5", path: "/commissioning", icon: ClipboardCheck, color: "#ef4444", tip: "Commissioning" },
  { label: "Phys", path: "/turbine-physics", icon: Activity, color: "#06b6d4", tip: "Turbine Physics" },
];

export default function TurbineDetailPanel({ turbine: t, onClose }: TurbineDetailPanelProps) {
  const navigate = useNavigate();
  const [selectedPart, setSelectedPart] = useState<TurbinePartId | null>(null);
  const [isNarrow, setIsNarrow] = useState(false);

  const sColor = STATUS_COLOR[t.status];
  const faultCategory = t.status === "fault" && t.faultType
    ? FAULT_CATEGORIES.find((c) => c.type === t.faultType)
    : null;

  // Compute which part the current fault maps to (for red pulsing ring)
  const faultPartId: TurbinePartId | null =
    t.status === "fault" && t.faultType ? (FAULT_TO_PART[t.faultType] ?? null) : null;

  // Compute curtailment info (for amber pulsing ring)
  const curtailInfo = inferCurtailment(t);
  const curtailmentPartId: TurbinePartId | null = curtailInfo?.affectedPart ?? null;

  const { powerHistory, windHistory } = useTurbineHistory(t.powerOutputMW, t.windSpeedMs);

  // Toggle part selection (click same part again to close)
  const handlePartClick = useCallback(
    (partId: TurbinePartId) => {
      setSelectedPart((prev) => (prev === partId ? null : partId));
    },
    [],
  );

  // Responsive check: narrow viewport → inline education panel
  const checkWidth = useCallback(() => {
    setIsNarrow(window.innerWidth < 880);
  }, []);

  useEffect(() => {
    checkWidth();
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, [checkWidth]);

  // Escape key closes education panel (not the detail panel)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedPart) {
        e.stopPropagation();
        setSelectedPart(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedPart]);

  return (
    <>
      <div
        className="absolute z-[1100] rounded-lg shadow-2xl shadow-black/50 border overflow-y-auto"
        style={{
          backgroundColor: "#0f1117",
          borderColor: "#2a3040",
          width: 440,
          left: 20,
          top: 60,
          maxHeight: "calc(100% - 80px)",
        }}
      >
        {/* ── Header ── */}
        <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: "#2a3040" }}>
          <div>
            <div className="text-sm font-semibold text-[#e8eaf0]">{t.id}</div>
            <div className="text-[10px] text-[#6b7490]">String {t.stringNumber} · V236-15.0 MW</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: sColor }}>
              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: sColor }} />
              {STATUS_LABEL[t.status]}
            </span>
            <button onClick={onClose} className="text-[#6b7490] hover:text-[#e8eaf0] transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* ── Active Fault (conditional) ── */}
        {faultCategory && (
          <div className="px-3 py-2 border-b" style={{ borderColor: "#2a3040", backgroundColor: "rgba(239,68,68,0.08)" }}>
            <div className="flex items-center gap-1.5 mb-1">
              <span
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: SCADA_COLORS.FAULT }}
              />
              <span className="text-[11px] font-semibold" style={{ color: SCADA_COLORS.FAULT }}>
                {faultCategory.label}
              </span>
              <span
                className="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded"
                style={{
                  color: faultCategory.priority === "CRITICAL" ? SCADA_COLORS.FAULT : SCADA_COLORS.WARNING,
                  backgroundColor: faultCategory.priority === "CRITICAL" ? "rgba(239,68,68,0.15)" : "rgba(245,166,35,0.15)",
                }}
              >
                {faultCategory.priority}
              </span>
            </div>
            <div className="text-[10px] text-[#6b7490] space-y-0.5">
              <div><span className="text-[#94a3b8]">Cause:</span> {faultCategory.probableCause}</div>
              <div><span className="text-[#94a3b8]">Action:</span> {faultCategory.recommendedAction}</div>
            </div>
          </div>
        )}

        {/* ── SVG Cross-Section ── */}
        <div className="px-2 pt-2 border-b" style={{ borderColor: "#1e2231" }}>
          <TurbineCrossSection
            powerOutputMW={t.powerOutputMW}
            windSpeedMs={t.windSpeedMs}
            rotorSpeedRpm={t.rotorSpeedRpm}
            pitchAngleDeg={t.pitchAngleDeg}
            bearingTempC={t.bearingTempC}
            vibrationMmS={t.vibrationMmS}
            nacellePositionDeg={t.nacellePositionDeg}
            status={t.status}
            onPartClick={handlePartClick}
            activePart={selectedPart}
            faultPartId={faultPartId}
            curtailmentPartId={curtailmentPartId}
          />

          {/* Hint text when no part selected */}
          {!selectedPart && (
            <div className="text-center text-[9px] text-[#6b7490] py-1">
              Click any component to learn more
            </div>
          )}

          {/* Inline education panel (narrow viewport only) */}
          {selectedPart && isNarrow && (
            <TurbineEducationPanel
              partId={selectedPart}
              turbine={t}
              onClose={() => setSelectedPart(null)}
              curtailmentInfo={curtailInfo}
            />
          )}

          {/* Wake cone below cross-section (click opens wind education) */}
          <div
            onClick={() => handlePartClick("wind")}
            className="cursor-pointer"
            title="Click to learn about wake effects"
          >
            <TurbineWakeCone powerOutputMW={t.powerOutputMW} />
          </div>
        </div>

        {/* ── Sparklines ── */}
        <div className="px-3 py-2 border-b" style={{ borderColor: "#1e2231" }}>
          <TurbineSparklines
            powerHistory={powerHistory}
            windHistory={windHistory}
            currentPowerMW={t.powerOutputMW}
            currentWindMs={t.windSpeedMs}
          />
        </div>

        {/* ── Health Summary (compact row) ── */}
        <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: "#1e2231" }}>
          <div className="flex items-center gap-1">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: t.availabilityPct >= 95 ? SCADA_COLORS.ENERGIZED : SCADA_COLORS.WARNING }}
            />
            <span className="text-[10px] text-[#6b7490]">Avail</span>
            <span className="text-[10px] font-mono tabular-nums text-[#e8eaf0]">{t.availabilityPct.toFixed(1)}%</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[#6b7490]">Energy</span>
            <span className="text-[10px] font-mono tabular-nums text-[#e8eaf0]">{t.energyTodayMWh.toFixed(0)} MWh</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[#6b7490]">Hours</span>
            <span className="text-[10px] font-mono tabular-nums text-[#e8eaf0]">{t.operatingHours.toLocaleString()} h</span>
          </div>
        </div>

        {/* ── Compact Navigation Icons ── */}
        <div className="px-3 py-2 flex items-center gap-1.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                title={item.tip}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md border transition-colors"
                style={{ borderColor: `${item.color}40` }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = `${item.color}1a`;
                  e.currentTarget.style.borderColor = item.color;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.borderColor = `${item.color}40`;
                }}
              >
                <Icon size={12} color={item.color} />
                <span className="text-[9px] font-medium" style={{ color: item.color }}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Education Side Panel (wide viewport — rendered outside detail panel) ── */}
      {selectedPart && !isNarrow && (
        <TurbineEducationPanel
          partId={selectedPart}
          turbine={t}
          onClose={() => setSelectedPart(null)}
          curtailmentInfo={curtailInfo}
        />
      )}
    </>
  );
}
