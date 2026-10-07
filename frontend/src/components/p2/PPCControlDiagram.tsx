/**
 * PPC control loop as a block diagram — the paths the selected modes use are
 * drawn with moving dashes (static with reduced motion), unused ones dimmed.
 *
 *   TSO ─► dispatch target ─► ramp limiter ─►(+)─► 34 WTG (P)
 *                     frequency response ─────┘
 *   TSO ─► Q / V / PF control ─────────────────────► WTG Q + STATCOM
 *   POC measurement (P, Q, V, f) ─► back into the PPC
 */

import { motion, useReducedMotion } from "framer-motion";

import type { PPCSimulationResponse } from "../../types/ppc";
import { useNetwork } from "../../store/gridStore";

const W = 940;
const H = 230;

function Box({ x, y, w, label, sub, active = true }: { x: number; y: number; w: number; label: string; sub?: string; active?: boolean }) {
  return (
    <g opacity={active ? 1 : 0.45}>
      <rect x={x} y={y} width={w} height={46} rx={6} fill="var(--color-bg-tertiary)" stroke="var(--color-border-secondary)" />
      <text x={x + w / 2} y={y + 20} textAnchor="middle" fontSize={12} fontWeight={600} className="fill-text-primary">
        {label}
      </text>
      {sub && (
        <text x={x + w / 2} y={y + 36} textAnchor="middle" fontSize={10.5} className="fill-text-muted" fontFamily="JetBrains Mono, monospace">
          {sub}
        </text>
      )}
    </g>
  );
}

function Wire({ d, active }: { d: string; active: boolean }) {
  const reduce = useReducedMotion();
  return (
    <g>
      <path d={d} fill="none" stroke="var(--color-border-secondary)" strokeWidth={2} opacity={active ? 1 : 0.4} />
      {active && (
        <motion.path
          d={d}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={2}
          strokeDasharray="5 11"
          initial={{ strokeDashoffset: 0 }}
          animate={reduce ? undefined : { strokeDashoffset: -32 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
        />
      )}
    </g>
  );
}

const MODE_LABEL: Record<string, string> = {
  power_reference: "P set-point",
  delta_control: "Delta reserve",
  absolute_limitation: "Absolute limit",
  ramp_rate_control: "Ramp control",
  voltage_control: "V control (slope)",
  reactive_power: "Q set-point",
  power_factor: "PF control",
  q_v_droop: "Q(V) droop",
};

export default function PPCControlDiagram({ sim }: { sim: PPCSimulationResponse }) {
  const n = useNetwork();
  const freqActive = Math.abs(sim.frequency_response_expected_mw) > 0.1 || Math.abs(sim.frequency_response_actual_mw) > 0.5;
  const last = sim.time_series[sim.time_series.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[640px] h-auto" role="img" aria-label="PPC control loop">
      {/* Active power path */}
      <Box x={10} y={20} w={110} label="TSO (PSE)" sub="IEC 60870-5-104" />
      <Box x={170} y={20} w={150} label={MODE_LABEL[sim.active_power_mode]} sub={`${sim.tso_power_setpoint_mw.toFixed(0)} MW target`} />
      <Box x={370} y={20} w={140} label="Ramp limiter" sub="plant setting" />
      <circle cx={560} cy={43} r={13} fill="var(--color-bg-tertiary)" stroke="var(--color-border-secondary)" />
      <text x={560} y={48} textAnchor="middle" fontSize={15} className="fill-text-primary">
        +
      </text>
      <Box x={610} y={20} w={150} label={`${n.num_turbines} × WTG  P`} sub={`${last.power_actual_mw.toFixed(0)} MW`} />
      <Box x={370} y={86} w={140} label="LFSM-O/U · FSM" sub={freqActive ? `${sim.frequency_response_actual_mw.toFixed(0)} MW` : "idle (50 Hz)"} active={freqActive} />
      <Wire d="M120 43 H170" active />
      <Wire d="M320 43 H370" active />
      <Wire d="M510 43 H547" active />
      <Wire d="M510 109 H560 V56" active={freqActive} />
      <Wire d="M573 43 H610" active />

      {/* Reactive path */}
      <Box x={170} y={160} w={150} label={MODE_LABEL[sim.reactive_power_mode]} sub={`Q ref ${last.q_setpoint_mvar.toFixed(0)} MVAR`} />
      <Box x={610} y={160} w={150} label="WTG Q + STATCOM" sub={`${last.q_actual_mvar.toFixed(0)} MVAR`} />
      <Wire d="M65 66 V183 H170" active />
      <Wire d="M320 183 H610" active />

      {/* POC and feedback */}
      <Box x={800} y={90} w={130} label="POC 400 kV" sub={`${last.voltage_pcc_pu.toFixed(3)} pu · ${last.frequency_hz.toFixed(2)} Hz`} />
      <Wire d="M760 43 H865 V90" active />
      <Wire d="M760 183 H865 V136" active />
      <path d="M800 113 H780 Q775 150 330 150 H245 V160" fill="none" stroke="var(--color-text-muted)" strokeWidth={1} strokeDasharray="3 4" />
      <text x={560} y={145} textAnchor="middle" fontSize={10.5} className="fill-text-muted">
        measured P, Q, V, f fed back to the PPC
      </text>
    </svg>
  );
}
