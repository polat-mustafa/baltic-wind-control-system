/**
 * First energisation, played as a sequence: the grid back-energises the
 * plant from the 400 kV point of connection, bay by bay, the same order as
 * the P5 switching programme (onshore transformer → export cable with its
 * shunt reactor → OSS 220 kV busbar and STATCOM → OSS transformer → 66 kV
 * busbar → string feeders → turbines synchronise and ramp up).
 *
 * Shown when an own project's commissioning is marked complete, and on
 * demand ("Replay energisation") for the SB-510 reference. Ratings come
 * from the live fleet's network design (lib/fleet → backend P2 design).
 */

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useReducedMotion } from "framer-motion";
import { Zap, X } from "lucide-react";

import { useFleet, type Fleet } from "../../lib/fleet";
import { useLandingStore } from "../../store/landingStore";
import { Button } from "../ui/Button";

const STEP_MS = 2600;
const STRING_MS = 900;

interface Stage {
  id: string;
  label: string;
  sub: string;
  /** What happens electrically when this bay closes. */
  say: string;
}

function stages(f: Fleet): Stage[] {
  const n = f.net;
  const perCircuitQ = n.cable_q_mvar / Math.max(1, n.num_export_cables);
  return [
    {
      id: "grid",
      label: `${f.grid?.name ?? "Grid"} ${n.grid_voltage_kv} kV`,
      sub: "point of connection",
      say: "The TSO grants the energisation notification (EON): the 400 kV bay at the point of connection is live.",
    },
    {
      id: "onshore",
      label: `${n.num_onshore_transformers} × ${n.onshore_trafo_mva} MVA`,
      sub: `${n.grid_voltage_kv}/${n.export_voltage_kv} kV onshore`,
      say: "Close the 400 kV breaker: the onshore transformer magnetises (inrush current, a few cycles) and its 220 kV side goes live.",
    },
    {
      id: "export",
      label: `${n.export_length_km.toFixed(0)} km export cable`,
      sub: `${n.export_voltage_kv} kV · circuit 1 + reactor`,
      say: `Energise circuit 1 from the shore: the cable charges like a capacitor (Q = ωCV²L ≈ ${perCircuitQ.toFixed(0)} MVAr), so its shunt reactor is switched in with it.`,
    },
    {
      id: "oss220",
      label: `OSS ${n.export_voltage_kv} kV busbar`,
      sub: `STATCOM ±${n.statcom_rating_mvar} MVAr`,
      say: "The offshore 220 kV busbar is live; the second reactor and the STATCOM hold its voltage within ±5 %.",
    },
    {
      id: "oss66",
      label: `${n.num_oss_transformers} × ${n.oss_trafo_mva} MVA`,
      sub: `${n.export_voltage_kv}/${n.array_voltage_kv} kV offshore`,
      say: "Close the transformer breaker: the offshore transformer magnetises and the 66 kV switchgear sees voltage.",
    },
    {
      id: "bus66",
      label: `${n.array_voltage_kv} kV busbar`,
      sub: `${f.strings.length} string feeders`,
      say: "The 66 kV busbar is live. Each string feeder is closed one at a time, checking voltage and protection between them.",
    },
  ];
}

export default function EnergisationOverlay() {
  const startedAt = useLandingStore((s) => s.energisationAt);
  const close = useLandingStore((s) => s.closeEnergisation);
  if (startedAt == null) return null;
  return createPortal(<Sequence key={startedAt} onClose={close} />, document.body);
}

