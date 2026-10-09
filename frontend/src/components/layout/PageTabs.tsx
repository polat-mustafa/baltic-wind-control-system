/**
 * Page-level tabs under the PageHeader (style board, Components): text tabs
 * with a cyan underline on the selected one. Arrow keys move between tabs.
 */

import { useRef, type ComponentType, type KeyboardEvent } from "react";
import { cn } from "../../lib/utils";

export interface PageTab<T extends string> {
  id: T;
  label: string;
  Icon?: ComponentType<{ size?: number; className?: string }>;
  /** Tooltip: what the tab covers. */
  title?: string;
}

interface PageTabsProps<T extends string> {
  tabs: readonly PageTab<T>[];
  value: T;
  onChange: (id: T) => void;
  label?: string;
  className?: string;
}

export function PageTabs<T extends string>({ tabs, value, onChange, label = "Page sections", className }: PageTabsProps<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = tabs.findIndex((t) => t.id === value);
    const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    onChange(next.id);
    ref.current?.querySelector<HTMLButtonElement>(`[data-tab="${next.id}"]`)?.focus();
  };
  return (
    <div
      ref={ref}
      role="tablist"
      aria-label={label}
      onKeyDown={onKey}
      data-tour="page-tabs"
      className={cn("flex max-w-full gap-6 overflow-x-auto overflow-y-hidden border-b border-border-primary [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)}
    >
      {tabs.map(({ id, label: text, Icon, title }) => {
        const selected = id === value;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            data-tab={id}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            title={title}
            onClick={() => onChange(id)}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 py-2.5 text-sm font-medium transition-colors",
              selected
                ? "border-accent text-text-primary"
                : "border-transparent text-text-muted hover:text-text-primary",
            )}
          >
            {Icon && <Icon size={14} className={selected ? "text-accent" : undefined} />}
            {text}
          </button>
        );
      })}
    </div>
  );
}
