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
 *
 * Scope: the 16 markers below are the IEC 61400-25 CMS subset rendered in 3D.
 * The full SCADA register (387 instrument tags) lives in
 * backend/app/services/p0/sensor_register.py — this subset is a curated
 * visualisation layer, not a desync.
 *
 * Live read-outs: every sensor with a simulated signal shows its value in the
 * leader label and hover tooltip — temperatures from model/nacelleThermal
 * (same numbers as the thermal overlay), vibration + ISO 10816-21 zone, HPU
 * pressures and cable twist from the backend nacelle subsystems, yaw and
 * wind from the farm simulation. Out-of-limit values turn amber / red.
 *
 * Rendering improvements (2026-04-24):
 *   - Shrunk radius 0.40 → 0.12 m (realistic sensor housing)
 *   - Pulsing emissive via useFrame sine (draws the eye to live sensors)
 *   - Distance LOD: >80 m → single cluster glyph, ≤40 m → hover labels
 *   - onPointerOver HTML tooltip with tag ID + sensor label
 *   - Selected-part emphasis: boost radius + emissive for matching sensors
 */

import { useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";

import type { TurbinePartId } from "../../../../constants/turbinePartEducation";
import { onShaft, PARTS, SHAFT_Z } from "../model/layout";
import {
  selectTurbine,
  selectTurbinePart,
  useLandingStore,
} from "../../../../store/landingStore";
import { selectNacelleData, useNacelleSubsystemsStore } from "../../../../store/nacelleSubsystemsStore";
import { nacelleTemperatures, type ThermalReading } from "../model/nacelleThermal";

interface SensorMarkersProps {
  turbineId: string;
  /** Propagate click to the global part-selection system. */
  onSelectPart: (id: TurbinePartId) => void;
}

/** Live value of one sensor, formatted with its unit. */
interface SensorReading {
  text: string;
  state: "ok" | "alarm" | "trip";
}

/** Value colour: theme text when in range, amber / red past the limits. */
const READING_CLASS: Record<SensorReading["state"], string> = {
  ok: "text-text-primary",
  alarm: "text-amber-500",
  trip: "text-red-500",
};

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
  temperature: "#ef4444",
  vibration:   "#f59e0b",
  pressure:    "#3b82f6",
  encoder:     "#22c55e",
};

const SENSOR_EMISSIVE: Record<SensorType, string> = {
  temperature: "#7f1d1d",
  vibration:   "#78350f",
  pressure:    "#1e3a8a",
  encoder:     "#14532d",
};

const SENSORS: Sensor[] = [
  { id: "ms-bearing-temp",    label: "Main Bearing Temp (PT100)",   type: "temperature", position: onShaft(SHAFT_Z.frontBearing, 0.9, 2.4), partId: "bearing"   },
  { id: "ms-bearing-vib",     label: "Main Bearing Vibration",      type: "vibration",   position: onShaft(SHAFT_Z.frontBearing, -0.9, 2.4), partId: "bearing"   },
  { id: "rb-bearing-temp",    label: "Rear Bearing Temp (PT100)",   type: "temperature", position: onShaft(SHAFT_Z.rearBearing, 0.9, 2.4), partId: "bearing"   },
  { id: "brake-pressure",     label: "Rotor Brake Pressure",        type: "pressure",    position: PARTS.brake, partId: "brake"     },
  { id: "coolant-pressure",   label: "Coolant Loop Pressure",       type: "pressure",    position: [PARTS.coolantSkid[0] - 0.4, PARTS.coolantSkid[1] + 0.6, PARTS.coolantSkid[2]], partId: "generator" },
  { id: "gen-winding-temp",   label: "Gen Winding Temp U-phase",    type: "temperature", position: onShaft(SHAFT_Z.generator, 1.2, 4.7), partId: "generator" },
  { id: "conv-coolant-temp",  label: "Converter Coolant Outlet Temp", type: "temperature", position: [PARTS.converter[0] + 0.5, PARTS.converter[1] + 1.3, PARTS.converter[2] + 2.0], partId: "converter"},
  { id: "gen-vib",            label: "Generator / Rear Bearing Vibration (IEPE)", type: "vibration", position: onShaft(SHAFT_Z.statorDisc, 0.0, 4.4), partId: "generator" },
  { id: "hpu-pressure",       label: "HPU Line Pressure",           type: "pressure",    position: [PARTS.hpu[0], PARTS.hpu[1] + 0.8, PARTS.hpu[2]], partId: "hpu"       },
  { id: "pitch-pressure",     label: "Pitch Accumulator Pressure",     type: "pressure",    position: [PARTS.hpu[0] - 0.8, PARTS.hpu[1] + 0.6, PARTS.hpu[2] + 0.4], partId: "hpu"       },
  { id: "conv-p-temp",        label: "Converter (Port) Temp",       type: "temperature", position: [PARTS.converter[0] + 0.5, PARTS.converter[1] + 1.3, PARTS.converter[2] + 1.0], partId: "converter"},
  { id: "conv-s-temp",        label: "Converter (Stbd) Temp",       type: "temperature", position: [PARTS.converter[0] + 0.5, PARTS.converter[1] + 1.3, PARTS.converter[2] - 1.0], partId: "converter"},
  { id: "trafo-temp",         label: "Transformer Winding Temp",       type: "temperature", position: [PARTS.transformer[0], PARTS.transformer[1] + 1.5, PARTS.transformer[2] - 0.5], partId: "transformer"},
  { id: "yaw-encoder",        label: "Nacelle Position Encoder",    type: "encoder",     position: [0.0, 148.0, 3.0],   partId: "yaw"      },
  { id: "yaw-twist",          label: "Cable Twist Counter",         type: "encoder",     position: [0.5, 147.6, 0.0],   partId: "cable_routing"},
  { id: "wind-speed",         label: "Nacelle Anemometer",          type: "encoder",     position: [0.0, 158.5, -6.0],  partId: "anemometer"},
];

