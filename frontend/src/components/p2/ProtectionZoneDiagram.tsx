/**
 * Protection zones on the single-line diagram, with the fault and the trip.
 *
 * The faulted zone is shaded, a bolt marks the fault, and the breakers the
 * main protection opens turn hollow at their clearance time (played back
 * 3× slower than real time; instant with reduced motion). Backup relays that
 * picked up but were not needed are listed with the time they would have used.
 */

import { motion, useReducedMotion } from "framer-motion";

import type { CoordinationStudyResponse } from "../../types/protection";

const W = 960;
const H = 220;
const Y = 100;
const X = { string: 40, feeder: 130, bus66: 210, incomer: 290, tx: 360, hv: 430, bus220: 500, c1: 560, c2: 840, onshore: 900 };
const CABLE = [600, 800] as const; // export cable drawn between these x

type Cb = "F" | "I" | "H" | "C1" | "C2";
const CB_X: Record<Cb, number> = { F: X.feeder, I: X.incomer, H: X.hv, C1: X.c1, C2: X.c2 };
const MAIN_CBS: Record<string, Cb[]> = {
  string_feeder: ["F"],
  oss_busbar_66kv: ["F", "I"],
  export_cable: ["C1", "C2"],
  oss_busbar_220kv: ["H", "C1"],
};
const ZONE: Record<string, [number, number]> = {
  string_feeder: [X.string - 20, X.feeder],
  oss_busbar_66kv: [X.feeder, X.incomer],
  export_cable: [X.c1, X.c2],
  oss_busbar_220kv: [X.hv, X.c1],
};
const PLAYBACK = 3;

function Breaker({ x, open, delayS, label }: { x: number; open: boolean; delayS: number; label: string }) {
  const reduce = useReducedMotion();
  return (
    <g>
      <motion.rect
        x={x - 9}
        y={Y - 9}
        width={18}
        height={18}
        rx={2}
        stroke="var(--color-text-primary)"
        strokeWidth={2}
        initial={{ fill: "var(--color-text-primary)" }}
        animate={{ fill: open ? "var(--color-bg-secondary)" : "var(--color-text-primary)" }}
        transition={{ delay: reduce ? 0 : delayS, duration: 0.15 }}
      />
      <text x={x} y={Y - 16} textAnchor="middle" fontSize={10} className="fill-text-muted">
        {label}
      </text>
    </g>
  );
}

export default function ProtectionZoneDiagram({ study }: { study: CoordinationStudyResponse }) {
  const loc = study.fault_location;
  const main = study.relay_sequence.find((e) => e.relay_id === study.main_relay);
  const openAt = ((main?.clearance_time_ms ?? 0) / 1000) * PLAYBACK;
  const opened = new Set(MAIN_CBS[loc]);
  const faultX =
    loc === "string_feeder"
      ? (X.string + X.feeder) / 2
      : loc === "oss_busbar_66kv"
        ? X.bus66
        : loc === "oss_busbar_220kv"
          ? X.bus220
          : // position 0 % = onshore end (right), 100 % = OSS end (left)
            CABLE[1] - ((study.position_pct ?? 50) / 100) * (CABLE[1] - CABLE[0]);
  const [z0, z1] = ZONE[loc];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[640px] h-auto" role="img" aria-label={`Protection zones, ${study.fault_current_description}`}>
      {/* faulted zone */}
      <motion.rect
        key={`${loc}-${study.position_pct}`}
        x={z0}
        y={Y - 46}
        width={z1 - z0}
        height={92}
        rx={8}
        fill="var(--color-accent)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.12 }}
        transition={{ duration: 0.4 }}
      />
      {/* conductors */}
      <path
        d={`M${X.string} ${Y} H${X.tx - 22} M${X.tx + 22} ${Y} H${CABLE[0]} M${CABLE[1]} ${Y} H${X.onshore}`}
        stroke="var(--color-border-secondary)"
        strokeWidth={3}
        fill="none"
      />
      <path d={`M${CABLE[0]} ${Y} H${CABLE[1]}`} stroke="var(--color-border-secondary)" strokeWidth={3} strokeDasharray="10 5" fill="none" />
      <text x={(CABLE[0] + CABLE[1]) / 2} y={Y + 26} textAnchor="middle" fontSize={11} className="fill-text-secondary">
        export cable 2 × 108 km · 220 kV · 87L + distance Z1 80 % / Z2 120 %
      </text>
      {/* transformer */}
      <circle cx={X.tx - 8} cy={Y} r={14} fill="none" stroke="var(--color-text-primary)" strokeWidth={2} />
      <circle cx={X.tx + 8} cy={Y} r={14} fill="none" stroke="var(--color-text-primary)" strokeWidth={2} />
      {/* busbars */}
      {[
        [X.bus66, "OSS 66 kV", "87B"],
        [X.bus220, "OSS 220 kV", "87B"],
        [X.onshore, "Onshore 220 kV", "→ PSE"],
      ].map(([x, l, sub]) => (
        <g key={String(l)}>
          <line x1={Number(x)} x2={Number(x)} y1={Y - 30} y2={Y + 30} stroke="var(--color-text-primary)" strokeWidth={5} />
          <text x={Number(x)} y={Y + 46} textAnchor="middle" fontSize={11} fontWeight={600} className="fill-text-primary">
            {l}
          </text>
          <text x={Number(x)} y={Y + 60} textAnchor="middle" fontSize={10} className="fill-text-muted">
            {sub}
          </text>
        </g>
      ))}
      <text x={X.string} y={Y + 46} textAnchor="middle" fontSize={11} fontWeight={600} className="fill-text-primary">
        String
      </text>
      <text x={X.string} y={Y + 60} textAnchor="middle" fontSize={10} className="fill-text-muted">
        6 × WTG
      </text>
      {/* breakers — remount per study so the trip replays */}
      <g key={study.study_id}>
      <Breaker x={CB_X.F} open={opened.has("F")} delayS={openAt} label="PTOC-01" />
      <Breaker x={CB_X.I} open={opened.has("I")} delayS={openAt} label="PTOC-02" />
      <Breaker x={CB_X.H} open={opened.has("H")} delayS={openAt} label="TX HV" />
      <Breaker x={CB_X.C1} open={opened.has("C1")} delayS={openAt} label="87L" />
      <Breaker x={CB_X.C2} open={opened.has("C2")} delayS={openAt} label="87L · 21" />
      </g>
      {/* fault */}
      <motion.path
        key={`bolt-${loc}-${study.position_pct}`}
        d={`M${faultX + 4} ${Y - 40} l-10 18 h8 l-8 20 l16 -24 h-8 l8 -14 z`}
        fill="var(--color-status-alarm)"
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.25 }}
        style={{ transformOrigin: `${faultX}px ${Y - 20}px` }}
      />
      <text x={faultX} y={Y - 48} textAnchor="middle" fontSize={11} fontWeight={600} className="fill-text-primary">
        {study.fault_current_ka.toFixed(1)} kA
      </text>
      <text x={W / 2} y={H - 8} textAnchor="middle" fontSize={11} className="fill-text-muted">
        Hollow breaker = opened by {study.main_relay} at {main?.clearance_time_ms.toFixed(0)} ms (played back {PLAYBACK}× slower)
      </text>
    </svg>
  );
}
