/**
 * Process-equipment tile used as a terminal node in the Plant Mimic
 * (OSS, Onshore Substation, PSE Grid). Mirrors the Siemens WinCC
 * "equipment block" pattern: bold label, voltage step, throughput value,
 * compact key/value rows, tiny status pill.
 */

import { type ReactNode } from "react";
import { cn } from "../../lib/utils";

export type TerminalStatus = "energised" | "deenergised" | "alarm";

interface DataRow {
  label: string;
  value: string;
  unit?: string;
}

interface MimicTerminalNodeProps {
  label: string;
  voltageStep?: string;        // e.g. "66 / 220 kV"
  throughput?: { value: string; unit: string }; // e.g. { value: "487", unit: "MW" }
  status?: TerminalStatus;
  rows?: DataRow[];
  icon?: ReactNode;
  className?: string;
}

const STATUS_BORDER: Record<TerminalStatus, string> = {
  energised:   "border-l-status-normal",
  deenergised: "border-l-border-primary",
  alarm:       "border-l-status-alarm",
};

const STATUS_DOT: Record<TerminalStatus, string> = {
  energised:   "bg-status-normal",
  deenergised: "bg-text-faint",
  alarm:       "bg-status-alarm animate-pulse",
};

export default function MimicTerminalNode({
  label,
  voltageStep,
  throughput,
  status = "energised",
  rows = [],
  icon,
  className,
}: MimicTerminalNodeProps) {
  return (
    <div
      className={cn(
        "border-l-[3px] border border-border-primary bg-bg-secondary",
        "min-w-[180px] max-w-[220px] flex flex-col",
        STATUS_BORDER[status],
        className,
      )}
    >
      {/* Header strip */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-border-primary bg-bg-tertiary">
        <div className="flex items-center gap-1.5">
          {icon && <span className="text-text-muted">{icon}</span>}
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-primary">
            {label}
          </span>
        </div>
        <span
          className={cn("w-1.5 h-1.5 rounded-full", STATUS_DOT[status])}
          aria-hidden
        />
      </div>

      {/* Throughput line — the prominent number */}
      {throughput && (
        <div className="flex items-baseline gap-1 px-2 pt-1.5">
          <span className="font-mono font-semibold tabular-nums text-xl leading-none text-text-primary">
            {throughput.value}
          </span>
          <span className="text-[10px] text-text-muted">{throughput.unit}</span>
        </div>
      )}

      {/* Voltage step */}
      {voltageStep && (
        <div className="px-2 pb-1">
          <span className="text-[10px] font-mono text-text-secondary">
            {voltageStep}
          </span>
        </div>
      )}

      {/* Data rows */}
      {rows.length > 0 && (
        <div className="flex flex-col px-2 py-1 border-t border-border-primary gap-0.5">
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex items-baseline justify-between gap-2 text-[10px]"
            >
              <span className="text-text-muted uppercase tracking-wider">
                {r.label}
              </span>
              <span className="font-mono tabular-nums text-text-secondary">
                {r.value}
                {r.unit && (
                  <span className="text-text-muted ml-0.5">{r.unit}</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
