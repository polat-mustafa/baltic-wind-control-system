/**
 * Expanded-viewer part guide: a rail of components (click → camera flies
 * there) and an info card for the selected one — overview, design value of the modelled turbine,
 * live values from the simulation, governing formulas, standards and the
 * faults that affect it. Content comes from constants/turbinePartEducation.
 */

import { useEffect, useState } from "react";
import { Pause, Play, X } from "lucide-react";

import {
  PART_EDUCATION_MAP,
  type TurbinePartId,
} from "../../../../constants/turbinePartEducation";
import type { TurbineData } from "../../../../types/landing";
import { ROTOR_RADIUS } from "../model/layout";
import { PART_RAIL } from "./partRail";
import { CONVERTER_GRID_KV, v236PowerChain, v236ThrustMN } from "../../../../utils/landingPhysics";
import { FormulaPaper } from "../../../ui/MathPaper";

const R = ROTOR_RADIUS; // m, rotor radius (IEA 15 MW)


/** Live, physics-derived values for a part (units in the label). */
function liveFacts(part: TurbinePartId, t: TurbineData): [string, string][] {
  const omega = (t.rotorSpeedRpm * 2 * Math.PI) / 60; // rad/s
  const tip = omega * R;
  // Same power chain as the detail panel (P_el back to rotor through Πη)
  const chain = v236PowerChain(t.powerOutputMW, t.windSpeedMs, t.rotorSpeedRpm);
  const torqueMNm = chain.rotorTorqueKNm / 1000;
  // Rotor thrust (shared model); a stopped, feathered rotor carries ~none
  const v = t.windSpeedMs;
  const stopped = t.status === "fault" || t.status === "offline";
  const thrustMN = stopped ? 0 : v236ThrustMN(v);
  switch (part) {
    case "blades":
      return [
        ["Tip speed", `${tip.toFixed(0)} m/s`],
        ["Tip-speed ratio λ", v > 1 ? (tip / v).toFixed(1) : "–"],
        ["Pitch", `${t.pitchAngleDeg.toFixed(1)}°`],
        ["Cp (rotor)", chain.cp.toFixed(2)],
      ];
    case "hub":
    case "shaft":
      return [
        ["Rotor speed", `${t.rotorSpeedRpm.toFixed(2)} rpm`],
        ["Shaft torque", `${torqueMNm.toFixed(1)} MN·m`],
        ["Pitch", `${t.pitchAngleDeg.toFixed(1)}°`],
      ];
    case "bearing":
      return [
        ["Bearing temp.", `${t.bearingTempC.toFixed(0)} °C`],
        ["Vibration", `${t.vibrationMmS.toFixed(1)} mm/s`],
        ["Rotor thrust", `${thrustMN.toFixed(2)} MN`],
      ];
    case "generator":
      return [
        ["Speed", `${chain.generatorRpm.toFixed(2)} rpm (direct drive)`],
        ["Frequency", `${chain.generatorHz.toFixed(1)} Hz`],
        ["Output", `${chain.generator.outMW.toFixed(2)} MW`],
        ["Loss (heat)", `${chain.generator.lossMW.toFixed(2)} MW`],
      ];
    case "converter":
      return [
        ["Output", `${chain.converter.outMW.toFixed(2)} MW`],
        ["Loss", `${chain.converter.lossMW.toFixed(2)} MW`],
        ["Grid side", `${CONVERTER_GRID_KV} kV · 50 Hz (MV converter)`],
      ];
    case "transformer":
      return [
        ["Output (66 kV)", `${chain.transformer.outMW.toFixed(2)} MW`],
        ["Loss", `${chain.transformer.lossMW.toFixed(3)} MW`],
      ];
    case "yaw":
      return [
        ["Nacelle heading", `${t.nacellePositionDeg.toFixed(0)}°`],
        ["Rotor thrust", `${thrustMN.toFixed(2)} MN`],
      ];
    case "tower":
      return [
        ["Rotor thrust", `${thrustMN.toFixed(2)} MN`],
        ["Base moment (thrust)", `${(thrustMN * 124).toFixed(0)} MN·m`],
      ];
    case "foundation":
      return [
        ["Water depth", "≈ 40 m"],
        ["Mudline moment (thrust)", `${(thrustMN * 190).toFixed(0)} MN·m`],
      ];
    default:
      return [
        ["Power", `${t.powerOutputMW.toFixed(2)} MW`],
        ["Wind (hub)", `${v.toFixed(1)} m/s`],
      ];
  }
}

const TOUR_STEP_MS = 11_000;

