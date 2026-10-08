/**
 * Single-line diagram of circuit 1 — IEC 60617 symbols, ISA-101 colours.
 * Ratings, cable length and the strings of section A come from the
 * programme's farm (SB-510 or the learner's design).
 *
 * Colours come from the backend's zone analysis, not from local guesses:
 * a conductor is drawn in its voltage colour when live, magenta when earthed
 * and grey when isolated. Devices: breaker = square (filled = closed),
 * disconnector / earth switch = blade (closed = in line), a padlock marks an
 * isolation lock, the dashed frame marks the device of the current step.
 * Devices are operated only through the programme (interlocked); clicking
 * one shows its details.
 */

import { useState } from "react";

import { SCADA_COLORS } from "../../constants/scadaColors";
import type { EquipmentState, ProgrammeDetail, ZoneStatus } from "../../types/commissioning";
import { EXPORT_CABLE } from "../../utils/landingPhysics";

const V220 = SCADA_COLORS.VOLTAGE_220KV;
const V66 = SCADA_COLORS.VOLTAGE_66KV;
const EARTH = SCADA_COLORS.EARTHED;
const DEAD = SCADA_COLORS.DE_ENERGIZED;
const LOCK = SCADA_COLORS.WARNING;

const ZONE_KV: Record<string, number> = { "66A": 66, "66B": 66 };
const zoneKv = (z: string) => ZONE_KV[z] ?? (z.startsWith("STR") ? 66 : 220);

interface Ctx {
  zones: Record<string, ZoneStatus>;
  eq: Record<string, EquipmentState>;
  focus: string;
  selected: string | null;
  select: (id: string) => void;
}

function zoneColor(ctx: Ctx, zone: string, kv = zoneKv(zone)): string {
  const s = ctx.zones[zone];
  return s === "live" ? (kv === 66 ? V66 : V220) : s === "earthed" ? EARTH : DEAD;
}

/** Colour of a device: the "strongest" of its zones (live > earthed > dead). */
function deviceColor(ctx: Ctx, id: string): string {
  const zones = ctx.eq[id]?.zones ?? [];
  const live = zones.find((z) => ctx.zones[z] === "live");
  if (live) return zoneColor(ctx, live);
  return zones.some((z) => ctx.zones[z] === "earthed") ? EARTH : DEAD;
}

function W({ x1, y1, x2, y2, c, w = 2 }: { x1: number; y1: number; x2: number; y2: number; c: string; w?: number }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={c} strokeWidth={w} />;
}

function Bus({ x1, x2, y, c, label }: { x1: number; x2: number; y: number; c: string; label: string }) {
  return (
    <g>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={c} strokeWidth={6} strokeLinecap="square" />
      <text x={x1} y={y - 10} fontSize={13} fontWeight={600} className="fill-text-secondary">
        {label}
      </text>
    </g>
  );
}

function Padlock({ x, y }: { x: number; y: number }) {
  return (
    <g aria-hidden>
      <path d={`M${x - 3.5} ${y - 1} v-3 a3.5 3.5 0 0 1 7 0 v3`} fill="none" stroke={LOCK} strokeWidth={1.6} />
      <rect x={x - 5} y={y - 1} width={10} height={8} rx={1.5} fill={LOCK} />
    </g>
  );
}

