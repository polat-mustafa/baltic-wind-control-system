/**
 * Power train of the SB-510 turbine (IEA 15 MW direct drive) — the energy
 * conversion chain, stage by stage: wind → rotor → main shaft on two bearings →
 * 200-pole PMSG at rotor speed (no gearbox) → full converter → step-up
 * transformer → 66 kV array cable.
 *
 * Each stage shows its live operating values, the power leaving it and the
 * loss it adds (from utils/landingPhysics v236PowerChain, built around the
 * turbine's electrical output so every number is consistent).
 * Stages and the secondary-component chips are buttons that open the part
 * education card; fault / curtailment / selected parts are highlighted.
 *
 * Replaces the earlier SVG cross-section (6 px text, front-view rotor drawn
 * on a side view, converter mislabelled AC/DC, transformer missing).
 */

import type { ReactNode } from "react";

import {
  Cable,
  CircleDot,
  Cpu,
  Fan,
  Magnet,
  Wind,
  type LucideIcon,
} from "lucide-react";

import {
  PART_EDUCATION_MAP,
  type TurbinePartId,
} from "../../constants/turbinePartEducation";
import type { TurbineStatus } from "../../types/landing";
import { V236, V236_ETA, v236PowerChain } from "../../utils/landingPhysics";

const WARN = "#f5a623";
const ALARM = "#ef4444";
const ACCENT = "#3b82f6";

/** Parts not on the main chain, still clickable for their education card. */
const OTHER_PARTS: TurbinePartId[] = [
  "hub",
  "shaft",
  "brake",
  "yaw",
  "yaw_brake",
  "cooler",
  "coolant_skid",
  "hpu",
  "anemometer",
  "control_cabinet",
  "ups",
  "bedplate",
  "nacelle",
  "cable_routing",
  "crane_rail",
  "fire_suppression",
  "lightning_conductor",
  "tower",
  "foundation",
];

/** Short chip labels; the card title comes from PART_EDUCATION_MAP. */
const CHIP_LABEL: Partial<Record<TurbinePartId, string>> = {
  control_cabinet: "Controller",
  coolant_skid: "Coolant skid",
  yaw_brake: "Yaw brake",
  cable_routing: "Cabling",
  crane_rail: "Crane",
  fire_suppression: "Fire system",
  lightning_conductor: "Lightning",
  hpu: "HPU",
  ups: "UPS",
};

const levelColor = (v: number, warn: number, alarm: number) =>
  v >= alarm ? ALARM : v >= warn ? WARN : undefined;
const mw = (v: number) => v.toFixed(2);

type PartState = "fault" | "curtailed" | "active" | "normal";

const STATE_COLOR: Record<PartState, string | null> = {
  fault: ALARM,
  curtailed: WARN,
  active: ACCENT,
  normal: null,
};

function Stage({
  id,
  state,
  onClick,
  icon: Icon,
  title,
  detail,
  power,
  loss,
}: {
  id: TurbinePartId;
  state: PartState;
  onClick?: (id: TurbinePartId) => void;
  icon: LucideIcon;
  title: string;
  detail: ReactNode;
  power?: string;
  loss?: { mw: number; eta?: number };
}) {
  const edge = STATE_COLOR[state];
  return (
    <button
      type="button"
      onClick={() => onClick?.(id)}
      aria-pressed={state === "active"}
      className={`relative z-10 grid w-full grid-cols-[28px_1fr_auto] items-center gap-2.5 rounded-lg border bg-bg-secondary px-2.5 py-2 text-left transition-colors hover:border-accent/60 hover:bg-bg-tertiary ${state === "fault" ? "animate-pulse" : ""}`}
      style={{ borderColor: edge ?? "var(--color-border-primary)" }}
    >
      <span
        className="flex size-7 items-center justify-center rounded-md bg-bg-tertiary"
        style={{ color: edge ?? "#9ba3b8" }}
      >
        <Icon size={15} strokeWidth={1.75} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium text-text-primary">
          {title}
        </span>
        <span className="block truncate font-mono text-[11px] tabular-nums text-text-muted">
          {detail}
        </span>
      </span>
      <span className="text-right">
        {power && (
          <span className="block font-mono text-xs font-medium tabular-nums text-text-primary">
            {power}
            <span className="ml-0.5 text-[10px] text-text-muted">MW</span>
          </span>
        )}
        {loss && (
          <span className="block font-mono text-[10px] tabular-nums text-text-muted">
            −{mw(loss.mw)}
            {loss.eta !== undefined && ` · η ${(loss.eta * 100).toFixed(1)}%`}
          </span>
        )}
      </span>
    </button>
  );
}

interface TurbinePowerTrainProps {
  powerOutputMW: number;
  windSpeedMs: number;
  rotorSpeedRpm: number;
  pitchAngleDeg: number;
  bearingTempC: number;
  vibrationMmS: number;
  nacellePositionDeg: number;
  stringNumber?: number;
  status: TurbineStatus;
  onPartClick?: (partId: TurbinePartId) => void;
  activePart?: TurbinePartId | null;
  faultPartId?: TurbinePartId | null;
  curtailmentPartId?: TurbinePartId | null;
}

