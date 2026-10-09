/**
 * Turbine detail panel — one WTG, opened by clicking a turbine on the map
 * (the 3D viewer renders to its left, see LandingPage).
 *
 * Top to bottom: live power vs rated + key operating values, active fault or
 * curtailment reason, power-train diagram (click a stage or component → part
 * education card expands inline, and the 3D viewer flies to the part), 60 s trends, wake loss, operating point on the IEA 15 MW power
 * curve, condition data, and links into the project dashboards.
 *
 * Uses the shared EquipmentPanel shell; Esc first closes an open part card,
 * then the panel.
 */

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";

import {
  Activity,
  BookOpen,
  Brain,
  Cpu,
  Fan,
  Monitor,
  Wind,
  Zap,
} from "lucide-react";

import { turbineSelectionEducation } from "../../constants/education/library/turbineSelection";
import { FAULT_CATEGORIES } from "../../constants/faultCategories";
import {
  FAULT_TO_PART,
  type TurbinePartId,
} from "../../constants/turbinePartEducation";
import { useTurbineHistory } from "../../hooks/useTurbineHistory";
import {
  selectKPIs,
  selectTurbinePart,
  useLandingStore,
} from "../../store/landingStore";
import type { TurbineData, TurbineStatus } from "../../types/landing";
import { inferCurtailment } from "../../utils/curtailmentReason";
import {
  ROTOR_DIAMETER_M,
  V236,
  turbinePowerMW,
  wakePowerLossPct,
} from "../../utils/landingPhysics";
import { useFleet } from "../../lib/fleet";
import { computeWakeLosses } from "../../utils/wakeModel";
import { EducationPanel } from "../ui/EducationPanel";

import {
  DataRow,
  EquipmentPanel,
  HeroValue,
  LevelBar,
  PanelSection,
} from "./EquipmentPanel";
import TurbineEducationPanel from "./TurbineEducationPanel";
import TurbinePowerTrain from "./TurbinePowerTrain";
import TurbineSparklines from "./TurbineSparklines";
import TurbineWakeCone from "./TurbineWakeCone";

const NORMAL = "#4cc38a";
const WARN = "#f0b13e";
const ALARM = "#f25c54";
const MUTED = "#7189a0";
const RHO_AIR = 1.225; // kg/m³, ISO standard atmosphere
const ROTOR_AREA_M2 = Math.PI * (ROTOR_DIAMETER_M / 2) ** 2;

const STATUS: Record<TurbineStatus, { label: string; color: string }> = {
  operating: { label: "Operating", color: NORMAL },
  curtailed: { label: "Curtailed", color: WARN },
  fault: { label: "Fault", color: ALARM },
  offline: { label: "Offline", color: "#a3b6c8" },
};

/** Where to look at this turbine next (names as in the sidebar). */
const NAV_ITEMS = [
  { label: "Wind Resource", path: "/wind-resource", icon: Wind, what: "Wake loss and AEP" },
  { label: "Grid Integration", path: "/hv-grid", icon: Zap, what: "Load flow, FRT, P/Q" },
  { label: "SCADA", path: "/scada", icon: Monitor, what: "Bay, alarms, IEC 61850" },
  { label: "Forecasting", path: "/forecast", icon: Brain, what: "Power forecast" },
  { label: "Digital Twin", path: "/digital-twin", icon: Cpu, what: "Condition, health index" },
  { label: "Turbine Physics", path: "/turbine-physics", icon: Activity, what: "Cp(λ, β), pitch, yaw" },
];

/** Round wind direction to nearest `step` degrees (matches WakeEffectLayer). */
const quantizeDir = (deg: number, step = 5) => Math.round(deg / step) * step;

const levelColor = (v: number, warn: number, alarm: number) =>
  v >= alarm ? ALARM : v >= warn ? WARN : NORMAL;

/** Power coefficient at the operating point, Cp = P / (½ρAv³), capped at Betz. */
function powerCoefficient(powerMW: number, windMs: number): number {
  if (windMs <= V236.cutInMs || powerMW <= 0) return 0;
  const windPowerMW = (0.5 * RHO_AIR * ROTOR_AREA_M2 * windMs ** 3) / 1e6;
  return Math.min(16 / 27, powerMW / windPowerMW);
}

