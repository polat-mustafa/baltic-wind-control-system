/**
 * Legacy KPICard — preserved as a thin wrapper over the ISA-101 InfoTile
 * primitive for back-compatibility with P1/P2/P4/P5 dashboards.
 *
 * New code should call <InfoTile /> directly. This wrapper exists so the
 * widespread `<KPICard label value unit trend trendValue education />`
 * call sites keep working through the ISA-101 refactor without touching
 * every consumer.
 *
 * Behavioural notes:
 *   - `trend="down"` → priority="alarm" (matches old red-on-down styling)
 *   - `trendValue` is rendered as InfoTile's subtitle slot
 *   - `education` is composed into the icon slot beside `icon`
 */

import { type ReactNode } from "react";

import { InfoTile } from "./InfoTile";
import { EducationButton } from "./EducationButton";
import type { EducationContent } from "../../types/education";

type Trend = "up" | "down" | "flat";

interface KPICardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: Trend;
  trendValue?: string;
  icon?: ReactNode;
  className?: string;
  /** Optional educational content shown via a small graduation-cap icon. */
  education?: EducationContent;
}

export function KPICard({
  label,
  value,
  unit,
  trend,
  trendValue,
  icon,
  className,
  education,
}: KPICardProps) {
  // Compose icon + education button into InfoTile's single icon slot.
  const composedIcon =
    icon || education ? (
      <span className="inline-flex items-center gap-1">
        {icon}
        {education && <EducationButton content={education} />}
      </span>
    ) : undefined;

  // Old KPICard: down-trend = red. Map to InfoTile priority for the same effect.
  const priority = trend === "down" ? "alarm" : "normal";

  return (
    <InfoTile
      label={label}
      value={value}
      unit={unit}
      trend={trend}
      subtitle={trendValue}
      icon={composedIcon}
      priority={priority}
      className={className}
    />
  );
}
