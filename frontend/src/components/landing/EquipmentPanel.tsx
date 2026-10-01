/**
 * Shared shell + building blocks for the landing-map equipment panels
 * (OSS / onshore transformers, STATCOM, LIDAR).
 *
 * One visual grammar for every piece of plant: accent-coloured header with
 * the equipment tag and state, a hero readout, titled sections of label/value
 * rows, and a footer action. Esc closes the panel.
 */

import { useEffect, type CSSProperties, type ReactNode } from "react";

import { ArrowRight, X, type LucideIcon } from "lucide-react";

interface EquipmentPanelProps {
  icon: LucideIcon;
  /** Equipment tag, e.g. "TX-OSS-01/02". */
  tag: string;
  /** One-line description: type · rating · standard. */
  subtitle: string;
  /** State pill in the header (colour = ISA-101 state colour). */
  status: { label: string; color: string };
  onClose: () => void;
  /** Footer navigation to the owning dashboard. */
  action?: { label: string; onClick: () => void };
  /** Small print under the action (standards, data source). */
  footnote?: ReactNode;
  /** Panel width [px] (default 360) and position (default: top-right of the map). */
  width?: number;
  placement?: CSSProperties;
  children: ReactNode;
}

const DEFAULT_PLACEMENT: CSSProperties = { right: 16, top: 80 };

export function EquipmentPanel({
  icon: Icon,
  tag,
  subtitle,
  status,
  onClose,
  action,
  footnote,
  width = 360,
  placement = DEFAULT_PLACEMENT,
  children,
}: EquipmentPanelProps) {
  // Esc closes the panel unless an inner handler (registered in the capture
  // phase, e.g. an open education card) already consumed it via preventDefault.
  useEffect(() => {
    const onKey = ({ key, defaultPrevented }: KeyboardEvent) =>
      key === "Escape" && !defaultPrevented && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-label={`${tag} details`}
      className="absolute flex flex-col rounded-xl border border-border-primary bg-bg-primary/95 backdrop-blur-md shadow-2xl shadow-black/60 overflow-hidden"
      style={{
        zIndex: 1100,
        width,
        maxWidth: "calc(100% - 32px)",
        maxHeight: "calc(100% - 96px)",
        ...placement,
        borderTop: `2px solid ${status.color}`,
      }}
    >
      {/* Header */}
      <div className="flex items-start gap-3 px-4 pt-3.5 pb-3 border-b border-border-primary">
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${status.color}1f`, color: status.color }}
        >
          <Icon size={18} strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-mono text-[15px] font-semibold tracking-tight text-text-primary">
              {tag}
            </h2>
            <span
              className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ backgroundColor: `${status.color}26`, color: status.color }}
            >
              {status.label}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-text-muted">
            {subtitle}
          </p>
        </div>
        <button
          onClick={onClose}
          className="-mr-1 rounded-md p-1 text-text-muted transition-colors hover:bg-bg-tertiary hover:text-text-primary"
          aria-label={`Close ${tag} panel`}
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">{children}</div>

      {(action || footnote) && (
        <div className="border-t border-border-primary px-4 py-3">
          {action && (
            <button
              onClick={action.onClick}
              className="group flex w-full items-center justify-center gap-1.5 rounded-lg border border-accent/60 py-2 text-xs font-medium text-accent transition-colors hover:bg-accent-muted"
            >
              {action.label}
              <ArrowRight
                size={13}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </button>
          )}
          {footnote && (
            <p className="mt-2 text-center text-[10px] leading-relaxed text-text-muted">
              {footnote}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function PanelSection({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-border-primary/60 px-4 py-3 last:border-b-0">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">
          {title}
        </h3>
        {aside && <div className="text-[10px] text-text-muted">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

export function DataRow({
  label,
  value,
  unit,
  color,
  hint,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  color?: string;
  /** Native tooltip explaining the quantity. */
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-[3px]" title={hint}>
      <span className="text-xs text-text-secondary">{label}</span>
      <span
        className="font-mono text-xs font-medium tabular-nums"
        style={{ color: color ?? "var(--color-text-primary)" }}
      >
        {value}
        {unit && <span className="ml-1 text-[10px] text-text-muted">{unit}</span>}
      </span>
    </div>
  );
}

/** Big live readout: value + unit + caption. */
export function HeroValue({
  caption,
  value,
  unit,
  color,
}: {
  caption: string;
  value: string;
  unit: string;
  color: string;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">
        {caption}
      </div>
      <div
        className="font-mono text-[28px] font-semibold leading-tight tabular-nums"
        style={{ color }}
      >
        {value}
        <span className="ml-1.5 text-xs font-normal text-text-muted">{unit}</span>
      </div>
    </div>
  );
}

/**
 * Horizontal level bar. `min < 0` draws a centre-zero bar (e.g. ±Q capability);
 * `marks` draws threshold ticks (e.g. alarm limits).
 */
export function LevelBar({
  value,
  min = 0,
  max,
  color,
  marks = [],
  height = 8,
}: {
  value: number;
  min?: number;
  max: number;
  color: string;
  marks?: { at: number; color: string }[];
  height?: number;
}) {
  const pct = (v: number) =>
    ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * 100;
  const zero = pct(Math.max(min, Math.min(max, 0)));
  const at = pct(value);
  const left = Math.min(zero, at);

  return (
    <div
      className="relative w-full overflow-hidden rounded-full bg-bg-tertiary"
      style={{ height }}
    >
      <div
        className="absolute inset-y-0 rounded-full transition-all duration-700"
        style={{
          left: `${left}%`,
          width: `${Math.abs(at - zero)}%`,
          backgroundColor: color,
        }}
      />
      {min < 0 && (
        <div
          className="absolute inset-y-0 w-px bg-text-muted/70"
          style={{ left: `${zero}%` }}
        />
      )}
      {marks.map((m) => (
        <div
          key={m.at}
          className="absolute inset-y-0 w-0.5"
          style={{ left: `${pct(m.at)}%`, backgroundColor: m.color }}
        />
      ))}
    </div>
  );
}
