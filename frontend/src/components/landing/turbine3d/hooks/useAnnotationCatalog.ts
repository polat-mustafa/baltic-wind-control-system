/**
 * Builds the full annotation list for a given turbine by combining
 * static dimension/component annotations with live telemetry annotations.
 *
 * Live values come from the Zustand store via selectTurbine(id).
 * The hook returns a stable reference when nothing changes.
 */

import { useMemo } from "react";

import { selectTurbine, useLandingStore } from "../../../../store/landingStore";
import {
  STATIC_ANNOTATIONS,
  type Annotation,
} from "../data/annotationCatalog";

export function useAnnotationCatalog(turbineId: string): Annotation[] {
  const t = useLandingStore(selectTurbine(turbineId));

  return useMemo<Annotation[]>(() => {
    if (!t) return STATIC_ANNOTATIONS;

    const live: Annotation[] = [
      {
        id: "tel:power",
        kind: "telemetry",
        category: "electrical",
        anchor: [3, 154, 0],
        label: () => `${t.powerOutputMW.toFixed(1)} MW`,
        relatedPartId: "generator",
        detail: {
          title: "Active power output",
          value: () => `${t.powerOutputMW.toFixed(2)} MW`,
          unit: "MW",
          formula: "P = ½ ρ A v³ Cp",
          source: "Live simulation store",
          description:
            "Power delivered to the 66 kV array cable. Cubic wind-speed dependency means a 10% wind increase gives ~33% more power.",
        },
      },
      {
        id: "tel:wind",
        kind: "telemetry",
        category: "kinematic",
        anchor: [0, 158, 2],
        label: () => `${t.windSpeedMs.toFixed(1)} m/s`,
        relatedPartId: "anemometer",
        detail: {
          title: "Hub-height wind speed",
          value: () => `${t.windSpeedMs.toFixed(2)} m/s`,
          unit: "m/s",
          source: "Cup anemometer (live)",
          description:
            "Wind speed at hub height (150 m MSL). Rated wind speed is 12.5 m/s — the turbine produces full 15 MW above this.",
        },
      },
      {
        id: "tel:rpm",
        kind: "telemetry",
        category: "kinematic",
        anchor: [-2, 150, 2],
        label: () => `${t.rotorSpeedRpm.toFixed(2)} rpm`,
        relatedPartId: "blades",
        detail: {
          title: "Rotor speed",
          value: () => `${t.rotorSpeedRpm.toFixed(2)} rpm (rated 9.55)`,
          unit: "rpm",
          formula: "ω = 2π · n / 60 (rad/s)",
          source: "Live simulation store",
          description:
            "Variable speed operation allows the rotor to operate at optimal tip-speed ratio across a range of wind speeds.",
        },
      },
      {
        id: "tel:bearing-temp",
        kind: "telemetry",
        category: "thermal",
        anchor: [1, 152, 2],
        label: () => `${t.bearingTempC.toFixed(0)} °C`,
        relatedPartId: "bearing",
        detail: {
          title: "Main bearing temperature",
          value: () => `${t.bearingTempC.toFixed(1)} °C`,
          unit: "°C",
          source: "CMS sensor (live)",
          description:
            "Warning threshold: 65 °C. Alarm: 80 °C. Elevated temperature indicates lubrication degradation or misalignment.",
        },
      },
      {
        id: "tel:pitch",
        kind: "telemetry",
        category: "kinematic",
        anchor: [-3, 150, 1],
        label: () => `β = ${t.pitchAngleDeg.toFixed(1)}°`,
        relatedPartId: "blades",
        detail: {
          title: "Blade pitch angle",
          value: () => `${t.pitchAngleDeg.toFixed(1)}°`,
          unit: "°",
          formula: "β = 0 below rated, increases above rated to limit P to 15 MW",
          source: "Pitch controller (live)",
          description:
            "Fine pitch (0°) captures maximum wind; feathered (90°) stops the rotor. Between rated and cut-out, pitch actively limits power.",
        },
      },
      {
        id: "tel:yaw",
        kind: "telemetry",
        category: "kinematic",
        anchor: [0, 147, 3],
        label: () => `θ = ${t.nacellePositionDeg.toFixed(0)}°`,
        relatedPartId: "yaw",
        detail: {
          title: "Nacelle yaw position",
          value: () => `${t.nacellePositionDeg.toFixed(1)}° (compass)`,
          unit: "°",
          source: "Yaw encoder (live)",
          description:
            "Nacelle faces the wind direction. Yaw error >15° causes measurable energy loss — closed-loop yaw control minimises misalignment.",
        },
      },
    ];

    return [...STATIC_ANNOTATIONS, ...live];
  }, [
    t?.powerOutputMW,
    t?.windSpeedMs,
    t?.rotorSpeedRpm,
    t?.bearingTempC,
    t?.pitchAngleDeg,
    t?.nacellePositionDeg,
  ]);
}
