/**
 * Loss cascade HUD — Sankey-style breakdown from freestream kinetic power
 * to grid power. Teaches the chain of conversions that dictate LCOE.
 *
 * Stages (each row shows % of the immediately previous stage):
 *   1. Freestream kinetic power   100 %
 *   2. After wake loss             −12.4 % (Horns Rev I baseline)
 *   3. After blockage              −0.5 %
 *   4. Cp at rated                 ×0.42    (IEA 15 MW table: 15.66 MW shaft / 37.3 MW in the disk)
 *   5–7. Generator / converter / transformer efficiencies (direct drive, no
 *        gearbox) — the same V236_ETA values as the detail panel and the schematic
 *        (utils/landingPhysics, single source).
 *   9. Availability                ×0.95    (industry target; framework IEC 61400-26)
 *   → Grid power
 *
 * Click any row to highlight the corresponding 3D component.
 * Click the (?) icon on any row to open its citation.
 *
 * No plotly — pure HTML/Tailwind bars for zero GPU cost.
 */

import { useMemo } from "react";
import { X, HelpCircle } from "lucide-react";

import { useLandingStore } from "../../../../store/landingStore";
import type { TurbinePartId } from "../../../../constants/turbinePartEducation";
import { V236, V236_ETA, v236PowerChain } from "../../../../utils/landingPhysics";

interface LossBreakdownHUDProps {
  onClose: () => void;
}

interface Stage {
  label: string;
  fraction: number;          // remaining fraction of freestream power
  color: string;
  partId?: TurbinePartId;
  note?: string;
  citation?: { source: string; url: string };
}

export function LossBreakdownHUD({ onClose }: LossBreakdownHUDProps) {
  const setSelectedPart = useLandingStore((s) => s.setSelectedTurbinePart);

  const stages = useMemo<Stage[]>(() => {
    // Chain loss ratios; compound them into remaining-fraction column.
    // Published references cited per stage — see the (?) links at runtime.
    const wake = 1 - 0.124;          // Horns Rev I offshore baseline
    const block = wake * (1 - 0.005);
    const cpRated = v236PowerChain(V236.ratedMW, V236.ratedMs, V236.ratedRpm).cp;
    const cp = block * cpRated;
    const generator = cp * V236_ETA.generator;
    const converter = generator * V236_ETA.converter;
    const transformer = converter * V236_ETA.transformer;
    const pct = (x: number) => `${(x * 100).toFixed(1)} %`;
    const availability = transformer * 0.95;

    return [
      {
        label: "Freestream kinetic",
        fraction: 1,
        color: "#38bdf8",
        note: "½·ρ·A·V³",
      },
      {
        label: "− Wake loss",
        fraction: wake,
        color: "#0ea5e9",
        note: "12.4 % array shadow (offshore 10–25 %)",
        citation: {
          source: "MDPI Energies 17/5/1063 — Horns Rev I / Lillgrund",
          url: "https://www.mdpi.com/1996-1073/17/5/1063",
        },
      },
      {
        label: "− Blockage",
        fraction: block,
        color: "#0284c7",
        note: "0.5 % farm-level",
      },
      {
        label: "× Cp (Betz aero)",
        fraction: cp,
        color: "#facc15",
        note: `${cpRated.toFixed(3)} at rated (IEA 15 MW table) — Betz max 0.593`,
        partId: "blades",
      },
      {
        label: "× η generator",
        fraction: generator,
        color: "#fb923c",
        note: `${pct(V236_ETA.generator)} — direct-drive PMSG, no gearbox`,
        partId: "generator",
        citation: {
          source: "Gaertner et al. 2020, NREL/TP-5000-75698, Table 5-4",
          url: "https://docs.nlr.gov/docs/fy20osti/75698.pdf",
        },
      },
      {
        label: "× η converter",
        fraction: converter,
        color: "#f97316",
        note: `${pct(V236_ETA.converter)} — η_gen·η_conv = 95.756 % (ROSCO VS_GenEff)`,
        partId: "converter",
        citation: {
          source: "IEA-15-240-RWT v1.1.18, ROSCO DISCON.IN",
          url: "https://github.com/IEAWindTask37/IEA-15-240-RWT",
        },
      },
      {
        label: "× η transformer",
        fraction: transformer,
        color: "#f25c54",
        note: `${pct(V236_ETA.transformer)} — illustrative (IEC 60076 liquid-filled)`,
        partId: "transformer",
        citation: {
          source: "NPC 66 kV / IEC 60076-14 datasheet",
          url: "https://www.npcelectric.com/transformers/66kv-69kv-power-transformer.html",
        },
      },
      {
        label: "× availability",
        fraction: availability,
        color: "#dc2626",
        note: "95 % — industry target (framework: IEC 61400-26)",
        citation: {
          source: "NREL TP-72373 — availability framework",
          url: "https://docs.nrel.gov/docs/fy20osti/72373.pdf",
        },
      },
    ];
  }, []);

  const grid = stages[stages.length - 1].fraction;
  const betz = 16 / 27;
  const overallVsBetz = (stages[3].fraction / betz) * 100;

  return (
    <div className="absolute top-14 right-2 z-20 w-[280px] bg-bg-secondary/95 backdrop-blur-sm border border-border-primary rounded-md shadow-lg pointer-events-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-primary">
        <div>
          <div className="text-xs font-semibold text-text-primary">Power Loss Cascade</div>
          <div className="text-xs text-text-muted font-mono">IEA 15 MW · P_grid / P_wind = {(grid * 100).toFixed(1)} %</div>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-bg-hover rounded" title="Close">
          <X size={12} className="text-text-muted" />
        </button>
      </div>

      {/* Bars */}
      <div className="p-2 space-y-1">
        {stages.map((s) => (
          <div key={s.label} className="group">
            <div className="flex items-baseline justify-between mb-0.5">
              <button
                className="text-xs font-mono text-text-primary hover:text-accent text-left flex-1 truncate"
                onClick={() => s.partId && setSelectedPart(s.partId)}
                disabled={!s.partId}
                title={s.partId ? `Focus 3D on ${s.partId}` : undefined}
              >
                {s.label}
              </button>
              <span className="text-xs font-mono text-text-muted ml-1">
                {(s.fraction * 100).toFixed(1)}%
              </span>
            </div>
            <div className="h-2 bg-bg-primary rounded-sm overflow-hidden">
              <div
                className="h-full rounded-sm transition-all"
                style={{
                  width: `${s.fraction * 100}%`,
                  backgroundColor: s.color,
                }}
              />
            </div>
            <div className="flex items-baseline justify-between mt-0.5 gap-1">
              <span className="text-xs text-text-muted font-mono truncate">
                {s.note}
              </span>
              {s.citation && (
                <a
                  href={s.citation.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={s.citation.source}
                  className="shrink-0 text-text-muted hover:text-accent"
                >
                  <HelpCircle size={10} />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-border-primary text-xs font-mono text-text-muted">
        <div>Aero vs Betz (16/27 = 59.3 %): {overallVsBetz.toFixed(1)} %</div>
        <div className="text-text-muted/70 mt-0.5 text-xs">
          Sources cited per stage (?). Availability is an industry target — IEC 61400-26 is the framework, not a mandated value.
        </div>
      </div>
    </div>
  );
}
