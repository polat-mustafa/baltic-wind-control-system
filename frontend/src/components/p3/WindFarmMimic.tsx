/**
 * Wind Farm Plant Mimic — operator's primary surface in Operations area.
 *
 * Stylised process schematic (NOT geographically accurate):
 *   • 6 string rows of TurbineCells on the left (34 turbines total)
 *   • Vertical 66 kV bus collecting all strings
 *   • Offshore Substation (66 / 220 kV, ±120 MVAR STATCOM)
 *   • 220 kV export cable (45 km, animated when energised)
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
import { TURBINE_POSITIONS } from "../../constants/windFarmLayout";
import { MIMIC_LAYOUT } from "../../constants/mimicLayout";

import TurbineCell from "./TurbineCell";
import TurbineFaceplate from "./TurbineFaceplate";
import MimicTerminalNode from "./MimicTerminalNode";
import MimicFlowLines from "./MimicFlowLines";

// ── String groupings — derived once from the layout file ─────────

const TURBINES_BY_STRING: string[][] = (() => {
  const groups: Record<number, string[]> = {};
  for (const t of TURBINE_POSITIONS) {
    if (!groups[t.stringNumber]) groups[t.stringNumber] = [];
    groups[t.stringNumber].push(t.id);
  }
  return [1, 2, 3, 4, 5, 6].map((n) =>
    (groups[n] ?? []).sort((a, b) => a.localeCompare(b)),
  );
})();

export default function WindFarmMimic() {
  const turbineMap = useLandingStore((s) => s.turbineMap);
  const transformer = useLandingStore((s) => s.transformers["OSS-TX1"]);
  const onshoreT = useLandingStore((s) => s.transformers["ONS-TX1"]);
  const kpis = useLandingStore((s) => s.kpis);

  const [openTurbine, setOpenTurbine] = useState<string | null>(null);

  // Per-string energisation: any operating turbine in the string ⇒ live
  const stringEnergised = useMemo(
    () =>
      TURBINES_BY_STRING.map((ids) =>
        ids.some((id) => turbineMap[id]?.status === "operating"),
      ),
    [turbineMap],
  );

  const anyOperating = stringEnergised.some(Boolean);
  const exportEnergised = anyOperating; // 220 kV live whenever any turbine running
  const gridEnergised = anyOperating;   // 400 kV likewise

  const L = MIMIC_LAYOUT;

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      {/* Header strip */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border-primary bg-bg-tertiary shrink-0">
        <div className="flex items-center gap-2">
          <Wind size={12} className="text-text-muted" />
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
            Plant Mimic · Operations
          </h3>
          <span className="text-[10px] text-text-muted font-mono">
            34 × V236-15.0 MW · 510 MW · 66 / 220 / 400 kV
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono text-text-secondary">
          <span>
            P_total{" "}
            <span className="text-text-primary">
              {kpis.totalOutputMW.toFixed(1)}
            </span>{" "}
            MW
          </span>
          <span>
            f_grid{" "}
            <span className="text-text-primary">
              {kpis.gridFrequencyHz.toFixed(2)}
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
                  label: "Load",
                  value: transformer
                    ? transformer.loadPercent.toFixed(0)
                    : "—",
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
                { label: "Q-statcom", value: "+45", unit: "MVAR" },
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
                value: kpis.totalOutputMW.toFixed(0),
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
                  label: "Load",
                  value: onshoreT
                    ? onshoreT.loadPercent.toFixed(0)
                    : "—",
                  unit: "%",
                },
                {
                  label: "V-bus",
                  value: "402.1",
                  unit: "kV",
                },
                {
                  label: "Q-shunt",
                  value: "-50",
                  unit: "MVAR",
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
              voltageStep="400 kV bus"
              throughput={{
                value: kpis.totalOutputMW.toFixed(0),
                unit: "MW",
              }}
              status={gridEnergised ? "energised" : "deenergised"}
              icon={<Power size={12} />}
              rows={[
                {
                  label: "f",
                  value: kpis.gridFrequencyHz.toFixed(2),
                  unit: "Hz",
                },
                { label: "PoC", value: "Słupsk-Wielkopolska" },
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
