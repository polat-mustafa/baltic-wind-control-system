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

import { useState, useEffect, useCallback, useMemo } from "react";
import { X, Wind, Zap, Monitor, Brain, ClipboardCheck, Activity, BookOpen, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { FAULT_CATEGORIES } from "../../constants/faultCategories";
import { SCADA_COLORS } from "../../constants/scadaColors";
import { FAULT_TO_PART, type TurbinePartId } from "../../constants/turbinePartEducation";
import { TURBINE_POSITIONS } from "../../constants/windFarmLayout";
import { useTurbineHistory } from "../../hooks/useTurbineHistory";
import { selectKPIs, useLandingStore } from "../../store/landingStore";
import type { TurbineData, TurbineStatus } from "../../types/landing";

import { inferCurtailment } from "../../utils/curtailmentReason";
import { computeWakeLosses } from "../../utils/wakeModel";

import TurbineCrossSection from "./TurbineCrossSection";
import TurbineEducationPanel from "./TurbineEducationPanel";
import TurbineSparklines from "./TurbineSparklines";
import TurbineWakeCone from "./TurbineWakeCone";
import { EducationPanel } from "../ui/EducationPanel";
import { turbineSelectionEducation } from "../../constants/education/library/turbineSelection";

// ── V236 Published power curve (interpolated from Vestas product card) ──
// Source: Vestas V236-15.0 MW published specifications
// Cut-in: 3 m/s, Rated: 12.5 m/s, Cut-out: 31 m/s
const V236_CURVE: { v: number; p: number }[] = [
  { v: 3.0, p: 0 }, { v: 4.0, p: 0.4 }, { v: 5.0, p: 0.95 },
  { v: 6.0, p: 1.8 }, { v: 7.0, p: 3.1 }, { v: 8.0, p: 4.9 },
  { v: 9.0, p: 7.1 }, { v: 10.0, p: 9.6 }, { v: 11.0, p: 12.0 },
  { v: 12.0, p: 14.0 }, { v: 12.5, p: 15.0 }, { v: 25.0, p: 15.0 }, { v: 31.0, p: 0 },
];

function V236PowerCurve({ windSpeedMs, powerOutputMW }: { windSpeedMs: number; powerOutputMW: number }) {
  const W = 400; const H = 90; const padL = 28; const padR = 4; const padT = 4; const padB = 18;
  const vMax = 32; const pMax = 16;
  const toX = (v: number) => padL + ((v / vMax) * (W - padL - padR));
  const toY = (p: number) => padT + ((1 - p / pMax) * (H - padT - padB));

  // Build SVG path
  const pts = V236_CURVE.map((d) => `${toX(d.v).toFixed(1)},${toY(d.p).toFixed(1)}`).join(" ");
  const polyline = `M ${pts.split(" ").join(" L ")}`;

  // Cp at current operating point
  const RHO = 1.225; const A = Math.PI * (236 / 2) ** 2;
  const pWind = 0.5 * RHO * A * Math.pow(Math.max(windSpeedMs, 0.1), 3) / 1e6;
  const cp = windSpeedMs > 3 && powerOutputMW > 0 ? Math.min(0.593, powerOutputMW / pWind) : 0;

  return (
    <div className="mt-1.5 mb-1">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
        {/* Grid lines */}
        {[0, 5, 10, 15].map((p) => (
          <line key={p} x1={padL} y1={toY(p)} x2={W - padR} y2={toY(p)}
            stroke="#2a3040" strokeWidth={0.5} />
        ))}
        {[0, 5, 10, 15, 20, 25, 30].map((v) => (
          <line key={v} x1={toX(v)} y1={padT} x2={toX(v)} y2={H - padB}
            stroke="#2a3040" strokeWidth={0.5} />
        ))}
        {/* Y labels */}
        {[0, 5, 10, 15].map((p) => (
          <text key={p} x={padL - 3} y={toY(p) + 3} fontSize={6} fill="#6b7490" textAnchor="end">
            {p}
          </text>
        ))}
        {/* X labels */}
        {[0, 5, 10, 15, 20, 25, 30].map((v) => (
          <text key={v} x={toX(v)} y={H - padB + 10} fontSize={6} fill="#6b7490" textAnchor="middle">
            {v}
          </text>
        ))}
        {/* Axes */}
        <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="#3a4255" strokeWidth={1} />
        <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="#3a4255" strokeWidth={1} />
        {/* Power curve */}
        <path d={polyline} fill="none" stroke="#3b82f6" strokeWidth={1.5} />
        {/* Rated power line */}
        <line x1={padL} y1={toY(15)} x2={W - padR} y2={toY(15)}
          stroke="#22c55e" strokeWidth={0.8} strokeDasharray="3,2" opacity={0.6} />
        {/* Current operating point */}
        {windSpeedMs >= 3 && windSpeedMs <= 31 && (
          <>
            <line x1={toX(windSpeedMs)} y1={padT} x2={toX(windSpeedMs)} y2={H - padB}
              stroke="#f59e0b" strokeWidth={1} strokeDasharray="2,2" />
            <circle cx={toX(windSpeedMs)} cy={toY(powerOutputMW)} r={3.5}
              fill="#f59e0b" stroke="#0f1117" strokeWidth={1} />
          </>
        )}
        {/* Axis labels */}
        <text x={W / 2} y={H - 1} fontSize={6} fill="#6b7490" textAnchor="middle">Wind speed (m/s)</text>
        <text x={7} y={H / 2} fontSize={6} fill="#6b7490" textAnchor="middle"
          transform={`rotate(-90, 7, ${H / 2})`}>MW</text>
      </svg>
      <div className="flex items-center gap-3 text-[9px] text-[#6b7490] mt-0.5">
        <span>
          <span className="text-[#f59e0b]">●</span> {windSpeedMs.toFixed(1)} m/s → {powerOutputMW.toFixed(1)} MW
        </span>
        {windSpeedMs > 3 && (
          <span>Cp = {cp.toFixed(3)} (Betz limit 0.593)</span>
        )}
        <span className="opacity-60">Vestas V236 product card (indicative)</span>
      </div>
    </div>
  );
}

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

/** Stable reference to turbine geographic data (never changes). */
const TURBINE_GEO = TURBINE_POSITIONS.map((t) => ({
  id: t.id,
  lat: t.lat,
  lon: t.lon,
}));

/** Round wind direction to nearest `step` degrees (matches WakeEffectLayer). */
function quantizeDir(deg: number, step = 5): number {
  return Math.round(deg / step) * step;
}

/** Wake loss color based on severity threshold. */
function wakeLossColor(pct: number): string {
  if (pct > 20) return "#ef4444"; // red
  if (pct > 10) return "#f97316"; // orange
  return "#fbbf24"; // yellow
}

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
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [showPowerCurve, setShowPowerCurve] = useState(false);

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

  // Wake loss computation — same quantized direction as WakeEffectLayer badges
  const kpis = useLandingStore(selectKPIs);
  const windDir = quantizeDir(kpis.windDirectionDeg);
  const wakeLoss = useMemo(() => {
    const losses = computeWakeLosses(TURBINE_GEO, windDir);
    return losses.find((l) => l.turbineId === t.id) ?? null;
  }, [windDir, t.id]);

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
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#6b7490]">String {t.stringNumber} · V236-15.0 MW</span>
              <button
                onClick={() => setLibraryOpen(true)}
                className="flex items-center gap-1 text-[9px] text-[#3b82f6] hover:text-[#60a5fa] transition-colors"
                title="Why was the V236-15.0 MW chosen?"
              >
                <BookOpen size={9} />
                Why V236?
              </button>
            </div>
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
            <TurbineWakeCone powerOutputMW={t.powerOutputMW} wakeLossPct={wakeLoss?.lossPct} />
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

        {/* ── Wake Loss (conditional) ── */}
        {wakeLoss && (
          <div className="px-3 py-2 border-b" style={{ borderColor: "#1e2231" }}>
            <div className="flex items-center gap-1.5 mb-1">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: wakeLossColor(wakeLoss.lossPct) }}
              />
              <span className="text-[11px] font-semibold" style={{ color: wakeLossColor(wakeLoss.lossPct) }}>
                Wake Loss: &minus;{wakeLoss.lossPct}%
              </span>
            </div>
            <div className="text-[9px] text-[#6b7490] mb-1">
              Power loss from upstream turbine wakes (Jensen/Park model)
            </div>
            <div className="text-[9px] text-[#94a3b8]">
              Upstream: {wakeLoss.upstreamIds.join(", ")}
            </div>
          </div>
        )}

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

        {/* ── Power Curve toggle ── */}
        <div className="px-3 py-1 border-b" style={{ borderColor: "#1e2231" }}>
          <button
            onClick={() => setShowPowerCurve((v) => !v)}
            className="flex items-center gap-1.5 text-[10px] text-[#6b7490] hover:text-[#e8eaf0] transition-colors w-full"
          >
            <TrendingUp size={10} />
            <span>V236 Power Curve</span>
            <span className="ml-auto text-[9px]">{showPowerCurve ? "▲" : "▼"}</span>
          </button>
          {showPowerCurve && (
            <V236PowerCurve
              windSpeedMs={t.windSpeedMs}
              powerOutputMW={t.powerOutputMW}
            />
          )}
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

      {/* ── Library Panel: Turbine Selection Rationale ── */}
      <EducationPanel
        content={turbineSelectionEducation}
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
      />
    </>
  );
}
