/**
 * Invisible SVG click-target overlay for the turbine cross-section.
 *
 * Rendered as the LAST <g> child of the SVG so it sits on top of all
 * visuals (SVG painter's model = last painted = topmost for events).
 *
 * Nacelle zone renders first (covers most inner parts), then specific
 * part zones render after → specific parts get click priority.
 *
 * Each zone:
 * - fill="transparent" (invisible but clickable)
 * - Hover: dashed accent-blue stroke (40% opacity)
 * - Active: solid accent-blue stroke
 * - Fault: pulsing red ring via CSS animation
 * - Curtailment: pulsing amber ring via CSS animation
 */

import type { TurbinePartId } from "../../constants/turbinePartEducation";

interface ClickZone {
  shape: "rect" | "circle";
  coords: number[]; // [x,y,w,h] for rect, [cx,cy,r] for circle
}

// Zone coordinates tuned to match the SVG viewBox (0 0 380 240)
const CLICK_ZONES: Record<TurbinePartId, ClickZone> = {
  wind:         { shape: "rect",   coords: [15, 68, 60, 30] },
  nacelle:      { shape: "rect",   coords: [78, 60, 236, 50] },
  blades:       { shape: "circle", coords: [92, 85, 32] },
  hub:          { shape: "circle", coords: [92, 85, 12] },
  shaft:        { shape: "rect",   coords: [96, 77, 38, 16] },
  bearing:      { shape: "circle", coords: [130, 85, 18] },
  brake:        { shape: "rect",   coords: [136, 74, 14, 22] },
  gearbox:      { shape: "rect",   coords: [146, 68, 50, 34] },
  generator:    { shape: "rect",   coords: [196, 68, 73, 34] },
  converter:    { shape: "rect",   coords: [268, 72, 38, 26] },
  cooler:       { shape: "rect",   coords: [236, 52, 58, 16] },
  anemometer:   { shape: "circle", coords: [300, 57, 8] },
  power_output: { shape: "rect",   coords: [150, 42, 80, 18] },
  yaw:          { shape: "circle", coords: [175, 170, 16] },
  tower:        { shape: "rect",   coords: [160, 150, 30, 62] },
  foundation:   { shape: "rect",   coords: [153, 204, 44, 30] },
};

// Render order: nacelle first (background catch-all), then specific parts on top.
// New parts inserted in drivetrain order; cooler/anemometer/power_output after nacelle.
const RENDER_ORDER: TurbinePartId[] = [
  "nacelle",
  "wind",
  "power_output",
  "cooler",
  "anemometer",
  "blades",
  "hub",
  "shaft",
  "bearing",
  "brake",
  "gearbox",
  "generator",
  "converter",
  "yaw",
  "tower",
  "foundation",
];

interface CrossSectionClickZonesProps {
  onPartClick: (partId: TurbinePartId) => void;
  activePart: TurbinePartId | null;
  faultPartId: TurbinePartId | null;
  curtailmentPartId: TurbinePartId | null;
}

export default function CrossSectionClickZones({
  onPartClick,
  activePart,
  faultPartId,
  curtailmentPartId,
}: CrossSectionClickZonesProps) {
  return (
    <g>
      {RENDER_ORDER.map((partId) => {
        const zone = CLICK_ZONES[partId];
        const isActive = activePart === partId;
        const isFault = faultPartId === partId;
        const isCurtailed = curtailmentPartId === partId;

        const className = [
          "cross-section-zone",
          isActive ? "cross-section-zone-active" : "",
        ]
          .filter(Boolean)
          .join(" ");

        if (zone.shape === "circle") {
          const [cx, cy, r] = zone.coords;
          return (
            <g
              key={partId}
              className={className}
              onClick={(e) => {
                e.stopPropagation();
                onPartClick(partId);
              }}
            >
              {/* Fault ring (behind click target) */}
              {isFault && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={r + 3}
                  className="cross-section-fault-ring"
                />
              )}
              {/* Curtailment ring (behind click target) */}
              {isCurtailed && !isFault && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={r + 3}
                  className="cross-section-curtail-ring"
                />
              )}
              {/* Highlight ring */}
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill="transparent"
                className="zone-highlight"
                stroke="transparent"
                strokeWidth={1}
              />
            </g>
          );
        }

        // rect
        const [x, y, w, h] = zone.coords;
        return (
          <g
            key={partId}
            className={className}
            onClick={(e) => {
              e.stopPropagation();
              onPartClick(partId);
            }}
          >
            {/* Fault ring (behind click target) */}
            {isFault && (
              <rect
                x={x - 3}
                y={y - 3}
                width={w + 6}
                height={h + 6}
                rx={4}
                className="cross-section-fault-ring"
              />
            )}
            {/* Curtailment ring (behind click target) */}
            {isCurtailed && !isFault && (
              <rect
                x={x - 3}
                y={y - 3}
                width={w + 6}
                height={h + 6}
                rx={4}
                className="cross-section-curtail-ring"
              />
            )}
            {/* Highlight rect */}
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              rx={3}
              fill="transparent"
              className="zone-highlight"
              stroke="transparent"
              strokeWidth={1}
            />
          </g>
        );
      })}
    </g>
  );
}
