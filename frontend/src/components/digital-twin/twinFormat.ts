/**
 * Shared labels, units and formatters for the Digital Twin views.
 *
 * ISA-101 convention: normal is drawn neutral; colour is reserved for
 * abnormal states, and every state also carries a word and an icon.
 */

import type {
  ChannelKey,
  FaultKind,
  HealthStatus,
  ScenarioName,
} from "../../services/digitalTwinApi";

export const SCENARIO_ORDER: ScenarioName[] = [
  "combined",
  "healthy",
  "rotor_icing",
  "pitch_misalignment",
  "converter_derating",
  "generator_degradation",
  "anemometer_drift",
];

export const SCENARIO_TITLE: Record<ScenarioName, string> = {
  combined: "Combined faults",
  healthy: "Healthy fleet",
  rotor_icing: "Rotor icing",
  pitch_misalignment: "Pitch misalignment",
  converter_derating: "Converter derating",
  generator_degradation: "Generator degradation",
  anemometer_drift: "Anemometer drift",
};

export const DURATIONS = [1, 3, 7, 14, 30] as const;

export const CHANNEL_META: Record<ChannelKey, { label: string; short: string; unit: string }> = {
  power: { label: "Active power", short: "P", unit: "MW" },
  rotor_speed: { label: "Rotor speed", short: "ω", unit: "rpm" },
  pitch: { label: "Pitch angle", short: "β", unit: "°" },
  generator_temp: { label: "Generator winding temp.", short: "T", unit: "°C" },
  anemometer: { label: "Nacelle wind vs neighbours", short: "v", unit: "m/s" },
};

export const CHANNEL_ORDER: ChannelKey[] = [
  "power",
  "rotor_speed",
  "pitch",
  "generator_temp",
  "anemometer",
];

export const FAULT_LABEL: Record<FaultKind, string> = {
  aero_efficiency: "Aerodynamic efficiency loss",
  pitch_offset: "Pitch angle misalignment",
  power_limit: "Uncommanded power limitation",
  generator_loss: "Generator loss increase",
  anemometer_gain: "Nacelle anemometer drift",
};

export const FAULT_SHORT: Record<FaultKind, string> = {
  aero_efficiency: "Aero loss",
  pitch_offset: "Pitch offset",
  power_limit: "Power limit",
  generator_loss: "Generator loss",
  anemometer_gain: "Anemometer",
};

export const FAULT_CATEGORY: Record<FaultKind, string> = {
  aero_efficiency: "Aerodynamic",
  pitch_offset: "Control",
  power_limit: "Electrical",
  generator_loss: "Electrical",
  anemometer_gain: "Sensor",
};

/** Fault parameter as an engineer would say it, with unit. */
export function formatSeverity(kind: FaultKind, value: number | null): string {
  if (value == null) return "—";
  switch (kind) {
    case "aero_efficiency":
      return `Cp −${value.toFixed(1)} %`;
    case "pitch_offset":
      return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(2)}°`;
    case "power_limit":
      return `${value.toFixed(2)} MW cap`;
    case "generator_loss":
      return `${value.toFixed(2)}× losses`;
    case "anemometer_gain":
      return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(1)} % gain`;
  }
}

export const STATUS_LABEL: Record<HealthStatus, string> = {
  normal: "Normal",
  alert: "Alert",
  alarm: "Alarm",
};

/** Tailwind classes per status (text, chip). */
export const STATUS_CLASS: Record<HealthStatus, { text: string; chip: string }> = {
  normal: {
    text: "text-text-secondary",
    chip: "bg-bg-tertiary text-text-secondary border-border-secondary",
  },
  alert: {
    text: "text-status-warning",
    chip: "bg-status-warning/15 text-status-warning border-status-warning/40",
  },
  alarm: {
    text: "text-status-alarm",
    // solid, as the SCADA alarm chips: red text on a red tint stays under 4.5:1
    chip: "bg-status-alarm text-accent-ink border-status-alarm font-semibold",
  },
};

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
  hour12: false,
});

/** "13 Jan, 04:20" in UTC. */
export function formatTime(ts: number | null): string {
  return ts == null ? "—" : DATE_FMT.format(new Date(ts * 1000));
}

/** Unix seconds → ISO string for Plotly date axes (UTC). */
export function isoTime(ts: number): string {
  return new Date(ts * 1000).toISOString();
}

export function formatHours(h: number | null): string {
  if (h == null) return "—";
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} d`;
}

export function healthZone(hi: number): HealthStatus {
  if (hi < 40) return "alarm";
  if (hi < 70) return "alert";
  return "normal";
}

/** Contiguous true runs of a mask → [start, end] index pairs. */
export function spans(mask: boolean[]): [number, number][] {
  const out: [number, number][] = [];
  let start = -1;
  mask.forEach((m, i) => {
    if (m && start < 0) start = i;
    if (!m && start >= 0) {
      out.push([start, i - 1]);
      start = -1;
    }
  });
  if (start >= 0) out.push([start, mask.length - 1]);
  return out;
}