/** Callout-leader sensor IDs — always-on labels for key education sensors. */
const LEADER_SENSOR_IDS = new Set(["ms-bearing-temp", "gen-winding-temp", "conv-coolant-temp"]);

const RADIUS = 0.12;
const RADIUS_SELECTED = 0.20;
const RADIUS_CLUSTER = 0.80;
const LOD_HIDE = 80;
const LOD_LABEL = 40;

// Centroid used for the aggregated cluster glyph at long distances.
const NACELLE_CENTROID: [number, number, number] = onShaft(SHAFT_Z.statorDisc);

const CENTROID_V = new THREE.Vector3(...NACELLE_CENTROID);

const tempReading = (r: ThermalReading): SensorReading => ({ text: `${r.tempC.toFixed(1)} °C`, state: r.state });

/** Live readings keyed by sensor id (sensors without a simulated signal are absent). */
function useSensorReadings(turbineId: string): Record<string, SensorReading> {
  const t = useLandingStore(selectTurbine(turbineId));
  const airC = useLandingStore((s) => s.environment.airTemperatureC);
  const live = useNacelleSubsystemsStore(selectNacelleData(turbineId));
  return useMemo(() => {
    const out: Record<string, SensorReading> = {};
    if (!t) return out;
    const th = nacelleTemperatures({
      powerMW: t.powerOutputMW,
      airC,
      bearingC: t.bearingTempC,
      windingC: live?.cooling?.winding_temp_c,
    });
    out["ms-bearing-temp"] = tempReading(th.mainBearing);
    out["rb-bearing-temp"] = tempReading(th.rearBearing);
    out["gen-winding-temp"] = tempReading(th.generator);
    out["conv-coolant-temp"] = tempReading(th.converter);
    out["conv-p-temp"] = tempReading(th.converter);
    out["conv-s-temp"] = tempReading(th.converter);
    out["trafo-temp"] = tempReading(th.transformer);
    const zone = live?.safety?.vibration_zone;
    out["ms-bearing-vib"] = {
      text: `${t.vibrationMmS.toFixed(1)} mm/s${zone ? ` · zone ${zone}` : ""}`,
      state: live?.safety?.vibration_trip ? "trip" : live?.safety?.vibration_alarm ? "alarm" : "ok",
    };
    if (live?.hpu) {
      out["hpu-pressure"] = { text: `${live.hpu.line_pressure_bar.toFixed(0)} bar`, state: live.hpu.alarm ? "alarm" : "ok" };
      out["pitch-pressure"] = {
        text: `${live.hpu.accumulator_pressure_bar.toFixed(0)} bar · ${live.hpu.accumulator_charge_pct.toFixed(0)} %`,
        state: live.hpu.alarm ? "alarm" : "ok",
      };
    }
    if (live?.cable_twist) {
      const ct = live.cable_twist;
      out["yaw-twist"] = {
        text: `${ct.twist_turns >= 0 ? "+" : ""}${ct.twist_turns.toFixed(2)} turns`,
        state: ct.hard_limit_reached ? "trip" : ct.soft_limit_reached ? "alarm" : "ok",
      };
    }
    out["yaw-encoder"] = { text: `${t.nacellePositionDeg.toFixed(0)}°`, state: "ok" };
    out["wind-speed"] = { text: `${t.windSpeedMs.toFixed(1)} m/s`, state: "ok" };
    return out;
  }, [t, airC, live]);
}