/** Read a part's plain-language explanation aloud (en-GB), if supported. */
function speak(text: string) {
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-GB";
    u.rate = 1.02;
    synth.speak(u);
  } catch {
    // no speech synthesis (tests, some browsers): the tour still runs silently
  }
}

export function PartRail({
  selected,
  onSelect,
}: {
  selected: TurbinePartId | null;
  onSelect: (id: TurbinePartId) => void;
}) {
  // Guided tour: fly through the components wind → sea bed, narrating each
  const [touring, setTouring] = useState(false);
  useEffect(() => {
    if (!touring) return;
    let i = 0;
    const step = () => {
      const part = PART_RAIL[i % PART_RAIL.length];
      onSelect(part.id);
      speak(`${PART_EDUCATION_MAP[part.id]?.title ?? part.label}. ${PART_EDUCATION_MAP[part.id]?.simpleExplanation ?? ""}`);
      i++;
    };
    step();
    const id = setInterval(step, TOUR_STEP_MS);
    return () => {
      clearInterval(id);
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* no speech synthesis */
      }
    };
  }, [touring, onSelect]);

  return (
    <div className="pointer-events-auto flex flex-wrap justify-center gap-1">
      <button
        type="button"
        onClick={() => setTouring((v) => !v)}
        className="flex items-center gap-1 rounded-md border border-accent bg-accent px-2.5 py-1 text-[12px] font-bold text-accent-ink hover:opacity-90"
        title="Camera flies through every component with a spoken explanation"
      >
        {touring ? <Pause size={13} /> : <Play size={13} />} {touring ? "Stop tour" : "Guided tour"}
      </button>
      {PART_RAIL.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => {
            setTouring(false);
            onSelect(p.id);
          }}
          className={
            "rounded-md border px-2.5 py-1 text-[12px] font-semibold transition-colors " +
            (selected === p.id
              ? "border-accent bg-accent text-accent-ink"
              : "border-border-primary bg-bg-secondary/90 text-text-primary hover:bg-bg-hover")
          }
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

export function PartInfoCard({
  part,
  turbine,
  onClose,
}: {
  part: TurbinePartId;
  turbine: TurbineData;
  onClose: () => void;
}) {
  const edu = PART_EDUCATION_MAP[part];
  if (!edu) return null;
  const facts = liveFacts(part, turbine);
  return (
    <div className="pointer-events-auto flex max-h-full w-[380px] max-w-full flex-col overflow-hidden rounded-lg border border-border-primary bg-bg-primary/95 shadow-xl shadow-black/40 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-2 border-b border-border-primary px-4 py-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-text-muted">SB-510 turbine (IEA 15 MW) · component</div>
          <h3 className="text-lg font-bold leading-tight text-text-primary">{edu.title}</h3>
        </div>
        <button type="button" onClick={onClose} aria-label="Close part info" className="rounded p-1 text-text-muted hover:bg-bg-hover">
          <X size={16} />
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 text-[13px] leading-relaxed text-text-secondary">
        <p>{edu.overview}</p>

        <div className="grid grid-cols-2 gap-1.5">
          {facts.map(([k, val]) => (
            <div key={k} className="rounded border border-border-primary bg-bg-secondary px-2 py-1.5">
              <div className="text-xs font-semibold text-text-muted">{k}</div>
              <div className="font-mono text-[15px] font-bold tabular-nums text-text-primary">{val}</div>
            </div>
          ))}
        </div>

        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-text-muted">SB-510 design (IEA 15 MW)</div>
          <div className="font-semibold text-text-primary">{edu.design.v236Value}</div>
          <p className="mt-1">{edu.design.reasoning}</p>
        </div>

        {edu.formulas.slice(0, 2).map((f) => (
          <FormulaPaper key={f.expression} formula={{ ...f, variables: [] }} compact />
        ))}

        {edu.efficiencyNotes.length > 0 && (
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-text-muted">Losses</div>
            <ul className="mt-1 space-y-0.5">
              {edu.efficiencyNotes.map((n) => (
                <li key={n.name}>
                  <b className="text-text-primary">{n.name}</b> {n.typicalLossPct} — {n.dissipation}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-1">
          {edu.standards.map((s) => (
            <span key={s} translate="no" className="rounded border border-border-primary px-1.5 py-0.5 font-mono text-xs font-semibold">
              {s}
            </span>
          ))}
        </div>
        {edu.faultTypes.length > 0 && (
          <div className="text-[12px]">
            <b className="text-text-primary">Related SCADA faults:</b>{" "}
            {edu.faultTypes.map((f) => f.replace(/_/g, " ").toLowerCase()).join(" · ")}
          </div>
        )}
      </div>
    </div>
  );
}