/** IEA 15 MW power curve (shared model) with the live operating point. */
function PowerCurveChart({
  windMs,
  powerMW,
}: {
  windMs: number;
  powerMW: number;
}) {
  const W = 408;
  const H = 120;
  const pad = { l: 30, r: 8, t: 8, b: 24 };
  const vMax = 32;
  const pMax = 16;
  const x = (v: number) => pad.l + (v / vMax) * (W - pad.l - pad.r);
  const y = (p: number) => pad.t + (1 - p / pMax) * (H - pad.t - pad.b);
  const curve = Array.from({ length: 129 }, (_, i) => {
    const v = (i / 128) * vMax;
    return `${i ? "L" : "M"}${x(v).toFixed(1)},${y(turbinePowerMW(v)).toFixed(1)}`;
  }).join(" ");
  const inRange = windMs >= V236.cutInMs && windMs <= V236.cutOutMs;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Power curve (IEA 15 MW model) with operating point"
    >
      {[0, 5, 10, 15].map((p) => (
        <g key={p}>
          <line
            x1={pad.l}
            x2={W - pad.r}
            y1={y(p)}
            y2={y(p)}
            stroke="#1f3448"
            strokeWidth={0.75}
          />
          <text
            x={pad.l - 5}
            y={y(p) + 3}
            fontSize={9}
            fill={MUTED}
            textAnchor="end"
            fontFamily="IBM Plex Mono, monospace"
          >
            {p}
          </text>
        </g>
      ))}
      {[0, V236.cutInMs, Number(V236.ratedMs.toFixed(1)), 20, V236.cutOutMs].map((v) => (
        <text
          key={v}
          x={x(v)}
          y={H - 10}
          fontSize={9}
          fill={MUTED}
          textAnchor="middle"
          fontFamily="IBM Plex Mono, monospace"
        >
          {v}
        </text>
      ))}
      <text x={W - pad.r} y={H - 1} fontSize={9} fill={MUTED} textAnchor="end">
        wind m/s
      </text>
      <text
        x={pad.l - 5}
        y={pad.t - 1}
        fontSize={9}
        fill={MUTED}
        textAnchor="end"
      >
        MW
      </text>
      <path d={curve} fill="none" stroke="#45c8d9" strokeWidth={1.75} />
      {inRange && (
        <>
          <line
            x1={x(windMs)}
            x2={x(windMs)}
            y1={pad.t}
            y2={H - pad.b}
            stroke={WARN}
            strokeDasharray="3 3"
          />
          <circle
            cx={x(windMs)}
            cy={y(powerMW)}
            r={4}
            fill={WARN}
            stroke="#0a1520"
            strokeWidth={1.5}
          />
        </>
      )}
    </svg>
  );
}

function Stat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="rounded-lg bg-bg-secondary/70 px-2 py-1.5">
      <div className="text-xs uppercase tracking-wider text-text-muted">
        {label}
      </div>
      <div className="font-mono text-sm font-medium tabular-nums text-text-primary">
        {value}
        <span className="ml-0.5 text-xs text-text-muted">{unit}</span>
      </div>
    </div>
  );
}

interface TurbineDetailPanelProps {
  turbine: TurbineData;
  onClose: () => void;
  /** Horizontal offset from the map's left edge (≈ 600 when the 3D viewer is shown). */
  leftOffset?: number;
  /** Explicit placement (wins over leftOffset): used when the 3D viewer is stacked above the panel. */
  placement?: CSSProperties;
}

