/**
 * Turbine Operator Faceplate — Siemens WinCC-style modal that opens
 * on TurbineCell click.
 *
 * Layout (industry-conventional):
 *   Header     — id · status · alarm count · op-hours
 *   2 columns  — OPERATING values · ENVIRONMENT values
 *   Trend      — 60-min rolling power, normal band P_set ± 5 %
 *   2 columns  — SETPOINTS · MANUAL CONTROLS (RBAC ≥ L3)
 *   Table      — per-turbine alarm history (last 24 h)
 *   Footer     — Inject Test Fault dropdown (faultBus → SCADA)
 *
 * RBAC: Start / Stop / Reset are disabled when selectedRoleLevel < 3
 * (Sr. Operator). Tooltip explains the gate.
 */

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUp,
  Pause,
  Play,
  RotateCcw,
  Wrench,
  X,
  Zap,
} from "lucide-react";

import {
  selectTurbine,
  useLandingStore,
} from "../../store/landingStore";
import { useScadaStore } from "../../store/scadaStore";
import { FAULT_CATEGORIES } from "../../constants/faultCategories";
import { Sparkline } from "../ui/Sparkline";
import { cn } from "../../lib/utils";
import type { TurbineFaultType } from "../../types/scada";

const TREND_LEN = 60;

interface TurbineFaceplateProps {
  turbineId: string | null;
  onClose: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  operating: "RUNNING",
  curtailed: "CURTAILED",
  fault:     "FAULTED",
  offline:   "OFFLINE",
};

const STATUS_DOT: Record<string, string> = {
  operating: "bg-status-normal",
  curtailed: "bg-status-warning",
  fault:     "bg-status-alarm animate-pulse",
  offline:   "bg-text-faint",
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-GB", { hour12: false });
}

const PRIORITY_TAG: Record<string, string> = {
  CRITICAL: "P1",
  HIGH:     "P2",
  MEDIUM:   "P3",
  LOW:      "JOURNAL",
};