export default function TurbinePowerTrain({
  powerOutputMW,
  windSpeedMs,
  rotorSpeedRpm,
  pitchAngleDeg,
  bearingTempC,
  vibrationMmS,
  nacellePositionDeg,
  stringNumber,
  status,
  onPartClick,
  activePart,
  faultPartId,
  curtailmentPartId,
}: TurbinePowerTrainProps) {
  const c = v236PowerChain(powerOutputMW, windSpeedMs, rotorSpeedRpm);
  const running =
    powerOutputMW > 0.05 && (status === "operating" || status === "curtailed");
  // Flow animation speed ∝ power (period 3 s at idle-ish → 0.8 s at rated)
  const flowSeconds = running
    ? 3 - 2.2 * Math.min(1, powerOutputMW / V236.ratedMW)
    : 0;

  const stageState = (id: TurbinePartId): PartState =>
    faultPartId === id
      ? "fault"
      : curtailmentPartId === id
        ? "curtailed"
        : activePart === id
          ? "active"
          : "normal";
  const stage = (id: TurbinePartId) => ({
    id,
    state: stageState(id),
    onClick: onPartClick,
  });

  return (
    <div>
      <div className="relative space-y-1.5">
        {/* Energy-flow spine behind the stage cards */}
        <div
          className="absolute bottom-4 left-[23px] top-4 w-0.5 overflow-hidden rounded bg-border-primary"
          aria-hidden
        >
          {running && (
            <div
              className="powertrain-flow absolute inset-x-0 h-full"
              style={{ animationDuration: `${flowSeconds.toFixed(2)}s` }}
            />
          )}
        </div>

        <Stage
          {...stage("wind")}
          icon={Wind}
          title="Wind through rotor disk"
          detail={`${windSpeedMs.toFixed(1)} m/s · ½ρAv³`}
          power={c.windMW.toFixed(1)}
        />
        <Stage
          {...stage("blades")}
          icon={Fan}
          title="Rotor · blades"
          detail={`${rotorSpeedRpm.toFixed(2)} rpm · pitch ${pitchAngleDeg.toFixed(1)}° · Cp ${c.cp.toFixed(2)}`}
          power={mw(c.rotorMW)}
          loss={c.windMW > 0 ? { mw: c.windMW - c.rotorMW } : undefined}
        />
        <Stage
          {...stage("bearing")}
          icon={CircleDot}
          title="Main shaft · two main bearings"
          detail={
            <>
              <span style={{ color: levelColor(bearingTempC, 65, 80) }}>
                {bearingTempC.toFixed(0)} °C
              </span>
              {" · "}
              <span style={{ color: levelColor(vibrationMmS, 4.5, 7.0) }}>
                {vibrationMmS.toFixed(1)} mm/s
              </span>
              {` · ${(c.rotorTorqueKNm / 1000).toFixed(1)} MN·m`}
            </>
          }
        />
        <Stage
          {...stage("generator")}
          icon={Magnet}
          title="Direct-drive PMSG · 200 poles"
          detail={`${c.generatorRpm.toFixed(2)} rpm · ${c.generatorHz.toFixed(1)} Hz · 4.77 kV`}
          power={mw(c.generator.outMW)}
          loss={{ mw: c.generator.lossMW, eta: V236_ETA.generator }}
        />
        <Stage
          {...stage("converter")}
          icon={Cpu}
          title="Full-scale converter AC/DC/AC"
          detail="→ 50 Hz · P & Q control"
          power={mw(c.converter.outMW)}
          loss={{ mw: c.converter.lossMW, eta: V236_ETA.converter }}
        />
        <Stage
          {...stage("transformer")}
          icon={Cable}
          title="Step-up transformer"
          detail="→ 66 kV"
          power={mw(c.transformer.outMW)}
          loss={{ mw: c.transformer.lossMW, eta: V236_ETA.transformer }}
        />
        <Stage
          {...stage("power_output")}
          icon={Cable}
          title={`66 kV array${stringNumber ? ` · string ${stringNumber}` : ""} → OSS`}
          detail={`nacelle heading ${nacellePositionDeg.toFixed(0)}°`}
          power={powerOutputMW.toFixed(2)}
        />
      </div>

      <div className="mt-3">
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">
          Other components
        </div>
        <div className="flex flex-wrap gap-1">
          {OTHER_PARTS.map((id) => {
            const color = STATE_COLOR[stageState(id)];
            const title = PART_EDUCATION_MAP[id]?.title ?? id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onPartClick?.(id)}
                title={title}
                aria-pressed={activePart === id}
                className="rounded-md border px-2 py-0.5 text-[11px] text-text-secondary transition-colors hover:border-accent/60 hover:text-text-primary"
                style={{
                  borderColor: color ?? "var(--color-border-primary)",
                  color: color ?? undefined,
                  backgroundColor: color ? `${color}1a` : undefined,
                }}
              >
                {CHIP_LABEL[id] ??
                  title
                    .replace(/\s*\(.*\)$/, "")
                    .replace(/^(Rotor|Main|Mechanical|Nacelle|Monopile) /, "")}
              </button>
            );
          })}
        </div>
      </div>
      {status === "fault" || status === "offline" ? (
        <p className="mt-2 text-[11px] text-text-muted">
          Rotor stopped, blades feathered (90°) — no power flow.
        </p>
      ) : null}
    </div>
  );
}