export function SensorMarkers({ turbineId, onSelectPart }: SensorMarkersProps) {
  const { camera } = useThree();
  const distanceRef = useRef(0);
  const [lod, setLod] = useState<"hidden" | "spheres" | "labelled">("labelled");
  const selectedPart = useLandingStore(selectTurbinePart);
  const readings = useSensorReadings(turbineId);

  useFrame(() => {
    const d = camera.position.distanceTo(CENTROID_V);
    distanceRef.current = d;
    const next = d > LOD_HIDE ? "hidden" : d > LOD_LABEL ? "spheres" : "labelled";
    setLod((prev) => (prev === next ? prev : next));
  });

  if (lod === "hidden") {
    return (
      <group name="sensor-markers">
        <ClusterGlyph position={NACELLE_CENTROID} count={SENSORS.length} />
      </group>
    );
  }

  return (
    <group name="sensor-markers">
      {SENSORS.map((s) => (
        <SensorSphere
          key={s.id}
          sensor={s}
          reading={readings[s.id]}
          onSelect={onSelectPart}
          enableHover={lod === "labelled"}
          showLeader={lod === "labelled" && LEADER_SENSOR_IDS.has(s.id)}
          selected={selectedPart === s.partId}
        />
      ))}
    </group>
  );
}

function ClusterGlyph({
  position,
  count,
}: {
  position: [number, number, number];
  count: number;
}) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (!matRef.current) return;
    matRef.current.emissiveIntensity = 0.6 + Math.sin(clock.elapsedTime * 2.2) * 0.25;
  });
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[RADIUS_CLUSTER, 20, 16]} />
        <meshStandardMaterial
          ref={matRef}
          color="#38bdf8"
          emissive="#0c4a6e"
          emissiveIntensity={0.6}
          roughness={0.3}
          metalness={0.3}
        />
      </mesh>
      <Html center distanceFactor={60} style={{ pointerEvents: "none" }}>
        <div className="text-[10px] font-mono text-sky-200 bg-black/70 px-1.5 py-0.5 rounded border border-sky-500/40 whitespace-nowrap">
          {count} sensors
        </div>
      </Html>
    </group>
  );
}

function SensorSphere({
  sensor,
  reading,
  onSelect,
  enableHover,
  showLeader,
  selected,
}: {
  sensor: Sensor;
  reading?: SensorReading;
  onSelect: (id: TurbinePartId) => void;
  enableHover: boolean;
  showLeader: boolean;
  selected: boolean;
}) {
  const colour = SENSOR_COLOUR[sensor.type];
  const emissive = SENSOR_EMISSIVE[sensor.type];
  const [hover, setHover] = useState(false);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  const radius = selected ? RADIUS_SELECTED : RADIUS;
  const basePulse = selected ? 1.0 : 0.55;

  useFrame(({ clock }) => {
    if (!matRef.current) return;
    // Stagger the pulse phase per sensor so the group flickers organically.
    const phase = sensor.position[0] * 1.3 + sensor.position[2] * 0.9;
    matRef.current.emissiveIntensity =
      basePulse + Math.sin(clock.elapsedTime * 2.4 + phase) * 0.2;
  });

  const showTooltip = enableHover && hover;

  return (
    <group position={sensor.position}>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onSelect(sensor.partId);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = "";
        }}
        name={sensor.id}
      >
        <sphereGeometry args={[radius, 16, 12]} />
        <meshStandardMaterial
          ref={matRef}
          color={colour}
          emissive={emissive}
          emissiveIntensity={basePulse}
          roughness={0.3}
          metalness={0.6}
        />
      </mesh>

      {showTooltip && (
        <Html
          position={[0, radius + 0.2, 0]}
          center
          distanceFactor={18}
          style={{ pointerEvents: "none" }}
        >
          <div
            className="text-[10px] font-mono text-text-primary bg-bg-secondary/95 px-2 py-1 rounded border border-border-primary whitespace-nowrap shadow-lg shadow-black/60"
            style={{ borderLeft: `3px solid ${colour}` }}
          >
            <div className="font-semibold">{sensor.label}</div>
            {reading && (
              <div className={`text-[13px] font-bold tabular-nums ${READING_CLASS[reading.state]}`}>
                {reading.text}
              </div>
            )}
            <div className="text-text-muted text-[9px]">
              {sensor.id} · {sensor.type}
            </div>
          </div>
        </Html>
      )}

      {showLeader && !hover && (
        <Html
          position={[0, 1.2, 0]}
          center
          distanceFactor={22}
          style={{ pointerEvents: "none" }}
        >
          <div className="flex flex-col items-center">
            <div
              className="w-px bg-slate-400/60"
              style={{ height: "18px" }}
            />
            <div
              className="text-[9px] font-mono text-text-muted bg-bg-secondary/80 px-1.5 py-0.5 rounded border border-border-primary whitespace-nowrap"
              style={{ borderLeft: `2px solid ${colour}` }}
            >
              {sensor.label.split(" (")[0]}
              {reading && (
                <span className={`ml-1 font-semibold tabular-nums ${READING_CLASS[reading.state]}`}>
                  {reading.text}
                </span>
              )}
            </div>
          </div>
        </Html>
      )}
    </group>
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
    <div className="flex w-60 flex-col gap-0.5 rounded-md border border-border-primary bg-bg-secondary/90 px-2.5 py-1.5 shadow backdrop-blur-sm">
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