export default function TurbineFaceplate({
  turbineId,
  onClose,
}: TurbineFaceplateProps) {
  const open = turbineId !== null;
  const turbine = useLandingStore(
    turbineId ? selectTurbine(turbineId) : () => undefined,
  );
  const environment = useLandingStore((s) => s.environment);

  const alarms = useScadaStore((s) => s.alarms);
  const role = useScadaStore((s) => s.selectedRoleLevel);
  const injectTurbineFault = useScadaStore((s) => s.injectTurbineFault);
  const addEvent = useScadaStore((s) => s.addEvent);

  const setTurbineFault = useLandingStore((s) => s.setTurbineFault);
  const clearTurbineFault = useLandingStore((s) => s.clearTurbineFault);

  const [mode, setMode] = useState<"AUTO" | "MANUAL">("AUTO");
  const [injectType, setInjectType] = useState<TurbineFaultType>(
    FAULT_CATEGORIES[0].type,
  );
  const trendRef = useRef<number[]>([]);
  const [tick, setTick] = useState(0);

  // Reset trend when faceplate opens for a different turbine
  useEffect(() => {
    if (open && turbineId) {
      trendRef.current = [];
      setTick(0);
      setMode("AUTO");
    }
  }, [open, turbineId]);

  // Roll the 60-element power buffer once per second while open
  useEffect(() => {
    if (!open || !turbineId) return;
    const id = setInterval(() => {
      const t = useLandingStore.getState().turbineMap[turbineId];
      if (!t) return;
      const buf = trendRef.current;
      buf.push(t.powerOutputMW);
      if (buf.length > TREND_LEN) buf.splice(0, buf.length - TREND_LEN);
      setTick((n) => n + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [open, turbineId]);

  const turbineAlarms = useMemo(() => {
    if (!turbineId) return [];
    return alarms
      .filter((a) => a.equipment === turbineId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 12);
  }, [alarms, turbineId]);

  const activeAlarmCount = useMemo(
    () =>
      turbineAlarms.filter(
        (a) => a.state === "ACTIVE" || a.state === "ACKNOWLEDGED",
      ).length,
    [turbineAlarms],
  );

  const canControl = role >= 3;

  if (!turbineId || !turbine) {
    return (
      <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm" />
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  const handleStart = () => {
    if (!canControl) return;
    clearTurbineFault(turbineId);
    addEvent({
      source: turbineId,
      type: "OPERATOR_COMMAND",
      description: `Manual START issued via faceplate`,
      priority: "INFO",
    });
  };

  const handleStop = () => {
    if (!canControl) return;
    setTurbineFault(turbineId, "COMMUNICATION_LOSS");
    addEvent({
      source: turbineId,
      type: "OPERATOR_COMMAND",
      description: `Manual STOP issued via faceplate`,
      priority: "MEDIUM",
    });
  };

  const handleReset = () => {
    if (!canControl) return;
    clearTurbineFault(turbineId);
    addEvent({
      source: turbineId,
      type: "OPERATOR_COMMAND",
      description: `Operator RESET — alarms cleared`,
      priority: "INFO",
    });
  };

  const handleInject = () => {
    if (!turbineId) return;
    injectTurbineFault(turbineId, injectType);
  };

  const ratedMW = 15.0;
  const setpoint = turbine.status === "curtailed" ? ratedMW * 0.6 : ratedMW;
  const band: [number, number] = [setpoint * 0.95, setpoint * 1.05];

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            "scada-isa101 fixed left-1/2 top-1/2 z-[2100]",
            "w-full max-w-3xl max-h-[88vh]",
            "-translate-x-1/2 -translate-y-1/2 flex flex-col",
            "border border-border-primary bg-bg-secondary",
            "focus:outline-none",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border-primary bg-bg-tertiary shrink-0">
            <div className="flex items-center gap-3">
              <Wrench size={14} className="text-text-muted" />
              <Dialog.Title className="text-sm font-semibold uppercase tracking-wider text-text-primary">
                {turbineId} · Operator Faceplate
              </Dialog.Title>
              <span
                className={cn(
                  "w-2 h-2 rounded-full",
                  STATUS_DOT[turbine.status],
                )}
                aria-hidden
              />
              <span className="text-[11px] font-mono text-text-secondary">
                {STATUS_LABEL[turbine.status] ?? turbine.status.toUpperCase()}
              </span>
              <span className="text-[10px] text-text-muted">
                Mode: <span className="text-text-secondary">{mode}</span>
              </span>
              <span className="text-[10px] text-text-muted">
                Alarms:{" "}
                <span
                  className={cn(
                    "font-mono",
                    activeAlarmCount > 0
                      ? "text-status-alarm"
                      : "text-text-secondary",
                  )}
                >
                  {activeAlarmCount}
                </span>
              </span>
              <span className="text-[10px] text-text-muted">
                Op-hrs:{" "}
                <span className="font-mono tabular-nums text-text-secondary">
                  {turbine.operatingHours.toLocaleString()}
                </span>
              </span>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="text-text-muted hover:text-text-primary p-1"
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </Dialog.Close>
          </div>

          {/* Body — scrollable */}
          <div className="flex-1 min-h-0 overflow-auto p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* OPERATING values */}
            <section className="border border-border-primary bg-bg-primary">
              <h3 className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted border-b border-border-primary bg-bg-tertiary">
                Operating
              </h3>
              <div className="p-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
                <DataRow
                  label="Power"
                  value={turbine.powerOutputMW.toFixed(1)}
                  unit="MW"
                />
                <DataRow
                  label="Rotor"
                  value={turbine.rotorSpeedRpm.toFixed(2)}
                  unit="rpm"
                />
                <DataRow
                  label="Pitch"
                  value={turbine.pitchAngleDeg.toFixed(1)}
                  unit="°"
                />
                <DataRow
                  label="Yaw"
                  value={Math.round(turbine.nacellePositionDeg).toString()}
                  unit="°"
                />
                <DataRow
                  label="Bearing T"
                  value={turbine.bearingTempC.toFixed(0)}
                  unit="°C"
                  warn={turbine.bearingTempC > 70}
                />
                <DataRow
                  label="Vibration"
                  value={turbine.vibrationMmS.toFixed(2)}
                  unit="mm/s"
                  warn={turbine.vibrationMmS > 4.5}
                />
                <DataRow
                  label="Avail."
                  value={turbine.availabilityPct.toFixed(1)}
                  unit="%"
                />
                <DataRow
                  label="Energy"
                  value={turbine.energyTodayMWh.toFixed(0)}
                  unit="MWh"
                />
              </div>
            </section>

            {/* ENVIRONMENT values */}
            <section className="border border-border-primary bg-bg-primary">
              <h3 className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted border-b border-border-primary bg-bg-tertiary">
                Environment
              </h3>
              <div className="p-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
                <DataRow
                  label="Wind"
                  value={turbine.windSpeedMs.toFixed(1)}
                  unit="m/s"
                />
                <div className="flex items-baseline justify-between gap-2 text-[11px]">
                  <span className="text-text-muted uppercase tracking-wider text-[9px]">
                    Wind dir
                  </span>
                  <span className="font-mono tabular-nums text-text-secondary inline-flex items-center gap-1">
                    {Math.round(turbine.nacellePositionDeg)}°
                    <ArrowUp
                      size={10}
                      className="text-text-muted"
                      style={{
                        transform: `rotate(${turbine.nacellePositionDeg}deg)`,
                      }}
                    />
                  </span>
                </div>
                <DataRow
                  label="Air T"
                  value={environment.airTemperatureC.toFixed(1)}
                  unit="°C"
                />
                <DataRow
                  label="Pressure"
                  value={environment.pressureHpa.toFixed(0)}
                  unit="hPa"
                />
                <DataRow
                  label="Sea state"
                  value={`Bft ${environment.beaufortScale}`}
                />
                <DataRow
                  label="Wave Hs"
                  value={environment.significantWaveHeightM.toFixed(1)}
                  unit="m"
                />
                <DataRow
                  label="Sea T"
                  value={environment.seaTemperatureC.toFixed(1)}
                  unit="°C"
                />
                <DataRow
                  label="Visibility"
                  value={environment.visibilityKm.toFixed(0)}
                  unit="km"
                />
              </div>
            </section>

            {/* TREND — full width */}
            <section className="md:col-span-2 border border-border-primary bg-bg-primary">
              <div className="flex items-center justify-between px-2 py-1 border-b border-border-primary bg-bg-tertiary">
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Power Trend · 60 s
                </h3>
                <span className="text-[10px] text-text-muted">
                  Setpoint{" "}
                  <span className="font-mono text-text-secondary">
                    {setpoint.toFixed(1)} MW ± 5 %
                  </span>
                </span>
              </div>
              <div className="p-2">
                <Sparkline
                  key={tick}
                  points={trendRef.current}
                  band={band}
                  width={620}
                  height={70}
                  className="w-full"
                  strokeColor="var(--color-text-secondary, #D8D8D8)"
                />
              </div>
            </section>

            {/* SETPOINTS */}
            <section className="border border-border-primary bg-bg-primary">
              <h3 className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted border-b border-border-primary bg-bg-tertiary">
                Setpoints
              </h3>
              <div className="p-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
                <DataRow
                  label="P_set"
                  value={setpoint.toFixed(1)}
                  unit="MW"
                />
                <DataRow
                  label="Curtail"
                  value={turbine.status === "curtailed" ? "40" : "0"}
                  unit="%"
                />
                <DataRow label="Mode" value={mode} />
                <DataRow label="Cut-out" value="31" unit="m/s" />
              </div>
            </section>

            {/* MANUAL CONTROLS */}
            <section className="border border-border-primary bg-bg-primary">
              <h3 className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted border-b border-border-primary bg-bg-tertiary flex items-center justify-between">
                Manual Controls
                {!canControl && (
                  <span className="inline-flex items-center gap-1 text-[9px] text-status-warning normal-case">
                    <AlertTriangle size={10} />
                    Sr. Operator (L3+) required
                  </span>
                )}
              </h3>
              <div className="p-2 flex flex-col gap-2">
                <div className="flex items-center gap-1.5">
                  <ControlButton
                    icon={<Play size={11} />}
                    label="Start"
                    onClick={handleStart}
                    disabled={!canControl}
                    tone="normal"
                  />
                  <ControlButton
                    icon={<Pause size={11} />}
                    label="Stop"
                    onClick={handleStop}
                    disabled={!canControl}
                    tone="warning"
                  />
                  <ControlButton
                    icon={<RotateCcw size={11} />}
                    label="Reset"
                    onClick={handleReset}
                    disabled={!canControl}
                    tone="info"
                  />
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-text-muted">Mode:</span>
                  <ModeToggle
                    value="AUTO"
                    current={mode}
                    onClick={() => setMode("AUTO")}
                  />
                  <ModeToggle
                    value="MANUAL"
                    current={mode}
                    onClick={() => setMode("MANUAL")}
                    disabled={!canControl}
                  />
                </div>
              </div>
            </section>

            {/* ALARM HISTORY */}
            <section className="md:col-span-2 border border-border-primary bg-bg-primary">
              <h3 className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted border-b border-border-primary bg-bg-tertiary">
                Alarm History · this turbine · last 24 h
              </h3>
              {turbineAlarms.length === 0 ? (
                <div className="p-3 text-[11px] text-text-muted text-center">
                  No alarms recorded for {turbineId}.
                </div>
              ) : (
                <ul className="divide-y divide-border-primary">
                  {turbineAlarms.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-baseline gap-2 px-2 py-1 text-[11px] font-mono"
                    >
                      <span className="text-text-muted tabular-nums">
                        {formatTime(a.timestamp)}
                      </span>
                      <span
                        data-priority={PRIORITY_TAG[a.priority] ?? "JOURNAL"}
                        className="px-1 text-[9px] font-semibold uppercase tracking-wide"
                      >
                        {PRIORITY_TAG[a.priority] ?? "INFO"}
                      </span>
                      <span className="text-text-secondary flex-1 truncate">
                        {a.description}
                      </span>
                      <span className="text-text-muted">{a.state}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Footer — fault injector */}
          <div className="border-t border-border-primary bg-bg-tertiary px-3 py-2 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <Zap size={12} className="text-text-muted" />
              <span className="text-[10px] uppercase tracking-wider text-text-muted">
                Inject Test Fault
              </span>
              <select
                value={injectType}
                onChange={(e) =>
                  setInjectType(e.target.value as TurbineFaultType)
                }
                className="text-xs bg-bg-secondary border border-border-primary px-2 py-1 text-text-secondary"
              >
                {FAULT_CATEGORIES.map((c) => (
                  <option key={c.type} value={c.type}>
                    {c.label} ({c.priority})
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleInject}
              className={cn(
                "text-xs px-3 py-1 border bg-bg-secondary border-border-primary",
                "text-text-secondary hover:bg-bg-elevated hover:text-text-primary",
              )}
            >
              Inject Fault →
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function DataRow({
  label,
  value,
  unit,
  warn,
}: {
  label: string;
  value: string;
  unit?: string;
  warn?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-[11px]">
      <span className="text-text-muted uppercase tracking-wider text-[9px]">
        {label}
      </span>
      <span
        className={cn(
          "font-mono tabular-nums",
          warn ? "text-status-alarm" : "text-text-secondary",
        )}
      >
        {value}
        {unit && (
          <span className="text-text-muted ml-0.5 text-[9px]">{unit}</span>
        )}
      </span>
    </div>
  );
}

function ControlButton({
  icon,
  label,
  onClick,
  disabled,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone: "normal" | "warning" | "info";
}) {
  const toneClass = {
    normal:
      "border-status-normal/60 text-status-normal hover:bg-status-normal/10",
    warning:
      "border-status-warning/60 text-status-warning hover:bg-status-warning/10",
    info: "border-border-primary text-text-secondary hover:bg-bg-elevated",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={
        disabled
          ? "Requires Sr. Operator (L3+) RBAC role"
          : `${label} command`
      }
      className={cn(
        "flex items-center gap-1.5 text-xs px-3 py-1 border transition-colors",
        toneClass,
        disabled &&
          "opacity-40 cursor-not-allowed hover:bg-transparent",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function ModeToggle({
  value,
  current,
  onClick,
  disabled,
}: {
  value: "AUTO" | "MANUAL";
  current: "AUTO" | "MANUAL";
  onClick: () => void;
  disabled?: boolean;
}) {
  const active = value === current;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "px-2 py-0.5 border text-[10px] font-mono transition-colors",
        active
          ? "border-accent text-accent bg-accent/10"
          : "border-border-primary text-text-muted hover:text-text-secondary",
        disabled && "opacity-40 cursor-not-allowed",
      )}
    >
      {value}
    </button>
  );
}
