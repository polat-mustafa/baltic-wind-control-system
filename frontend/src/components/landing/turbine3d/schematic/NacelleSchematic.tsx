/**
 * Nacelle engineering drawings — the "clarity mode" next to the 3D view.
 *
 * Three sheets drawn the way a turbine O&M manual draws them, each in an
 * ISO 5457 frame with zones and a title block, live values in callouts:
 *   E-01  single-line diagram (IEC 60617)
 *   M-01  drivetrain & yaw
 *   P-01  hydraulics & cooling P&ID (ISA-5.1)
 * Symbols are selectable: selection is shared with the 3D view and "Open in
 * 3D" flies the camera to the part. The drawing scales to any panel size
 * (fixed 1200 × 720 viewBox), so text never reflows or clips.
 */

import { memo, useEffect, useMemo, useState, type ReactNode } from "react";
import { ExternalLink, X } from "lucide-react";

import { selectKPIs, selectTurbine, selectTurbinePart, useLandingStore } from "../../../../store/landingStore";
import { selectNacelleData, useNacelleSubsystemsStore } from "../../../../store/nacelleSubsystemsStore";
import { TURBINE_POSITIONS } from "../../../../constants/windFarmLayout";
import { v236PowerChain } from "../../../../utils/landingPhysics";
import { cn } from "../../../../lib/utils";
import { CONNECTION_STYLES, NACELLE_CONNECTIONS, NACELLE_SCHEMATIC_PARTS, type SchematicPart } from "./schematicData";
import { DrivetrainSheet, ElectricalSheet, HydraulicSheet, type SheetProps } from "./sheets";

interface NacelleSchematicProps {
  turbineId: string;
  /** Extra header controls from the viewer (e.g. full-view toggle). */
  headerExtra?: ReactNode;
}

const PART = new Map(NACELLE_SCHEMATIC_PARTS.map((p) => [p.id, p]));

const SHEETS = [
  { id: "E-01", label: "E-01 Single-line", Comp: ElectricalSheet },
  { id: "M-01", label: "M-01 Drivetrain & yaw", Comp: DrivetrainSheet },
  { id: "P-01", label: "P-01 Hydraulics & cooling", Comp: HydraulicSheet },
] as const;
type SheetId = (typeof SHEETS)[number]["id"];

/** Position of a turbine on its 66 kV string (outer end first, OSS last). */
function stringOf(turbineId: string) {
  const me = TURBINE_POSITIONS.find((t) => t.id === turbineId);
  const s = TURBINE_POSITIONS.filter((t) => t.stringNumber === me?.stringNumber);
  const i = s.findIndex((t) => t.id === turbineId);
  return { outer: s.slice(0, Math.max(0, i)).map((t) => t.id), inner: s[i + 1]?.id ?? "OSS" };
}

