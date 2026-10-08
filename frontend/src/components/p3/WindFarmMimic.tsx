/**
 * Wind Farm Plant Mimic — operator's primary surface in Operations area.
 *
 * Stylised process schematic of the live fleet (NOT geographically accurate):
 *   • one row of TurbineCells per string on the left (SB-510: 6 rows, 34 turbines)
 *   • Vertical 66 kV bus collecting all strings
 *   • Offshore Substation (66 / 220 kV, STATCOM, shunt reactors)
 *   • n × 220 kV export cables (drawn as one route, animated when energised)
 *   • Onshore substation (220 / 400 kV)
 *   • PSE 400 kV grid connection
 *
 * Click any turbine → TurbineFaceplate modal.
 * The mimic and faceplate consume the same store (landingStore + scadaStore)
 * so live values, fault states, and alarms stay in lockstep with the SLD.
 */

import { useMemo, useState } from "react";
import { Cable, Factory, Power, Wind } from "lucide-react";

import { useLandingStore } from "../../store/landingStore";
import { usePlantSnapshot } from "../../store/liveGridStore";
import { plantNet } from "../../utils/landingPhysics";
import { useFleet } from "../../lib/fleet";
import { mimicLayout } from "../../constants/mimicLayout";

import TurbineCell from "./TurbineCell";
import TurbineFaceplate from "./TurbineFaceplate";
import MimicTerminalNode from "./MimicTerminalNode";
import MimicFlowLines from "./MimicFlowLines";