/** Wrapper: selection, focus frame, lock badge, label and tooltip. */
function Device({ ctx, id, x, y, label, labelSide = "right", children }: {
  ctx: Ctx; id: string; x: number; y: number; label?: string; labelSide?: "right" | "left" | "below";
  children: React.ReactNode;
}) {
  const e = ctx.eq[id];
  if (!e) return null;
  const isFocus = ctx.focus === id;
  const lx = labelSide === "right" ? x + 16 : labelSide === "left" ? x - 16 : x;
  const ly = labelSide === "below" ? y + 26 : y + 4;
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${id} ${e.state}${e.locked ? ", locked" : ""}`}
      className="cursor-pointer focus:outline-none"
      onClick={() => ctx.select(id)}
      onKeyDown={(ev) => ev.key === "Enter" && ctx.select(id)}
    >
      <title>{`${id} — ${e.location}\n${e.state.toUpperCase()}${e.locked ? " · isolation lock applied" : ""}`}</title>
      {(isFocus || ctx.selected === id) && (
        <rect
          x={x - 15} y={y - 15} width={30} height={30} rx={3} fill="none"
          stroke={isFocus ? "var(--color-accent)" : "var(--color-text-muted)"}
          strokeWidth={2} strokeDasharray="4 2" className={isFocus ? "animate-pulse" : undefined}
        />
      )}
      {children}
      {e.locked && <Padlock x={x + 13} y={y - 13} />}
      <text
        x={lx} y={ly} fontSize={12} fontFamily="monospace"
        textAnchor={labelSide === "right" ? "start" : labelSide === "left" ? "end" : "middle"}
        className={isFocus ? "fill-text-primary" : "fill-text-muted"}
      >
        {label ?? id}
      </text>
    </g>
  );
}

/** Circuit breaker (IEC 60617-07-13-05), vertical. */
function CB({ ctx, id, x, y, labelSide, label }: {
  ctx: Ctx; id: string; x: number; y: number; labelSide?: "right" | "left" | "below"; label?: string;
}) {
  const closed = ctx.eq[id]?.state === "closed";
  const c = deviceColor(ctx, id);
  return (
    <Device ctx={ctx} id={id} x={x} y={y} labelSide={labelSide} label={label}>
      <rect x={x - 9} y={y - 9} width={18} height={18} rx={1.5}
        fill={closed ? c : "var(--color-bg-secondary)"} stroke={c} strokeWidth={2} />
    </Device>
  );
}

/** Disconnector (IEC 60617-07-13-06), vertical: blade in line when closed. */
function DS({ ctx, id, x, y }: { ctx: Ctx; id: string; x: number; y: number }) {
  const closed = ctx.eq[id]?.state === "closed";
  const c = deviceColor(ctx, id);
  return (
    <Device ctx={ctx} id={id} x={x} y={y}>
      <line x1={x - 6} y1={y - 10} x2={x + 6} y2={y - 10} stroke={c} strokeWidth={2} />
      <line x1={x} y1={y + 10} x2={closed ? x : x + 9} y2={closed ? y - 10 : y - 7} stroke={c} strokeWidth={2.5} />
      <circle cx={x} cy={y + 10} r={2} fill={c} />
    </Device>
  );
}

/** Earth switch to the right of conductor point (x, y): blade + earth symbol. */
function ES({ ctx, id, x, y, dir = 1, labelBelow = false, label }: {
  ctx: Ctx; id: string; x: number; y: number; dir?: 1 | -1; labelBelow?: boolean; label?: string;
}) {
  const e = ctx.eq[id];
  if (!e) return null;
  const closed = e.state === "closed";
  const c = closed ? EARTH : deviceColor(ctx, id);
  const sx = x + dir * 34; // switch position
  return (
    <g>
      <W x1={x} y1={y} x2={sx} y2={y} c={zoneColor(ctx, e.zones[0])} w={1.5} />
      <Device ctx={ctx} id={id} x={sx} y={y + 14} labelSide={labelBelow ? "below" : dir === 1 ? "right" : "left"} label={label}>
        <line x1={sx} y1={y} x2={closed ? sx : sx + dir * 9} y2={closed ? y + 18 : y + 15} stroke={c} strokeWidth={2.5} />
        <line x1={sx} y1={y + 20} x2={sx} y2={y + 24} stroke={c} strokeWidth={1.5} />
        <line x1={sx - 8} y1={y + 24} x2={sx + 8} y2={y + 24} stroke={c} strokeWidth={2} />
        <line x1={sx - 5} y1={y + 28} x2={sx + 5} y2={y + 28} stroke={c} strokeWidth={2} />
        <line x1={sx - 2} y1={y + 32} x2={sx + 2} y2={y + 32} stroke={c} strokeWidth={2} />
      </Device>
    </g>
  );
}

/** Two-winding transformer (IEC 60617-06-09-01); ``left`` puts the name on the left, without the rating. */
function Transformer({ ctx, x, y, zone, label, mva, left = false }: {
  ctx: Ctx; x: number; y: number; zone: string; label: string; mva: number; left?: boolean;
}) {
  return (
    <g>
      <circle cx={x} cy={y - 11} r={15} fill="none" stroke={zoneColor(ctx, zone, 220)} strokeWidth={2} />
      <circle cx={x} cy={y + 11} r={15} fill="none" stroke={zoneColor(ctx, zone, 66)} strokeWidth={2} />
      <text x={left ? x - 24 : x + 24} y={y - 2} textAnchor={left ? "end" : "start"} fontSize={13} fontWeight={600} className="fill-text-primary">{label}</text>
      {!left && <text x={x + 24} y={y + 13} fontSize={11} fontFamily="monospace" className="fill-text-muted">220/66 kV · {mva} MVA</text>}
    </g>
  );
}

function Reactor({ ctx, x, y, mvar, zone = "SR1", label = "OSS reactor 1", anchor = "middle" }: {
  ctx: Ctx; x: number; y: number; mvar: number; zone?: string; label?: string; anchor?: "middle" | "start";
}) {
  const c = zoneColor(ctx, zone);
  return (
    <g>
      <path d={`M${x} ${y - 18} q 12 6 0 12 q 12 6 0 12 q 12 6 0 12`} fill="none" stroke={c} strokeWidth={2} />
      <W x1={x} y1={y + 18} x2={x} y2={y + 26} c={c} />
      <line x1={x - 8} y1={y + 26} x2={x + 8} y2={y + 26} stroke={c} strokeWidth={2} />
      <text x={anchor === "start" ? x - 30 : x} y={y + 44} textAnchor={anchor} fontSize={12} className="fill-text-secondary">{label} · {mvar} Mvar</text>
    </g>
  );
}

function Statcom({ ctx, x, y, mvar }: { ctx: Ctx; x: number; y: number; mvar: number }) {
  const c = zoneColor(ctx, "STC");
  return (
    <g>
      <rect x={x - 16} y={y - 16} width={32} height={32} rx={2} fill="none" stroke={c} strokeWidth={2} />
      <line x1={x - 16} y1={y + 16} x2={x + 16} y2={y - 16} stroke={c} strokeWidth={1.2} />
      <text x={x - 9} y={y - 3} fontSize={10} fill={c}>~</text>
      <text x={x + 3} y={y + 11} fontSize={10} fill={c}>=</text>
      <text x={x} y={y + 36} textAnchor="middle" fontSize={12} className="fill-text-secondary">STATCOM ±{mvar} Mvar</text>
    </g>
  );
}

function Generator({ ctx, x, y, zone }: { ctx: Ctx; x: number; y: number; zone: string }) {
  const c = zoneColor(ctx, zone);
  return (
    <g>
      <circle cx={x} cy={y} r={13} fill="none" stroke={c} strokeWidth={2} />
      <text x={x} y={y + 4} textAnchor="middle" fontSize={12} fontWeight={600} fill={c}>G</text>
    </g>
  );
}

export default function CircuitSLD({ programme }: { programme: ProgrammeDetail }) {
  const [selected, setSelected] = useState<string | null>(null);
  const eq = Object.fromEntries(programme.equipment_states.map((e) => [e.equipment_id, e]));
  const current = programme.steps[programme.current_step_index];
  const ctx: Ctx = {
    zones: programme.network.zones,
    eq,
    focus: programme.status === "in_progress" || programme.status === "hold" ? current?.equipment_id ?? "" : "",
    selected,
    select: (id) => setSelected((s) => (s === id ? null : id)),
  };
  const zc = (z: string, kv?: number) => zoneColor(ctx, z, kv);
  const bus = (zone: string) => programme.network.buses.find((b) => b.zone === zone);
  const vLabel = (zone: string) => {
    const b = bus(zone);
    return b ? `${b.kv.toFixed(1)} kV · ${b.vm_pu.toFixed(3)} pu` : programme.network.zones[zone] ?? "";
  };
  const net = programme.network;
  const farm = programme.farm;
  const sel = selected ? eq[selected] : null;
  const pad = (n: number) => String(n).padStart(2, "0");
  const strA = farm.string_layout.slice(0, farm.section_a_strings).map((wtg, i) => ({ n: i + 1, wtg, x: 470 + i * 95 }));
  // more than 3 strings on section A: TX-OSS-02 and section B move right
  const dx = Math.max(0, strA.length - 3) * 95;
  const nB = farm.string_layout.length - strA.length;
  const stringsB = nB === 0 ? "no strings" : nB === 1 ? `string ${strA.length + 1}:` : `strings ${strA.length + 1}–${farm.string_layout.length}:`;

  return (
    <div className="flex flex-col">
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${860 + dx} 720`} className="w-full min-w-[680px]" role="img" aria-label="Circuit 1 single-line diagram">
          {/* ── Onshore ── */}
          <Bus x1={60} x2={240} y={40} c={zc("ONS220")} label="Onshore 220 kV" />
          <text x={250} y={44} fontSize={12} fontFamily="monospace" className="fill-text-secondary">{vLabel("ONS220")}</text>
          <text x={166} y={64} fontSize={11} className="fill-text-muted">fed from PSE 400 kV via TX-ONS-01/02</text>
          <W x1={150} y1={40} x2={150} y2={72} c={zc("ONS220")} />
          <DS ctx={ctx} id="DS-ON-220-01" x={150} y={82} />
          <W x1={150} y1={92} x2={150} y2={119} c={zc("ONS-E1")} />
          <CB ctx={ctx} id="CB-ON-220-01" x={150} y={128} />
          <W x1={150} y1={137} x2={150} y2={172} c={zc("CABLE1")} />
          <ES ctx={ctx} id="ES-ON-220-01" x={150} y={172} dir={-1} />

          {/* Onshore line reactor 1: cable side of CB-ON-220-01, energised with the cable */}
          {eq["CB-SR-ON-01"] && farm.reactor_unit_mvar != null && (
            <g>
              <W x1={150} y1={150} x2={60} y2={150} c={zc("CABLE1")} />
              <W x1={60} y1={150} x2={60} y2={170} c={zc("CABLE1")} />
              <CB ctx={ctx} id="CB-SR-ON-01" x={60} y={179} labelSide="right" />
              <W x1={60} y1={188} x2={60} y2={232} c={zc("SRON1")} />
              <ES ctx={ctx} id="ES-SR-ON-01" x={60} y={200} />
              <Reactor ctx={ctx} x={60} y={250} mvar={farm.reactor_unit_mvar} zone="SRON1" label="Line reactor 1" anchor="start" />
              {net.reactor_on_q_mvar != null && (
                <text x={30} y={310} fontSize={12} fontFamily="monospace" className="fill-text-secondary">
                  Q {net.reactor_on_q_mvar.toFixed(1)} Mvar
                </text>
              )}
            </g>
          )}

          {/* ── Export cable 1 ── */}
          <W x1={150} y1={172} x2={580} y2={172} c={zc("CABLE1")} w={3.5} />
          {[290, 470].map((cx) => (
            <ellipse key={cx} cx={cx} cy={172} rx={4} ry={9} fill="var(--color-bg-secondary)" stroke={zc("CABLE1")} strokeWidth={1.5} />
          ))}
          <text x={380} y={158} textAnchor="middle" fontSize={14} fontWeight={600} className="fill-text-primary">
            Export cable 1 · {farm.export_length_km} km · 1000 mm² Cu XLPE
          </text>
          <text x={380} y={194} textAnchor="middle" fontSize={12} fontFamily="monospace" className="fill-text-secondary">
            {net.cable_i_send_a != null
              ? `sending end ${net.cable_i_send_a.toFixed(0)} A · ${net.cable_loading_pct?.toFixed(0)} % of ${EXPORT_CABLE.ratedA} A`
              : net.zones.CABLE1}
          </text>
          {net.zones.CABLE1 === "live" && net.zones.OSS220 !== "live" && (
            <text x={380} y={212} textAnchor="middle" fontSize={12} fontFamily="monospace" className="fill-text-secondary">
              open end {vLabel("CABLE1")}
            </text>
          )}

          {/* ── OSS export bay ── */}
          <ES ctx={ctx} id="ES-OSS-220-01" x={580} y={172} />
          <W x1={580} y1={172} x2={580} y2={203} c={zc("CABLE1")} />
          <CB ctx={ctx} id="CB-OSS-220-01" x={580} y={212} labelSide="left" />
          <W x1={580} y1={221} x2={580} y2={242} c={zc("OSS-E1")} />
          <DS ctx={ctx} id="DS-OSS-220-01" x={580} y={252} />
          <W x1={580} y1={262} x2={580} y2={292} c={zc("OSS220")} />

          {/* ── OSS 220 kV busbar ── */}
          <Bus x1={180} x2={850 + dx} y={292} c={zc("OSS220")} label="OSS 220 kV" />
          {net.zones.OSS220 === "live" && (
            <text x={290} y={283} fontSize={12} fontFamily="monospace" className="fill-text-secondary">{vLabel("OSS220")}</text>
          )}
          <W x1={190} y1={292} x2={190} y2={312} c={zc("OSS220")} />
          <ES ctx={ctx} id="ES-OSS-220-BB" x={190} y={312} dir={-1} />

          {/* Reactor and STATCOM bays */}
          {([["CB-SR-01", "ES-SR-01", "SR1", 255], ["CB-STC-01", "ES-STC-01", "STC", 380]] as const).filter(([cb]) => eq[cb]).map(([cb, es, z, x]) => (
            <g key={cb}>
              <W x1={x} y1={292} x2={x} y2={326} c={zc("OSS220")} />
              <CB ctx={ctx} id={cb} x={x} y={335} labelSide="left" />
              <W x1={x} y1={344} x2={x} y2={402} c={zc(z)} />
              <ES ctx={ctx} id={es} x={x} y={356} />
            </g>
          ))}
          {farm.reactor_unit_mvar != null && <Reactor ctx={ctx} x={255} y={420} mvar={farm.reactor_unit_mvar} />}
          <Statcom ctx={ctx} x={380} y={420} mvar={farm.statcom_mvar} />
          {net.reactor_q_mvar != null && (
            <text x={255} y={480} textAnchor="middle" fontSize={12} fontFamily="monospace" className="fill-text-secondary">
              Q {net.reactor_q_mvar.toFixed(1)} Mvar
            </text>
          )}
          {net.statcom_q_mvar != null && (
            <text x={380} y={472} textAnchor="middle" fontSize={12} fontFamily="monospace" className="fill-text-secondary">
              Q {net.statcom_q_mvar >= 0 ? "+" : "−"}{Math.abs(net.statcom_q_mvar).toFixed(1)} Mvar
            </text>
          )}

          {/* Transformer bays */}
          {([
            ["CB-TX-OSS-HV", "ES-TX-OSS-01", "TX1", "CB-TX-OSS-LV", 510, "TX-OSS-01", "66A"],
            ["CB-TX-OSS-02-HV", "ES-TX-OSS-02", "TX2", "CB-TX-OSS-02-LV", 790 + dx, "TX-OSS-02", "66B"],
          ] as const).map(([hv, es, z, lv, x, name, lvBus]) => (
            <g key={hv}>
              <W x1={x} y1={292} x2={x} y2={326} c={zc("OSS220")} />
              <CB ctx={ctx} id={hv} x={x} y={335} labelSide="left" />
              <W x1={x} y1={344} x2={x} y2={394} c={zc(z, 220)} />
              <ES ctx={ctx} id={es} x={x} y={348} dir={z === "TX2" ? -1 : 1} />
              <Transformer ctx={ctx} x={x} y={420} zone={z} label={name} mva={farm.oss_trafo_mva} left={z === "TX2"} />
              <W x1={x} y1={446} x2={x} y2={476} c={zc(z, 66)} />
              <CB ctx={ctx} id={lv} x={x} y={485} labelSide="left" />
              <W x1={x} y1={494} x2={x} y2={520} c={zc(lvBus)} />
            </g>
          ))}
          {net.tx1_loading_pct != null && (
            <text x={534} y={450} fontSize={12} fontFamily="monospace" className="fill-text-secondary">
              {net.tx1_loading_pct < 1 ? `no load · ${net.tx1_i_hv_a?.toFixed(2)} A HV` : `${net.tx1_loading_pct.toFixed(0)} % loaded`}
            </text>
          )}

          {/* 66 kV sections */}
          <Bus x1={400} x2={680 + dx} y={520} c={zc("66A")} label="66 kV section A" />
          {net.zones["66A"] === "live" && (
            <text x={560} y={511} fontSize={12} fontFamily="monospace" className="fill-text-secondary">{vLabel("66A")}</text>
          )}
          <W x1={410} y1={520} x2={410} y2={540} c={zc("66A")} />
          <ES ctx={ctx} id="ES-OSS-66-01" x={410} y={540} dir={-1} />
          <Bus x1={700 + dx} x2={850 + dx} y={520} c={zc("66B")} label="Section B" />
          <W x1={710 + dx} y1={520} x2={710 + dx} y2={540} c={zc("66B")} />
          <ES ctx={ctx} id="ES-OSS-66-02" x={710 + dx} y={540} />
          <text x={795 + dx} y={610} textAnchor="middle" fontSize={11} className="fill-text-muted">{stringsB}</text>
          {nB > 0 && <text x={795 + dx} y={625} textAnchor="middle" fontSize={11} className="fill-text-muted">circuit 2 programme</text>}

          {strA.map(({ n, wtg, x }) => {
            const z = `STR${n}`;
            const released = eq[`WTG-GRP-${pad(n)}`]?.state === "closed";
            return (
              <g key={z}>
                <W x1={x} y1={520} x2={x} y2={546} c={zc("66A")} />
                <CB ctx={ctx} id={`CB-STR-${pad(n)}`} x={x} y={555} labelSide="left" />
                <W x1={x} y1={564} x2={x} y2={621} c={zc(z)} />
                <ES ctx={ctx} id={`ES-STR-${pad(n)}`} x={x} y={580} label="ES" />
                <CB ctx={ctx} id={`WTG-GRP-${pad(n)}`} x={x} y={630} labelSide="left" label="WTG" />
                <W x1={x} y1={639} x2={x} y2={649} c={released ? zc(z) : DEAD} />
                <Generator ctx={ctx} x={x} y={662} zone={released ? z : "__none"} />
                <text x={x} y={694} textAnchor="middle" fontSize={13} fontWeight={600} className="fill-text-primary">String {n}</text>
                <text x={x} y={710} textAnchor="middle" fontSize={11} fontFamily="monospace" className="fill-text-muted">
                  {wtg} × 15 MW{released ? " · online" : ""}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend + selection */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border-primary px-4 py-2 text-[11px] text-text-muted">
        {([["220 kV live", V220], ["66 kV live", V66], ["earthed", EARTH], ["isolated", DEAD]] as const).map(([l, c]) => (
          <span key={l} className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4" style={{ background: c }} />
            {l}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: LOCK }} /> isolation lock
        </span>
        <span className="ml-auto font-mono">
          {sel
            ? `${sel.equipment_id} · ${sel.location} · ${sel.state}${sel.locked ? " · locked" : ""}`
            : "Click a device for details — devices are operated only through the programme"}
        </span>
      </div>
    </div>
  );
}
