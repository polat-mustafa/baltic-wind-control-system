/**
 * OSS 66 kV switchboard — bay controllers (M01, IEC 61850 CSWI/XCBR/XSWI/CILO).
 *
 * Panels are drawn in switchboard order: section A (strings 1–3, incomer
 * TX-OSS-01) · bus coupler · section B (incomer TX-OSS-02, strings 4–6).
 * Each device is operated select-before-operate: the select is a dry-run of
 * the bay interlocks on the backend, Execute operates the device. Breaker
 * positions are shared with the single-line diagram.
 */

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { useBayStore } from "../../store/bayStore";
import { useScadaStore } from "../../store/scadaStore";
import { SCADA_COLORS } from "../../constants/scadaColors";
import type { BayStateResponse, SwitchCommand, SwitchPosition } from "../../types/bay";
import { cn } from "../../lib/utils";

/** Physical panel order on the switchboard. */
const ORDER = [
  "BAY-OSS-66-01", "BAY-OSS-66-02", "BAY-OSS-66-03", "BAY-OSS-66-07",
  "BAY-OSS-66-08",
  "BAY-OSS-66-09", "BAY-OSS-66-04", "BAY-OSS-66-05", "BAY-OSS-66-06",
];

type Device = { key: "disconnector_bus" | "circuit_breaker" | "disconnector_line" | "earth_switch"; idKey: "ds_bus_id" | "cb_id" | "ds_line_id" | "es_id"; label: string };
const DEVICES: Device[] = [
  { key: "disconnector_bus", idKey: "ds_bus_id", label: "Bus disconnector" },
  { key: "circuit_breaker", idKey: "cb_id", label: "Circuit breaker" },
  { key: "disconnector_line", idKey: "ds_line_id", label: "Line disconnector" },
  { key: "earth_switch", idKey: "es_id", label: "Earth switch" },
];

function nextAction(d: Device, pos: SwitchPosition): SwitchCommand {
  if (d.key === "earth_switch") return pos === "closed" ? "unearth" : "earth";
  return pos === "closed" ? "open" : "close";
}

/** Tiny IEC 60617-style column: DS bus · CB · DS line · ES. */
function BayMimic({ bay }: { bay: BayStateResponse }) {
  const on = (p: SwitchPosition) => p === "closed";
  const live = on(bay.disconnector_bus) && on(bay.circuit_breaker);
  const c = (p: SwitchPosition, isLive: boolean) => (p === "tripped" ? SCADA_COLORS.FAULT : isLive ? SCADA_COLORS.VOLTAGE_66KV : SCADA_COLORS.DE_ENERGIZED);
  const sw = (y: number, p: SwitchPosition, isLive: boolean) =>
    on(p) ? <line x1={20} y1={y} x2={20} y2={y + 14} stroke={c(p, isLive)} strokeWidth={2} /> : <line x1={20} y1={y + 14} x2={11} y2={y + 2} stroke={c(p, isLive)} strokeWidth={2} />;
  return (
    <svg viewBox="0 0 40 96" className="w-8 h-20 shrink-0" aria-hidden>
      <line x1={0} y1={2} x2={40} y2={2} stroke={SCADA_COLORS.VOLTAGE_66KV} strokeWidth={4} />
      <line x1={20} y1={2} x2={20} y2={10} stroke={SCADA_COLORS.VOLTAGE_66KV} strokeWidth={2} />
      {sw(10, bay.disconnector_bus, true)}
      <line x1={20} y1={24} x2={20} y2={32} stroke={c("closed", on(bay.disconnector_bus))} strokeWidth={2} />
      <rect x={13} y={32} width={14} height={14} fill={on(bay.circuit_breaker) ? c(bay.circuit_breaker, on(bay.disconnector_bus)) : "none"} stroke={c(bay.circuit_breaker, on(bay.disconnector_bus))} strokeWidth={2} />
      <line x1={20} y1={46} x2={20} y2={54} stroke={c("closed", live)} strokeWidth={2} />
      {sw(54, bay.disconnector_line, live)}
      <line x1={20} y1={68} x2={20} y2={80} stroke={c("closed", live && on(bay.disconnector_line))} strokeWidth={2} />
      {/* earth switch to the right with earth symbol */}
      <line x1={20} y1={74} x2={28} y2={74} stroke={SCADA_COLORS.DE_ENERGIZED} strokeWidth={1.5} />
      {on(bay.earth_switch) ? <line x1={28} y1={74} x2={28} y2={86} stroke={SCADA_COLORS.EARTHED} strokeWidth={2} /> : <line x1={28} y1={74} x2={35} y2={84} stroke={SCADA_COLORS.DE_ENERGIZED} strokeWidth={2} />}
      <line x1={23} y1={88} x2={33} y2={88} stroke={on(bay.earth_switch) ? SCADA_COLORS.EARTHED : SCADA_COLORS.DE_ENERGIZED} strokeWidth={2} />
      <line x1={25} y1={91} x2={31} y2={91} stroke={on(bay.earth_switch) ? SCADA_COLORS.EARTHED : SCADA_COLORS.DE_ENERGIZED} strokeWidth={1.5} />
    </svg>
  );
}

