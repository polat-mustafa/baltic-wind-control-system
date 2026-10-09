/**
 * Open-data constraint layers (MSP basins, Natura 2000, wind farms, cables…)
 * as deck.gl GeoJSON layers, shared by the Site screening map and the Layout
 * canvas. Each feature keeps its name for the tooltip (`featureLabel`).
 */

import { PathStyleExtension } from "@deck.gl/extensions";
import { GeoJsonLayer } from "@deck.gl/layers";
import type { PickingInfo } from "@deck.gl/core";

import type { LayerInfo } from "../../services/siteApi";
import { dashArray, rgba } from "../map/deckUtils";
import { SCADA_COLORS } from "../../constants/scadaColors";
import type { RoleStyle } from "./mapStyles";

const DASH = [new PathStyleExtension({ dash: true })];

type Feature = LayerInfo["features"][number];

/** Tooltip text: the feature name plus capacity / status when the data has them. */
export function featureLabel(f: Feature): string {
  const p = f.properties;
  const extra = [
    typeof p.use === "string" ? `${p.use} port` : "",
    typeof p.power_mw === "number" ? `${p.power_mw} MW` : "",
    typeof p.rating_mva === "number" && p.rating_mva > 0 ? `${p.rating_mva} MVA` : "",
    typeof p.status === "string" ? p.status : "",
  ].filter(Boolean);
  return extra.length ? `${f.name} (${extra.join(", ")})` : f.name;
}

/** Transmission lines keep the SLD voltage colours (400 kV red, 220 kV blue). */
function lineColor(f: Feature, fallback: string): string {
  const kv = f.properties.voltage_kv;
  if (typeof kv !== "number") return fallback;
  return kv >= 380 ? SCADA_COLORS.VOLTAGE_400KV : kv >= 220 ? SCADA_COLORS.VOLTAGE_220KV : fallback;
}

/** One open-data layer drawn in its role style (fill, outline, dash; points as ringed dots). */
export function roleLayer(layer: LayerInfo, style: RoleStyle) {
  return new GeoJsonLayer({
    id: `role-${layer.id}`,
    data: {
      type: "FeatureCollection",
      features: layer.features.map((f) => ({ type: "Feature" as const, geometry: f.geometry, properties: { feature: f } })),
    },
    filled: true,
    stroked: true,
    pointType: "circle",
    getFillColor: (d: { geometry: { type: string } }) => (d.geometry.type === "Point" ? rgba(style.color) : rgba(style.color, style.fill)),
    getLineColor: (d: { geometry: { type: string }; properties: { feature: Feature } }) =>
      d.geometry.type === "Point" ? [255, 255, 255, 255] : rgba(lineColor(d.properties.feature, style.color)),
    getLineWidth: (d: { geometry: { type: string } }) => (d.geometry.type === "LineString" ? 2 : 1.2),
    lineWidthUnits: "pixels",
    getPointRadius: 5,
    pointRadiusUnits: "pixels",
    getDashArray: dashArray(style.dash),
    extensions: DASH,
    pickable: true,
  });
}

/** Tooltip for any layer whose objects carry `properties.feature` (the role layers). */
export function roleTooltip(info: PickingInfo): string | null {
  const f = (info.object as { properties?: { feature?: Feature } } | undefined)?.properties?.feature;
  if (!f) return null;
  return f.geometry.type === "LineString" ? f.name : featureLabel(f);
}
