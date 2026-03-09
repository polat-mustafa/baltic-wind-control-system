/**
 * Floating layer toggle panel for the Leaflet wind farm map.
 *
 * Compact button that expands to reveal toggle switches for each
 * data layer (wind particles, wake cones, ocean waves, cables, etc.).
 * Follows ISA-101 dark theme. Similar UX to Google Maps layer control.
 */

import { useState } from "react";
import { Layers } from "lucide-react";

import {
  useLayerStore,
  type LayerVisibility,
} from "../../store/layerStore";

// ── Layer definitions ────────────────────────────────────────────

const LAYER_ITEMS: {
  key: keyof LayerVisibility;
  label: string;
  color: string;
}[] = [
  { key: "windParticles", label: "Wind Flow", color: "#60a5fa" },
  { key: "wakeEffects", label: "Wake Cones", color: "#ef4444" },
  { key: "oceanWaves", label: "Ocean Waves", color: "#06b6d4" },
  { key: "arrayCables", label: "Array Cables", color: "#f97316" },
  { key: "exclusionZone", label: "Exclusion Zone", color: "#3b82f6" },
  { key: "foundations", label: "Foundations", color: "#4a5580" },
  { key: "turbineLabels", label: "Turbine Labels", color: "#6b7490" },
  { key: "bathymetry", label: "Bathymetry", color: "#1e3a5f" },
  { key: "dayNightTint", label: "Day / Night", color: "#fbbf24" },
];

// ── Toggle switch ────────────────────────────────────────────────

function Toggle({ checked }: { checked: boolean }) {
  return (
    <div
      className="relative w-7 h-4 rounded-full transition-colors duration-200 shrink-0"
      style={{ backgroundColor: checked ? "#3b82f6" : "#3d4560" }}
    >
      <div
        className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform duration-200"
        style={{ transform: checked ? "translateX(14px)" : "translateX(2px)" }}
      />
    </div>
  );
}

// ── Panel component ──────────────────────────────────────────────

export default function LayerControlPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const layers = useLayerStore((s) => s.layers);
  const toggleLayer = useLayerStore((s) => s.toggleLayer);

  return (
    <div className="absolute top-3 left-3 z-[1000]">
      {/* Collapsed button */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border transition-colors"
        style={{
          backgroundColor: isOpen ? "#1e2231" : "rgba(15,17,23,0.85)",
          borderColor: isOpen ? "#3b82f6" : "#3d4560",
          color: isOpen ? "#e8eaf0" : "#9ba3b8",
        }}
        title="Toggle map layers"
      >
        <Layers size={14} />
        <span className="text-[11px] font-medium">Layers</span>
      </button>

      {/* Expanded panel */}
      {isOpen && (
        <div
          className="mt-1.5 rounded-lg border overflow-hidden"
          style={{
            backgroundColor: "rgba(15,17,23,0.95)",
            borderColor: "#2a3040",
            minWidth: 180,
          }}
        >
          <div
            className="px-3 py-1.5 border-b text-[10px] font-semibold tracking-wider uppercase"
            style={{ borderColor: "#2a3040", color: "#6b7490" }}
          >
            Map Layers
          </div>

          <div className="py-1">
            {LAYER_ITEMS.map(({ key, label, color }) => (
              <button
                key={key}
                onClick={() => toggleLayer(key)}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 transition-colors"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0 transition-opacity"
                  style={{
                    backgroundColor: color,
                    opacity: layers[key] ? 1 : 0.3,
                  }}
                />
                <span
                  className="text-[11px] flex-1 text-left transition-opacity"
                  style={{
                    color: layers[key] ? "#e8eaf0" : "#6b7490",
                  }}
                >
                  {label}
                </span>
                <Toggle checked={layers[key]} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