export const NacelleSchematic = memo(function NacelleSchematic({ turbineId, headerExtra }: NacelleSchematicProps) {
  const [sheetId, setSheetId] = useState<SheetId>("E-01");
  const selected = useLandingStore(selectTurbinePart);
  const setSelected = useLandingStore((s) => s.setSelectedTurbinePart);
  const setInteriorView = useLandingStore((s) => s.setInteriorView);
  const turbine = useLandingStore(selectTurbine(turbineId));
  const kpis = useLandingStore(selectKPIs);
  const turbineMap = useLandingStore((s) => s.turbineMap);
  const nacelle = useNacelleSubsystemsStore(selectNacelleData(turbineId));
  const pos = useMemo(() => stringOf(turbineId), [turbineId]);

  useEffect(() => {
    const { startPolling, stopPolling } = useNacelleSubsystemsStore.getState();
    startPolling(turbineId, 2000);
    return () => stopPolling(turbineId);
  }, [turbineId]);

  if (!turbine) return null;
  const chain = v236PowerChain(turbine.powerOutputMW, turbine.windSpeedMs, turbine.rotorSpeedRpm);
  const outerMW = pos.outer.reduce((a, id) => a + (turbineMap[id]?.powerOutputMW ?? 0), 0);
  const yawErrDeg = ((turbine.nacellePositionDeg - kpis.windDirectionDeg + 540) % 360) - 180;
  const props: SheetProps = {
    turbine,
    chain,
    nacelle,
    selected,
    onSelect: setSelected,
    string: {
      outerId: pos.outer.at(-1) ?? null,
      innerId: pos.inner,
      outerMW,
      innerMW: outerMW + turbine.powerOutputMW,
      outerCount: pos.outer.length,
    },
    yawErrDeg,
    windFromDeg: kpis.windDirectionDeg,
  };
  const Active = SHEETS.find((s) => s.id === sheetId)!.Comp;
  const sel = selected ? PART.get(selected) : undefined;

  return (
    <div className="pointer-events-auto absolute inset-0 flex flex-col bg-bg-primary text-text-primary">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-primary px-4 py-2">
        <div>
          <div className="text-[15px] font-bold">V236 nacelle · engineering drawings</div>
          <div className="text-[12px] font-semibold text-text-muted">
            {turbineId} · wind {turbine.windSpeedMs.toFixed(1)} m/s · {turbine.powerOutputMW.toFixed(2)} MW · Cp {chain.cp.toFixed(2)}
          </div>
        </div>
        <div className="flex overflow-hidden rounded-md border border-border-primary text-[12px] font-semibold" role="tablist" aria-label="Drawing sheet">
          {SHEETS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={sheetId === s.id}
              onClick={() => setSheetId(s.id)}
              className={cn("px-3 py-1.5", sheetId === s.id ? "bg-accent text-white" : "text-text-secondary hover:bg-bg-hover")}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {headerExtra}
          <button
            type="button"
            onClick={() => setInteriorView("3d")}
            className="flex items-center gap-1.5 rounded-md border border-border-primary bg-bg-secondary px-3 py-1.5 text-[12px] font-semibold hover:bg-bg-hover"
            title="Back to the 3D view (S)"
          >
            <X size={14} /> Back to 3D
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 p-2">
        <Active {...props} />
      </div>

      {/* Selection bar */}
      {sel && (
        <SelectionBar
          part={sel}
          onClose={() => setSelected(null)}
          onOpenIn3D={() => {
            // Back to 3D, then re-select after a frame so the fly-to reads
            // fresh mesh bounds.
            const id = sel.id;
            setInteriorView("3d");
            setSelected(null);
            requestAnimationFrame(() => setSelected(id));
          }}
        />
      )}
    </div>
  );
});

function SelectionBar({ part, onClose, onOpenIn3D }: { part: SchematicPart; onClose: () => void; onOpenIn3D: () => void }) {
  const links = NACELLE_CONNECTIONS.filter((c) => c.from === part.id || c.to === part.id);
  return (
    <div className="border-t border-border-primary bg-bg-secondary px-4 py-2">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold">
            {part.label}
            {part.sublabel && <span className="ml-2 text-[12px] font-semibold text-text-muted">{part.sublabel}</span>}
          </div>
          {links.length > 0 && (
            <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] font-semibold text-text-secondary">
              {links.map((c) => {
                const other = PART.get(c.from === part.id ? c.to : c.from);
                const style = CONNECTION_STYLES[c.kind];
                return (
                  <span key={`${c.from}-${c.to}-${c.kind}`} className="flex items-center gap-1">
                    <span className="inline-block h-0.5 w-4" style={{ background: style.stroke }} />
                    {style.label} {c.from === part.id ? "→" : "←"} {other?.label ?? (c.from === part.id ? c.to : c.from)}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        {part.cite?.map((c) => (
          <a key={c.url} href={c.url} target="_blank" rel="noopener noreferrer" title={c.source}
            className="flex items-center gap-1 text-[12px] font-semibold text-accent hover:underline">
            <ExternalLink size={13} /> source
          </a>
        ))}
        <button type="button" onClick={onOpenIn3D}
          className="rounded-md border border-accent px-2.5 py-1 text-[12px] font-bold text-accent hover:bg-accent-muted">
          Open in 3D →
        </button>
        <button type="button" onClick={onClose} className="rounded p-1 hover:bg-bg-hover" aria-label="Deselect part">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
