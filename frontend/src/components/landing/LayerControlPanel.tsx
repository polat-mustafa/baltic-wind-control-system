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
  { key: "windParticles", label: "Wind Flow", color: "#5cc3d2" },
  { key: "wakeEffects", label: "Wake Cones", color: "#f25c54" },
  { key: "oceanWaves", label: "Ocean Waves", color: "#06b6d4" },
  { key: "arrayCables", label: "Array Cables", color: "#f97316" },
  { key: "exclusionZone", label: "Site Boundary", color: "#45c8d9" },
  { key: "foundations", label: "Foundations", color: "#3a5874" },
  { key: "turbineLabels", label: "Turbine Labels", color: "#7189a0" },
  { key: "bathymetry", label: "Bathymetry", color: "#1e3a5f" },
  { key: "dayNightTint", label: "Day / Night", color: "#fbbf24" },
  { key: "safetyZones", label: "Safety Zones 500 m", color: "#f59e0b" },
  { key: "navAids", label: "Nav Lights & Buoys", color: "#facc15" },
  { key: "vessels", label: "O&M Vessels", color: "#7dd3fc" },
  { key: "gridContext", label: "SwePol & OWF Areas", color: "#a78bfa" },
  { key: "fibreComms", label: "Fibre / SCADA Comms", color: "#22d3ee" },
  { key: "aisTraffic", label: "AIS Traffic (live)", color: "#34d399" },
  { key: "cableDts", label: "Export Cable DTS", color: "#fb7185" },
];

// ── Toggle switch ────────────────────────────────────────────────

function Toggle({ checked }: { checked: boolean }) {
  return (
    <div
      className="relative w-7 h-4 rounded-full transition-colors duration-200 shrink-0"
      style={{ backgroundColor: checked ? "#45c8d9" : "#2c4760" }}
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
    <div className="absolute top-14 xl:top-24 left-3 z-1100" data-tour="layer-control">
      {/* Collapsed button */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border transition-colors align-top"
        style={{
          backgroundColor: isOpen ? "#152637" : "rgba(10,21,32,0.85)",
          borderColor: isOpen ? "#45c8d9" : "#2c4760",
          color: isOpen ? "#e4ecf3" : "#a3b6c8",
        }}
        title="Toggle map layers"
      >
        <Layers size={14} />
        <span className="text-xs font-medium">Layers</span>
      </button>

      {/* Expanded panel */}
      {isOpen && (
        <div
          className="mt-1.5 rounded-lg border overflow-hidden"
          style={{
            backgroundColor: "rgba(10,21,32,0.95)",
            borderColor: "#1f3448",
            minWidth: 180,
          }}
        >
          <div
            className="px-3 py-1.5 border-b text-xs font-semibold tracking-wider uppercase"
            style={{ borderColor: "#1f3448", color: "#7189a0" }}
          >
            Map Layers
          </div>

          <div className="py-1 max-h-[55vh] overflow-y-auto">
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
                  className="text-xs flex-1 text-left transition-opacity"
                  style={{
                    color: layers[key] ? "#e4ecf3" : "#7189a0",
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