function Sequence({ onClose }: { onClose: () => void }) {
  const fleet = useFleet();
  const reduced = useReducedMotion() ?? false;
  const chain = useMemo(() => stages(fleet), [fleet]);
  const total = chain.length * STEP_MS + fleet.strings.length * STRING_MS + 1500;
  const [t, setT] = useState(reduced ? total : 0);

  useEffect(() => {
    if (reduced) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const dt = Math.max(0, now - t0); // rAF's frame time can precede t0 on the first tick
      setT(Math.min(total, dt));
      if (dt < total) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced, total]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const lit = Math.min(chain.length, Math.floor(t / STEP_MS) + 1); // stages live so far
  const chainDone = t >= chain.length * STEP_MS;
  const stringsLit = chainDone ? Math.min(fleet.strings.length, Math.floor((t - chain.length * STEP_MS) / STRING_MS) + 1) : 0;
  const done = t >= total;
  const now = chainDone
    ? done
      ? `Farm energised: ${fleet.turbines.length} turbines synchronised, ramping to ${fleet.net.total_capacity_mw.toFixed(0)} MW within the TSO's ramp limit.`
      : `String ${stringsLit} feeder closed: its turbines see 66 kV, their converters synchronise to the grid and start exporting.`
    : chain[lit - 1].say;

  const W = 1000;
  const nodeW = 150;
  const gap = (W - 20 - nodeW * chain.length) / (chain.length - 1);
  const x = (i: number) => 10 + i * (nodeW + gap);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/80 p-3" style={{ zIndex: 9000 }} role="dialog" aria-modal="true" aria-label="Energisation sequence">
      <div className="w-full max-w-5xl rounded-xl border border-border-primary bg-bg-secondary p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary">
              <Zap size={18} className="text-status-warning" aria-hidden /> {done ? "Farm energised" : "Energising the farm…"}
            </h2>
            <p className="text-[12px] text-text-muted">First energisation from the grid, in the order of the P5 switching programme (circuit 1).</p>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose} aria-label={done ? "Close" : "Skip"}>
            {done ? <X size={14} /> : "Skip"}
          </Button>
        </div>

        <svg viewBox={`0 0 ${W} 300`} className="mt-4 w-full" role="img" aria-label="Single-line energisation sequence">
          <defs>
            <linearGradient id="energy" x1="0" x2="1">
              <stop offset="0" stopColor="#f59e0b" />
              <stop offset="1" stopColor="#22c55e" />
            </linearGradient>
          </defs>
          {/* busbar links between the stages */}
          {chain.slice(1).map((_, i) => {
            const live = i + 1 < lit;
            return (
              <line
                key={i}
                x1={x(i) + nodeW}
                x2={x(i + 1)}
                y1={70}
                y2={70}
                stroke={live ? "url(#energy)" : "#4b5563"}
                strokeWidth={live ? 4 : 2}
                strokeDasharray={live ? "10 8" : "4 6"}
              >
                {live && !reduced && <animate attributeName="stroke-dashoffset" from="36" to="0" dur="0.8s" repeatCount="indefinite" />}
              </line>
            );
          })}
          {chain.map((s, i) => {
            const live = i < lit;
            const active = i === lit - 1 && !chainDone;
            return (
              <g key={s.id} transform={`translate(${x(i)} 40)`}>
                <rect
                  width={nodeW}
                  height={60}
                  rx={8}
                  fill={live ? "rgba(34,197,94,0.12)" : "rgba(75,85,99,0.15)"}
                  stroke={live ? "#22c55e" : "#4b5563"}
                  strokeWidth={active ? 3 : 1.5}
                >
                  {active && !reduced && <animate attributeName="stroke-opacity" values="1;0.3;1" dur="1s" repeatCount="indefinite" />}
                </rect>
                <text x={nodeW / 2} y={25} textAnchor="middle" fontSize={11} fontWeight={700} fill="currentColor" className="text-text-primary">
                  {s.label}
                </text>
                <text x={nodeW / 2} y={44} textAnchor="middle" fontSize={9} fill="currentColor" className="text-text-muted">
                  {s.sub}
                </text>
              </g>
            );
          })}
          {/* strings and turbines below the 66 kV busbar */}
          {fleet.strings.map((ids, si) => {
            const sx = 40 + (si * (W - 80)) / Math.max(1, fleet.strings.length - 1 || 1);
            const live = si < stringsLit;
            return (
              <g key={si}>
                <line x1={x(chain.length - 1) + nodeW / 2} y1={100} x2={sx} y2={150} stroke={live ? "#22c55e" : "#4b5563"} strokeWidth={live ? 2.5 : 1} />
                <text x={sx} y={165} textAnchor="middle" fontSize={10} fill="currentColor" className="text-text-muted">
                  S{si + 1}
                </text>
                {ids.map((id, k) => (
                  <circle key={id} cx={sx} cy={180 + k * 15} r={5} fill={live ? "#22c55e" : "transparent"} stroke={live ? "#22c55e" : "#6b7280"}>
                    {live && !done && !reduced && <animate attributeName="opacity" values="0.4;1" dur="0.6s" begin={`${k * 0.12}s`} fill="freeze" />}
                  </circle>
                ))}
              </g>
            );
          })}
        </svg>

        <p role="status" aria-live="polite" className="mt-3 min-h-[2.5rem] rounded-md border border-border-primary bg-bg-tertiary px-3 py-2 text-[13px] text-text-primary">
          {now}
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded bg-bg-tertiary">
          <div className="h-full bg-status-normal transition-[width]" style={{ width: `${(100 * t) / total}%` }} />
        </div>
      </div>
    </div>
  );
}