export default function WindFarmMimic() {
  const fleet = useFleet();
  // One row per string, turbines in id order
  const TURBINES_BY_STRING = useMemo(
    () => fleet.strings.map((ids) => [...ids].sort((a, b) => a.localeCompare(b))),
    [fleet],
  );
  const net = plantNet(fleet);
  const turbineMap = useLandingStore((s) => s.turbineMap);
  const transformer = useLandingStore((s) => s.transformers["OSS-TX1"]);
  const onshoreT = useLandingStore((s) => s.transformers["ONS-TX1"]);
  const kpis = useLandingStore((s) => s.kpis);
  const plant = usePlantSnapshot();
  const signed = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(0)}`;

  const [openTurbine, setOpenTurbine] = useState<string | null>(null);

  // Per-string energisation: any operating turbine in the string ⇒ live
  const stringEnergised = useMemo(
    () =>
      TURBINES_BY_STRING.map((ids) =>
        ids.some((id) => turbineMap[id]?.status === "operating"),
      ),
    [turbineMap, TURBINES_BY_STRING],
  );

  const anyOperating = stringEnergised.some(Boolean);
  const exportEnergised = anyOperating; // 220 kV live whenever any turbine running
  const gridEnergised = anyOperating;   // 400 kV likewise

  const L = useMemo(() => mimicLayout(TURBINES_BY_STRING.map((ids) => ids.length)), [TURBINES_BY_STRING]);

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      {/* Header strip */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 px-3 py-1.5 border-b border-border-primary bg-bg-tertiary shrink-0">
        <div className="flex items-center gap-2">
          <Wind size={12} className="text-text-muted" />
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
            Plant Mimic · Operations
          </h3>
          <span className="hidden md:inline text-[10px] text-text-muted font-mono">
            {fleet.turbines.length} × 15 MW V236 class (IEA 15 MW) · {net.ratedMW.toFixed(0)} MW · 66 / 220 / 400 kV
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono text-text-secondary">
          <span>
            Σ WTG{" "}
            <span className="text-text-primary">
              {kpis.totalOutputMW.toFixed(1)}
            </span>{" "}
            MW
          </span>
          <span>
            f_grid{" "}
            <span className="text-text-primary">
              {kpis.gridFrequencyHz.toFixed(3)}
            </span>{" "}
            Hz
          </span>
          <span>
            Avail{" "}
            <span className="text-text-primary">
              {kpis.availabilityPercent.toFixed(1)}
            </span>{" "}
            %
          </span>
        </div>
      </div>

      {/* Mimic canvas — fixed-pixel layout for industrial-HMI predictability.
          Wrapped in a scroll container so smaller viewports remain usable. */}
      <div className="flex-1 min-h-0 overflow-auto p-2">
        <div
          className="relative mx-auto"
          style={{ width: L.width, height: L.height }}
        >
          {/* Flow lines — drawn first so cells render on top */}
          <MimicFlowLines
            stringEnergised={stringEnergised}
            exportEnergised={exportEnergised}
            gridEnergised={gridEnergised}
            layout={L}
            exportLabel={`220 kV · ${net.exportKm.toFixed(0)} km`}
          />

          {/* String rows */}
          {TURBINES_BY_STRING.map((ids, row) => {
            const rowY =
              L.stringStartY + row * (L.cellH + L.rowGapY);
            return (
              <div
                key={row}
                className="absolute flex items-start gap-1"
                style={{
                  left: L.stringStartX,
                  top: rowY,
                }}
              >
                <div
                  className="absolute -left-9 top-1/2 -translate-y-1/2
                             text-[9px] font-mono uppercase tracking-wider text-text-muted
                             pointer-events-none select-none"
                  style={{ width: 32 }}
                >
                  Str {row + 1}
                </div>
                {ids.map((id) => (
                  <TurbineCell
                    key={id}
                    turbineId={id}
                    onOpen={setOpenTurbine}
                  />
                ))}
              </div>
            );
          })}

          {/* OSS terminal node */}
          <div
            className="absolute"
            style={{
              left: L.ossX,
              top: L.ossY,
              width: L.ossW,
              minWidth: L.ossW,
            }}
          >
            <MimicTerminalNode
              label="OSS · 66 / 220 kV"
              voltageStep="66 → 220 kV"
              throughput={{
                value: kpis.totalOutputMW.toFixed(0),
                unit: "MW",
              }}
              status={anyOperating ? "energised" : "deenergised"}
              icon={<Factory size={12} />}
              rows={[
                {
                  label: "T-oil",
                  value: transformer
                    ? transformer.oilTemperatureC.toFixed(0)
                    : "—",
                  unit: "°C",
                },
                {
                  label: "TX load",
                  value: plant.ossTrafoPct.toFixed(0),
                  unit: "%",
                },
                {
                  label: "Cooling",
                  value: transformer ? transformer.coolingStatus : "—",
                },
                {
                  label: "Tap",
                  value: transformer
                    ? `${transformer.tapPosition}/${transformer.totalTaps}`
                    : "—",
                },
                { label: "STATCOM", value: signed(plant.statcomMVAr), unit: "MVAr" },
                {
                  label: "Reactors",
                  value: `${plant.reactorsInService} × ${net.reactorUnitMVAr}`,
                  unit: "MVAr",
                },
              ]}
              className="w-full max-w-none"
            />
          </div>

          {/* Onshore terminal node */}
          <div
            className="absolute"
            style={{
              left: L.onshoreX,
              top: L.onshoreY,
              width: L.onshoreW,
              minWidth: L.onshoreW,
            }}
          >
            <MimicTerminalNode
              label="Onshore · 220 / 400 kV"
              voltageStep="220 → 400 kV"
              throughput={{
                value: plant.pocMW.toFixed(0),
                unit: "MW",
              }}
              status={exportEnergised ? "energised" : "deenergised"}
              icon={<Cable size={12} />}
              rows={[
                {
                  label: "T-oil",
                  value: onshoreT
                    ? onshoreT.oilTemperatureC.toFixed(0)
                    : "—",
                  unit: "°C",
                },
                {
                  label: "TX load",
                  value: plant.onshoreTrafoPct.toFixed(0),
                  unit: "%",
                },
                {
                  label: "Export cable",
                  value: plant.exportCablePct.toFixed(0),
                  unit: "%",
                },
              ]}
              className="w-full max-w-none"
            />
          </div>

          {/* PSE Grid terminal node */}
          <div
            className="absolute"
            style={{
              left: L.gridX,
              top: L.gridY,
              width: L.gridW,
              minWidth: L.gridW,
            }}
          >
            <MimicTerminalNode
              label="PSE Grid · 400 kV"
              voltageStep="Connection point"
              throughput={{
                value: plant.pocMW.toFixed(1),
                unit: "MW",
              }}
              status={gridEnergised ? "energised" : "deenergised"}
              icon={<Power size={12} />}
              rows={[
                { label: "Q", value: signed(plant.pocMVAr), unit: "MVAr" },
                { label: "U", value: plant.pocKV.toFixed(1), unit: "kV" },
                { label: "f", value: plant.frequencyHz.toFixed(3), unit: "Hz" },
              ]}
              className="w-full max-w-none"
            />
          </div>
        </div>
      </div>

      {/* Operator faceplate */}
      <TurbineFaceplate
        turbineId={openTurbine}
        onClose={() => setOpenTurbine(null)}
      />
    </div>
  );
}