export default function BayControllerPanel() {
  const allBays = useBayStore((s) => s.allBays);
  const selected = useBayStore((s) => s.selectedBay);
  const interlocks = useBayStore((s) => s.interlocks);
  const validation = useBayStore((s) => s.validation);
  const busy = useBayStore((s) => s.busy);
  const error = useBayStore((s) => s.error);
  const fetchAllBays = useBayStore((s) => s.fetchAllBays);
  const fetchAllInterlocks = useBayStore((s) => s.fetchAllInterlocks);
  const selectBay = useBayStore((s) => s.selectBay);
  const validate = useBayStore((s) => s.validate);
  const execute = useBayStore((s) => s.execute);
  const clearValidation = useBayStore((s) => s.clearValidation);
  // Re-read the bays whenever the SLD or a protection trip moves a breaker
  const breakerStates = useScadaStore((s) => s.breakerStates);

  useEffect(() => {
    void fetchAllBays().then(fetchAllInterlocks);
  }, [fetchAllBays, fetchAllInterlocks, breakerStates]);

  const byName = Object.fromEntries((allBays?.bays ?? []).map((b) => [b.name, b]));
  const bay = selected ? byName[selected] : null;
  const rules = selected ? interlocks[selected]?.rules ?? [] : [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <h3 className="text-xs font-semibold text-text-primary">OSS 66 kV switchboard · 9 bay controllers</h3>
        <span className="text-[11px] font-mono text-text-muted">
          {allBays ? `${allBays.energised_count} in service · ${allBays.earthed_count} earthed` : "loading…"}
        </span>
        <span className="flex-1" />
        <button type="button" onClick={() => void fetchAllBays().then(fetchAllInterlocks)} className="flex items-center gap-1 h-6 px-2 rounded border border-border-primary text-[11px] text-text-secondary hover:bg-bg-hover">
          <RefreshCw size={11} /> Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-2 rounded border border-status-warning/40 bg-status-warning/10 text-xs text-text-primary">
          <AlertTriangle size={13} className="shrink-0 mt-0.5 text-status-warning" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={clearValidation} className="text-text-muted hover:text-text-primary">Dismiss</button>
        </div>
      )}

      {/* Switchboard line-up */}
      <div className="overflow-x-auto">
        <div className="grid grid-cols-9 gap-1.5 min-w-[900px]">
          {ORDER.map((name, i) => {
            const b = byName[name];
            const section = i < 4 ? "A" : i === 4 ? "A | B" : "B";
            return (
              <button
                key={name}
                type="button"
                disabled={!b}
                onClick={() => selectBay(selected === name ? null : name)}
                className={cn(
                  "flex flex-col gap-1 p-2 rounded border text-left bg-bg-secondary hover:border-accent transition-colors",
                  selected === name ? "border-accent ring-1 ring-accent" : "border-border-primary",
                  b?.is_tie_cb && "bg-bg-tertiary",
                )}
              >
                <span className="text-[10px] font-mono text-text-muted">section {section}</span>
                <span className="text-xs font-mono font-semibold text-text-primary">{name.replace("BAY-OSS-", "")}</span>
                <span className="text-[11px] text-text-secondary leading-tight min-h-7">{b?.display_name ?? "—"}</span>
                {b && (
                  <div className="flex items-end gap-1.5">
                    <BayMimic bay={b} />
                    <div className="text-[10px] font-mono leading-4 text-text-muted">
                      <div className={b.circuit_breaker === "closed" ? "text-text-primary font-semibold" : undefined}>CB {b.circuit_breaker}</div>
                      <div>{b.bay_mode}</div>
                      <div className={b.protection_relay === "tripped" ? "text-status-alarm font-semibold" : undefined}>relay {b.protection_relay}</div>
                      {b.manual_isolation_active && <div className="text-status-warning">PTW tag</div>}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected bay: device commands + interlocks */}
      {bay ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <section className="bg-bg-secondary rounded-lg border border-border-primary p-3">
            <h4 className="text-xs font-semibold text-text-primary mb-2">
              {bay.name} · {bay.display_name}
            </h4>
            <table className="w-full text-xs">
              <tbody>
                {DEVICES.map((d) => {
                  const pos = bay[d.key];
                  const id = bay[d.idKey];
                  const action = nextAction(d, pos);
                  const pending = validation?.equipment_id === id;
                  return (
                    <tr key={d.key} className="border-b border-border-primary/60">
                      <td className="py-1.5 text-text-muted">{d.label}</td>
                      <td className="py-1.5 font-mono text-text-secondary">{id}</td>
                      <td className={cn("py-1.5 font-mono", pos === "closed" ? "text-text-primary font-semibold" : "text-text-muted")}>{pos}</td>
                      <td className="py-1.5 text-right">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void validate(bay.name, id, action)}
                          className="h-6 px-2 rounded border border-border-primary text-[11px] font-semibold text-text-primary hover:bg-bg-hover disabled:opacity-40"
                        >
                          {pending ? "Selected" : `Select ${action.toUpperCase()}`}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {validation && (
              <div className={cn("mt-2 p-2 rounded border text-xs", validation.allowed ? "border-status-normal/50" : "border-status-warning/60 bg-status-warning/10")}>
                {validation.allowed ? (
                  <div className="flex items-center gap-2">
                    <span className="text-text-primary">
                      Interlocks clear for <b className="font-mono">{validation.equipment_id} {validation.action.toUpperCase()}</b>
                    </span>
                    <span className="flex-1" />
                    <button type="button" disabled={busy} onClick={() => void execute(bay.name, validation.equipment_id, validation.action)} className="h-7 px-3 rounded bg-accent text-white font-semibold hover:opacity-90 disabled:opacity-50">
                      Execute
                    </button>
                    <button type="button" onClick={clearValidation} className="h-7 px-3 rounded border border-border-primary text-text-secondary hover:bg-bg-hover">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <ul className="space-y-0.5 text-text-primary">
                    {validation.reasons.map((r, i) => (
                      <li key={r}>
                        <b className="font-mono">{validation.blocked_by[i]}</b> {r}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>

          <section className="bg-bg-secondary rounded-lg border border-border-primary p-3">
            <h4 className="text-xs font-semibold text-text-primary mb-2">Interlock logic (CILO) — {bay.name}</h4>
            <ul className="space-y-1">
              {rules.map((r) => (
                <li key={r.interlock_id} className="flex gap-2 text-[11px]">
                  <span className={cn("font-mono w-14 shrink-0", r.currently_active ? "text-status-warning font-semibold" : "text-text-muted")}>{r.interlock_id}</span>
                  <span className={r.currently_active ? "text-text-primary" : "text-text-muted"}>{r.description}</span>
                  <span className="ml-auto shrink-0 font-mono text-[10px] text-text-muted">{r.currently_active ? "BLOCKING" : "clear"}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : (
        <p className="text-xs text-text-muted">Select a bay panel to operate its devices and see its interlocks.</p>
      )}
    </div>
  );
}