export default function TurbineDetailPanel({
  turbine: t,
  onClose,
  leftOffset = 20,
  placement,
}: TurbineDetailPanelProps) {
  const navigate = useNavigate();
  // selectedPart lives in the store so the 3D viewer highlights the same part
  const selectedPart = useLandingStore(selectTurbinePart);
  const setSelectedPart = useLandingStore((s) => s.setSelectedTurbinePart);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const status = STATUS[t.status];
  const faultCategory =
    t.status === "fault" && t.faultType
      ? FAULT_CATEGORIES.find((c) => c.type === t.faultType)
      : null;
  const faultPartId: TurbinePartId | null =
    t.status === "fault" && t.faultType
      ? (FAULT_TO_PART[t.faultType] ?? null)
      : null;
  const curtailInfo = inferCurtailment(t);
  const curtailmentPartId: TurbinePartId | null =
    curtailInfo?.affectedPart ?? null;

  const { powerHistory, windHistory } = useTurbineHistory(
    t.powerOutputMW,
    t.windSpeedMs,
  );

  // Wake loss — same quantized direction as the WakeEffectLayer badges
  const kpis = useLandingStore(selectKPIs);
  const windDir = quantizeDir(kpis.windDirectionDeg);
  // Live power loss at the current freestream (0 when the waked wind is
  // still above rated) — rounded to 0.5 m/s like the map's wake badges.
  const freeMs = Math.round(kpis.freestreamWindMs * 2) / 2;
  const fleet = useFleet();
  const wakeLoss = useMemo(() => {
    const w = computeWakeLosses(fleet.turbines, windDir).find((l) => l.turbineId === t.id);
    return w ? { ...w, lossPct: Math.round(wakePowerLossPct(freeMs, w.deficit)) } : null;
  }, [windDir, freeMs, t.id, fleet]);

  const handlePartClick = useCallback(
    (partId: TurbinePartId) =>
      setSelectedPart(selectedPart === partId ? null : partId),
    [selectedPart, setSelectedPart],
  );

  // Esc closes an open part card first (capture phase runs before the shell's
  // handler; preventDefault tells the shell not to close the whole panel).
  useEffect(() => {
    if (!selectedPart) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Escape") return;
      e.preventDefault();
      setSelectedPart(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [selectedPart, setSelectedPart]);

  const ratedPct = (t.powerOutputMW / V236.ratedMW) * 100;
  const cp = powerCoefficient(t.powerOutputMW, t.windSpeedMs);

  return (
    <>
      <EquipmentPanel
        icon={Fan}
        tag={t.id}
        subtitle={`String ${t.stringNumber} · IEA-15-240-RWT · direct drive · hub 150 m · rotor Ø ${ROTOR_DIAMETER_M.toFixed(0)} m`}
        status={status}
        onClose={onClose}
        width={placement ? "auto" : 440}
        placement={placement ?? { left: leftOffset, top: 60 }}
        footnote={
          <button
            onClick={() => setLibraryOpen(true)}
            className="inline-flex items-center gap-1 text-accent transition-colors hover:text-accent-hover"
          >
            <BookOpen size={11} /> Why a 15 MW direct-drive turbine here?
          </button>
        }
      >
        {/* Live output */}
        <div className="border-b border-border-primary/60 px-4 py-3">
          <div className="flex items-end justify-between">
            <HeroValue
              caption="Active power"
              value={t.powerOutputMW.toFixed(1)}
              unit="MW"
              color={status.color}
            />
            <div className="pb-1 text-right font-mono text-xs tabular-nums text-text-muted">
              <span className="text-text-primary">{ratedPct.toFixed(0)} %</span>{" "}
              of {V236.ratedMW} MW
            </div>
          </div>
          <div className="mt-2.5">
            <LevelBar
              value={t.powerOutputMW}
              max={V236.ratedMW}
              color={status.color}
            />
          </div>
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            <Stat label="Wind" value={t.windSpeedMs.toFixed(1)} unit="m/s" />
            <Stat label="Rotor" value={t.rotorSpeedRpm.toFixed(2)} unit="rpm" />
            <Stat label="Pitch" value={t.pitchAngleDeg.toFixed(1)} unit="°" />
            <Stat label="Cp" value={cp.toFixed(2)} unit="" />
          </div>
        </div>

        {faultCategory && (
          <div className="border-b border-border-primary/60 bg-[#ef44440f] px-4 py-3">
            <div className="flex items-center gap-2">
              <span
                className="size-2 animate-pulse rounded-full"
                style={{ backgroundColor: ALARM }}
              />
              <span className="text-xs font-semibold" style={{ color: ALARM }}>
                {faultCategory.label}
              </span>
              <span
                className="ml-auto rounded px-1.5 py-0.5 font-mono text-xs font-bold"
                style={{
                  color: faultCategory.priority === "CRITICAL" ? ALARM : WARN,
                  backgroundColor:
                    faultCategory.priority === "CRITICAL"
                      ? `${ALARM}26`
                      : `${WARN}26`,
                }}
              >
                {faultCategory.priority}
              </span>
            </div>
            <p className="mt-1.5 text-xs leading-snug text-text-secondary">
              <span className="text-text-muted">Cause · </span>
              {faultCategory.probableCause}
            </p>
            <p className="mt-0.5 text-xs leading-snug text-text-secondary">
              <span className="text-text-muted">Action · </span>
              {faultCategory.recommendedAction}
            </p>
          </div>
        )}

        {curtailInfo && (
          <div className="border-b border-border-primary/60 bg-[#f5a6230d] px-4 py-3">
            <div className="text-xs font-semibold" style={{ color: WARN }}>
              {curtailInfo.label}
            </div>
            <p className="mt-1 text-xs leading-snug text-text-secondary">
              {curtailInfo.explanation}
            </p>
          </div>
        )}

        <PanelSection title="Power train" aside="click a stage to learn">
          <TurbinePowerTrain
            powerOutputMW={t.powerOutputMW}
            windSpeedMs={t.windSpeedMs}
            rotorSpeedRpm={t.rotorSpeedRpm}
            pitchAngleDeg={t.pitchAngleDeg}
            bearingTempC={t.bearingTempC}
            vibrationMmS={t.vibrationMmS}
            nacellePositionDeg={t.nacellePositionDeg}
            stringNumber={t.stringNumber}
            status={t.status}
            onPartClick={handlePartClick}
            activePart={selectedPart}
            faultPartId={faultPartId}
            curtailmentPartId={curtailmentPartId}
          />
          {selectedPart && (
            <TurbineEducationPanel
              partId={selectedPart}
              turbine={t}
              onClose={() => setSelectedPart(null)}
              curtailmentInfo={curtailInfo}
            />
          )}
        </PanelSection>

        <PanelSection title="Last 60 s">
          <TurbineSparklines
            powerHistory={powerHistory}
            windHistory={windHistory}
            currentPowerMW={t.powerOutputMW}
            currentWindMs={t.windSpeedMs}
          />
        </PanelSection>

        <PanelSection title="Wake" aside="Jensen / Park model">
          <button
            onClick={() => handlePartClick("wind")}
            className="block w-full cursor-pointer"
            title="Learn about wake effects"
          >
            <TurbineWakeCone
              powerOutputMW={t.powerOutputMW}
              wakeLossPct={wakeLoss?.lossPct}
            />
          </button>
          {wakeLoss && (
            <>
              <DataRow
                label="Loss from upstream wakes"
                value={`−${wakeLoss.lossPct}`}
                unit="%"
                color={levelColor(wakeLoss.lossPct, 10, 20)}
              />
              <DataRow
                label="Upstream turbines"
                value={wakeLoss.upstreamIds.join(", ")}
              />
            </>
          )}
        </PanelSection>

        <PanelSection
          title="Operating point · IEA 15 MW power curve"
          aside={`Betz limit Cp ≤ ${(16 / 27).toFixed(3)}`}
        >
          <PowerCurveChart windMs={t.windSpeedMs} powerMW={t.powerOutputMW} />
          <p className="mt-1 text-xs text-text-muted">
            cut-in {V236.cutInMs} · rated {V236.ratedMs} · cut-out{" "}
            {V236.cutOutMs} m/s — same curve as the P1 backend
          </p>
        </PanelSection>

        <PanelSection title="Condition">
          <DataRow
            label="Main bearing temperature"
            value={t.bearingTempC.toFixed(1)}
            unit="°C"
            color={levelColor(t.bearingTempC, 65, 80)}
          />
          <DataRow
            label="Vibration (ISO 10816-21)"
            value={t.vibrationMmS.toFixed(1)}
            unit="mm/s"
            color={levelColor(t.vibrationMmS, 4.5, 7.0)}
          />
          <DataRow
            label="Nacelle heading"
            value={t.nacellePositionDeg.toFixed(0)}
            unit="°"
          />
          <DataRow
            label="Availability"
            value={t.availabilityPct.toFixed(1)}
            unit="%"
            color={t.availabilityPct >= 95 ? NORMAL : WARN}
          />
          <DataRow
            label="Energy today"
            value={t.energyTodayMWh.toFixed(0)}
            unit="MWh"
          />
          <DataRow
            label="Operating hours"
            value={t.operatingHours.toLocaleString("en-US")}
            unit="h"
          />
        </PanelSection>

        <PanelSection title="Open in">
          <div className="grid grid-cols-2 gap-1.5">
            {NAV_ITEMS.map(({ label, path, icon: Icon, what }) => (
              <button
                key={path}
                onClick={() => navigate(path)}
                className="group flex items-center gap-2 rounded-lg border border-border-primary px-2.5 py-2 text-left transition-colors hover:border-accent/60 hover:bg-accent-muted"
              >
                <Icon size={15} className="shrink-0 text-text-muted group-hover:text-accent" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-text-primary">{label}</span>
                  <span className="block truncate text-xs text-text-muted">{what}</span>
                </span>
              </button>
            ))}
          </div>
        </PanelSection>
      </EquipmentPanel>

      <EducationPanel
        content={turbineSelectionEducation}
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
      />
    </>
  );
}
