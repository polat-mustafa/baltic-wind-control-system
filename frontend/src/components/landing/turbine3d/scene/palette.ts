/**
 * Shared status palette for the 3D nacelle interior.
 *
 * Centralises the ad-hoc hex codes that were scattered across NacelleSubsystems,
 * NacelleInteriorDetail, PowerFlowParticles, and SensorMarkers into one place so
 * that status colours stay consistent across components and are easy to retune.
 */

export const statusPalette = {
  alive:   "#38bdf8",  // sky-400 — live power / active flow
  warning: "#f59e0b",  // amber-500 — oil ΔT, threshold approach
  fault:   "#ef4444",  // red-500 — fault / trip
  idle:    "#64748b",  // slate-500 — inactive
  oil:     "#f59e0b",  // amber — hydraulic / lube oil
  coolant: "#22d3ee",  // cyan-400 — water-glycol coolant
  hvAC:    "#a78bfa",  // violet — HV AC export
  selected:      "#60a5fa",  // blue-400 — currently-selected part rim
  selectedGlow:  "#1d4ed8",  // blue-700 — selected part emissive
} as const;

export type StatusPaletteKey = keyof typeof statusPalette;
