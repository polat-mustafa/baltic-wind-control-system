/**
 * D2 — Sensor Marker Overlay
 *
 * Renders small sphere markers at each CMS sensor location inside the nacelle.
 * Sensors are colour-coded by type following the IEC 61400-25 CMS data model:
 *
 *   PT100 temperature  → red    (#ef4444)
 *   IEPE vibration     → amber  (#f59e0b)
 *   Pressure (HPU)     → blue   (#3b82f6)
 *   Encoder/position   → green  (#22c55e)
 *
 * Clicking a marker selects the nearest turbine part (wires into the existing
 * fly-to and education popup system).
 *
 * Sensor placement follows IEC 61400-25-4 condition monitoring data objects:
 *   DriveTrainSpeed, GearBearingTemp, GenBearingTemp, GenPhaseVoltage,
 *   HydBrakePressure, HydPitchPressure, NacelleVibration, RotorBearingTemp
 */

import type { TurbinePartId } from "../../../../constants/turbinePartEducation";

interface SensorMarkersProps {
  /** Propagate click to the global part-selection system. */
  onSelectPart: (id: TurbinePartId) => void;
}

type SensorType = "temperature" | "vibration" | "pressure" | "encoder";

interface Sensor {
  id: string;
  label: string;
  type: SensorType;
  position: [number, number, number];
  /** Nearest turbine part for fly-to navigation */
  partId: TurbinePartId;
}

const SENSOR_COLOUR: Record<SensorType, string> = {
  temperature: "#ef4444",  // red — PT100/Pt1000
  vibration:   "#f59e0b",  // amber — IEPE accelerometer
  pressure:    "#3b82f6",  // blue — pressure transducer
  encoder:     "#22c55e",  // green — encoder / proximity
};

const SENSOR_EMISSIVE: Record<SensorType, string> = {
  temperature: "#7f1d1d",
  vibration:   "#78350f",
  pressure:    "#1e3a8a",
  encoder:     "#14532d",
};

const SENSORS: Sensor[] = [
  // ── Main bearing
  { id: "ms-bearing-temp",    label: "Main Bearing Temp (PT100)",   type: "temperature", position: [0.8, 151.0,  1.5], partId: "bearing"   },
  { id: "ms-bearing-vib",     label: "Main Bearing Vibration",      type: "vibration",   position: [-0.8, 151.2, 1.5], partId: "bearing"   },
  // ── Gearbox
  { id: "gb-hs-bear-temp",    label: "Gearbox HS Bearing Temp",     type: "temperature", position: [0.7, 150.8, -1.5], partId: "gearbox"   },
  { id: "gb-oil-temp",        label: "Gearbox Oil Temp (PT100)",    type: "temperature", position: [-0.7, 150.5, -2.0], partId: "gearbox"  },
  { id: "gb-vib",             label: "Gearbox Vibration (IEPE)",    type: "vibration",   position: [0.0, 151.0, -1.8], partId: "gearbox"   },
  // ── Generator
  { id: "gen-winding-temp",   label: "Gen Winding Temp U-phase",    type: "temperature", position: [1.2, 151.0, -5.0], partId: "generator" },
  { id: "gen-bearing-temp",   label: "Gen Drive-End Bearing Temp",  type: "temperature", position: [-1.2, 150.8, -5.0], partId: "generator"},
  { id: "gen-vib",            label: "Gen Housing Vibration",       type: "vibration",   position: [0.0, 151.5, -5.5], partId: "generator" },
  // ── HPU
  { id: "hpu-pressure",       label: "HPU Line Pressure",           type: "pressure",    position: [3.0, 148.5,  2.0], partId: "hpu"       },
  { id: "pitch-pressure",     label: "Pitch Cylinder Pressure",     type: "pressure",    position: [2.0, 149.0,  2.5], partId: "hpu"       },
  // ── Converter
  { id: "conv-p-temp",        label: "Converter (Port) Temp",       type: "temperature", position: [-3.5, 150.0, -3.0], partId: "converter"},
  { id: "conv-s-temp",        label: "Converter (Stbd) Temp",       type: "temperature", position: [ 3.5, 150.0, -3.0], partId: "converter"},
  // ── Transformer
  { id: "trafo-temp",         label: "Transformer Core Temp",       type: "temperature", position: [0.0, 149.5, -11.5], partId: "transformer"},
  // ── Yaw
  { id: "yaw-encoder",        label: "Nacelle Position Encoder",    type: "encoder",     position: [0.0, 148.0, 3.0],   partId: "yaw"      },
  { id: "yaw-twist",          label: "Cable Twist Counter",         type: "encoder",     position: [0.5, 148.2, 0.0],   partId: "cable_routing"},
  // ── Anemometer
  { id: "wind-speed",         label: "Nacelle Anemometer",          type: "encoder",     position: [0.0, 157.5, -6.0],  partId: "anemometer"},
];

const RADIUS = 0.22;

export function SensorMarkers({ onSelectPart }: SensorMarkersProps) {
  return (
    <group name="sensor-markers">
      {SENSORS.map((s) => (
        <SensorSphere key={s.id} sensor={s} onSelect={onSelectPart} />
      ))}
    </group>
  );
}

function SensorSphere({
  sensor,
  onSelect,
}: {
  sensor: Sensor;
  onSelect: (id: TurbinePartId) => void;
}) {
  const colour = SENSOR_COLOUR[sensor.type];
  const emissive = SENSOR_EMISSIVE[sensor.type];

  return (
    <mesh
      position={sensor.position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(sensor.partId);
      }}
      name={sensor.id}
    >
      <sphereGeometry args={[RADIUS, 12, 8]} />
      <meshStandardMaterial
        color={colour}
        emissive={emissive}
        emissiveIntensity={0.6}
        roughness={0.3}
        metalness={0.6}
      />
    </mesh>
  );
}

/**
 * Sensor type legend — rendered as HTML outside the Canvas
 * (exported separately so TurbineViewer3D can mount it in the overlay).
 */
export function SensorLegend() {
  const entries: { type: SensorType; label: string; count: number }[] = [
    { type: "temperature", label: "PT100 Temperature", count: SENSORS.filter(s => s.type === "temperature").length },
    { type: "vibration",   label: "IEPE Vibration",    count: SENSORS.filter(s => s.type === "vibration").length   },
    { type: "pressure",    label: "Pressure",           count: SENSORS.filter(s => s.type === "pressure").length    },
    { type: "encoder",     label: "Encoder / Position", count: SENSORS.filter(s => s.type === "encoder").length    },
  ];

  return (
    <div className="absolute bottom-10 right-2 z-10 flex flex-col gap-0.5 bg-bg-secondary/80 backdrop-blur-sm rounded p-2 border border-border-primary pointer-events-none">
      <span className="text-[9px] text-text-muted font-mono mb-0.5">Sensors ({SENSORS.length})</span>
      {entries.map(({ type, label, count }) => (
        <div key={type} className="flex items-center gap-1">
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: SENSOR_COLOUR[type] }}
          />
          <span className="text-[9px] text-text-muted font-mono">{label}</span>
          <span className="text-[9px] text-text-primary font-mono ml-auto pl-2">{count}</span>
        </div>
      ))}
    </div>
  );
}
