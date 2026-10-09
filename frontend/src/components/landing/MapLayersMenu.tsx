/**
 * Layers popover of the Control Room map (style board: "Layers popover"),
 * grouped Plant / Weather / Marine / Context.
 */

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

import { useLayerStore, type LayerVisibility } from "../../store/layerStore";
import { cn } from "../../lib/utils";

const GROUPS: { name: string; items: { key: keyof LayerVisibility; label: string }[] }[] = [
  {
    name: "Plant",
    items: [
      { key: "arrayCables", label: "66 kV array cables" },
      { key: "turbineLabels", label: "Turbine IDs (zoom in)" },
      { key: "foundations", label: "Foundations (zoom in)" },
      { key: "cableDts", label: "Export cable temperature (DTS)" },
      { key: "fibreComms", label: "OT fibre and microwave" },
    ],
  },
  {
    name: "Weather",
    items: [
      { key: "windParticles", label: "Wind flow" },
      { key: "oceanWaves", label: "Waves" },
      { key: "wakeEffects", label: "Wake envelopes" },
      { key: "dayNightTint", label: "Day / night" },
    ],
  },
  {
    name: "Marine",
    items: [
      { key: "aisTraffic", label: "AIS traffic (live)" },
      { key: "vessels", label: "O&M vessels and crews" },
      { key: "navAids", label: "Navigation lights and marks" },
      { key: "safetyZones", label: "500 m safety zones" },
    ],
  },
  {
    name: "Context",
    items: [
      { key: "exclusionZone", label: "Site boundary" },
      { key: "bathymetry", label: "Bathymetry" },
      { key: "gridContext", label: "Other wind farms and SwePol" },
    ],
  },
];

export default function MapLayersMenu({ onClose }: { onClose: () => void }) {
  const layers = useLayerStore((s) => s.layers);
  const toggleLayer = useLayerStore((s) => s.toggleLayer);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onClose();
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Map layers"
      className="absolute left-3 top-14 z-[1200] max-h-[calc(100%-4.5rem)] w-72 overflow-y-auto rounded-md border border-border-secondary bg-bg-secondary shadow-xl shadow-black/40"
    >
      <div className="flex items-center justify-between border-b border-border-primary px-3.5 py-2">
        <span className="text-sm font-semibold text-text-primary">Map layers</span>
        <button type="button" onClick={onClose} aria-label="Close map layers" className="rounded p-1 text-text-muted hover:text-text-primary">
          <X size={14} />
        </button>
      </div>
      {GROUPS.map((g) => (
        <div key={g.name} className="border-b border-border-primary px-3.5 pb-1.5 pt-2 last:border-b-0">
          <div className="mb-0.5 text-xs font-medium uppercase tracking-[0.08em] text-text-muted">{g.name}</div>
          {g.items.map(({ key, label }) => (
            <label key={key} className="flex h-8 cursor-pointer items-center justify-between gap-3">
              <span className={cn("text-sm", layers[key] ? "text-text-primary" : "text-text-muted")}>{label}</span>
              <button
                type="button"
                role="switch"
                aria-checked={layers[key]}
                aria-label={label}
                onClick={() => toggleLayer(key)}
                className={cn(
                  "flex h-4 w-[30px] items-center rounded-full p-0.5 transition-colors",
                  layers[key] ? "justify-end bg-accent" : "justify-start bg-border-secondary",
                )}
              >
                <span className={cn("h-3 w-3 rounded-full", layers[key] ? "bg-accent-ink" : "bg-text-muted")} />
              </button>
            </label>
          ))}
        </div>
      ))}
    </div>
  );
}
