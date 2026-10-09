/**
 * A clicked 66 kV array cable section: its live load against the rating, the
 * turbines it carries, and a cable-fault drill (trip, isolate, restore).
 * Shared by the Control Room maps.
 */

import { useEffect } from "react";

import { TURBINE_STATUS_COLOR as STATUS_COLOR } from "../../constants/scadaColors";
import { cableTree, loadColor, type CableFocus } from "../../lib/arrayCables";
import { sectionOf, useFleet } from "../../lib/fleet";
import { bayName } from "../../lib/lifecycle/farm";
import { cn } from "../../lib/utils";
import { ARRAY_FAULT_ISOLATION_MS, useLandingStore } from "../../store/landingStore";
import { useTrainingStore } from "../../store/trainingStore";
import { arrayCableCurrentA, arrayCableGrade } from "../../utils/landingPhysics";

export default function ArrayCableCard({
  seg,
  onClose,
  onSelect,
}: {
  seg: CableFocus;
  onClose: () => void;
  onSelect: (s: CableFocus) => void;
}) {
  // Walk the cable like on the SLD: toward the OSS / toward the far end (first branch)
  const { segments, stringSize } = cableTree(useFleet());
  const towardOss = segments.find((s) => s.fromId === seg.toId);
  const awayFromOss = segments.find((s) => s.toId === seg.fromId);
  const turbineMap = useLandingStore((s) => s.turbineMap);
  const feeds = seg.feedIds
    .map((id) => turbineMap[id])
    .filter((t) => t !== undefined);
  const carriedMW = feeds.reduce((sum, t) => sum + t.powerOutputMW, 0);
  const grade = arrayCableGrade(
    seg.segmentFromOss,
    stringSize(seg.stringNumber),
  );
  const currentA = arrayCableCurrentA(carriedMW);
  const loadFrac = currentA / grade.ratedA;
  const n = stringSize(seg.stringNumber);
  const fleet = useFleet();
  const bay = bayName(seg.stringNumber);
  const section = sectionOf(fleet, seg.stringNumber - 1);
  const fault = useLandingStore((s) => s.arrayFault);
  const injectArrayFault = useLandingStore((s) => s.injectArrayFault);
  const restoreArrayFault = useLandingStore((s) => s.restoreArrayFault);
  const faultHere = fault?.stringNumber === seg.stringNumber ? fault : null;
  const faultSeg = faultHere
    ? segments.find((x) => x.key === faultHere.segmentKey)
    : undefined;
  const report = useTrainingStore((s) => s.report);
  const isolateArrayFault = useLandingStore((s) => s.isolateArrayFault);
  useEffect(() => {
    report({ type: "cable-selected", stringNumber: seg.stringNumber, segmentKey: seg.key });
  }, [report, seg.key, seg.stringNumber]);
  const isolateIn = faultHere
    ? Math.max(
        0,
        Math.ceil(
          (faultHere.trippedAt + ARRAY_FAULT_ISOLATION_MS - Date.now()) / 1000,
        ),
      )
    : 0;

  // During a drill the Scenario panel owns the right edge — sit beside it
  const drill = useTrainingStore((s) => s.active !== null);

  return (
    <div
      className={cn(
        "absolute bottom-8 z-1000 w-80 max-w-[calc(100%-1.5rem)] rounded-lg border border-border-primary bg-bg-primary/95 shadow-lg shadow-black/30 backdrop-blur-sm",
        drill ? "right-[21.5rem]" : "right-3",
      )}
    >
      <div className="flex items-start justify-between border-b border-border-primary/60 px-3 py-2">
        <div>
          <div className="text-xs uppercase tracking-wider text-text-muted">
            66 kV array cable · String S{seg.stringNumber} ({n} WTG)
          </div>
          <div className="font-mono text-xs font-semibold text-text-primary">
            {seg.fromId} → {seg.toId === "OSS" ? `OSS (${bay})` : seg.toId}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-1.5 text-text-muted hover:bg-bg-secondary hover:text-text-primary"
          aria-label="Close cable details"
        >
          ×
        </button>
      </div>
      <div className="flex justify-between gap-2 border-b border-border-primary/60 px-3 py-1 text-xs">
        <button
          type="button"
          disabled={!towardOss}
          onClick={() => towardOss && onSelect(towardOss)}
          className="rounded px-1.5 text-text-secondary hover:bg-bg-secondary disabled:opacity-30"
        >
          ◀ toward OSS
        </button>
        <button
          type="button"
          disabled={!awayFromOss}
          onClick={() => awayFromOss && onSelect(awayFromOss)}
          className="rounded px-1.5 text-text-secondary hover:bg-bg-secondary disabled:opacity-30"
        >
          next section out ▶
        </button>
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 px-3 py-2 font-mono text-xs tabular-nums whitespace-nowrap">
        <span className="text-text-muted">Load</span>
        <span className="text-right" style={{ color: loadColor(loadFrac) }}>
          {carriedMW.toFixed(1)} MW · {currentA.toFixed(0)} A ·{" "}
          {(loadFrac * 100).toFixed(0)} %
        </span>
        <span className="text-text-muted">Cable</span>
        <span className="text-right text-text-primary">
          {grade.mm2} mm² Cu XLPE · {grade.ratedA} A
        </span>
        <span className="text-text-muted">Length (straight)</span>
        <span className="text-right text-text-primary">
          {seg.lengthKm.toFixed(2)} km
        </span>
        <span className="text-text-muted">OSS 66 kV bus</span>
        <span className="text-right text-text-primary">
          section {section} · TX-OSS-0{section === "A" ? 1 : 2}
        </span>
      </div>
      <div className="border-t border-border-primary/60 px-3 py-2">
        <div className="mb-1 text-xs uppercase tracking-wider text-text-muted">
          Carries power + fibre (SCADA / IEC 61850) of {feeds.length} WTG
        </div>
        <div className="flex flex-wrap gap-1">
          {feeds.map((t) => (
            <span
              key={t.id}
              className="rounded border px-1.5 py-0.5 font-mono text-xs tabular-nums"
              style={{
                borderColor: `${STATUS_COLOR[t.status]}80`,
                color: STATUS_COLOR[t.status],
              }}
            >
              {t.id.replace("WTG-", "")} · {t.powerOutputMW.toFixed(1)}
            </span>
          ))}
        </div>
        <p className="mt-1.5 text-xs leading-snug text-text-muted">
          Radial string: each segment carries every turbine beyond it. Feeder CB{" "}
          {bay} at the OSS 66 kV switchboard trips the whole string.
        </p>
      </div>
      <div className="border-t border-border-primary/60 px-3 py-2">
        {!fault && (
          <button
            type="button"
            onClick={() =>
              injectArrayFault({
                segmentKey: seg.key,
                stringNumber: seg.stringNumber,
                stringIds: fleet.strings[seg.stringNumber - 1],
                beyondIds: seg.feedIds,
              })
            }
            className="w-full rounded border border-[#f25c54]/60 px-2 py-1 text-xs font-semibold text-[#f25c54] hover:bg-[#f25c54]/10"
          >
            Simulate cable fault on this section
          </button>
        )}
        {fault && !faultHere && (
          <p className="text-xs text-text-muted">
            Cable fault active on string S{fault.stringNumber} — open that
            string to follow or restore it.
          </p>
        )}
        {faultHere && faultSeg && (
          <div className="space-y-1 font-mono text-xs leading-snug">
            <div className="text-[#f25c54]">
              t+0.1 s ·{" "}
              {faultHere.manual && faultHere.stage === "tripped"
                ? "earth fault on string"
                : `fault ${faultSeg.fromId}→${faultSeg.toId}`}
              : feeder CB {bay}{" "}
              tripped (50/51, 51N) — all {n} WTG of S{seg.stringNumber} lost the
              grid
            </div>
            {faultHere.stage === "tripped" && faultHere.manual ? (
              <button
                type="button"
                onClick={() => {
                  const ok = isolateArrayFault(seg.key);
                  report({ type: "isolate", segmentKey: seg.key, ok });
                }}
                className="w-full rounded border border-[#f0b13e]/70 px-2 py-1 font-sans text-xs font-semibold text-[#f0b13e] hover:bg-[#f0b13e]/10"
              >
                Open switch &amp; isolate this section ({seg.fromId}→{seg.toId})
              </button>
            ) : faultHere.stage === "tripped" ? (
              <div className="text-[#f0b13e]">
                locating fault · isolating section… (≈ {isolateIn} s,
                time-compressed)
              </div>
            ) : (
              <div className="text-[#4cc38a]">
                {faultSeg.toId === "OSS"
                  ? "fault is on the feeder cable itself — the string stays off until repair"
                  : `switch at ${faultSeg.toId} opened, CB re-closed: ${faultHere.restorableIds.length} WTG back on line`}
              </div>
            )}
            <div className="text-text-muted">
              {faultHere.beyondIds.length} WTG beyond the fault out until the
              cable is repaired (cable-repair vessel job, weeks offshore).
            </div>
            <button
              type="button"
              onClick={restoreArrayFault}
              className="mt-1 w-full rounded border border-[#4cc38a]/60 px-2 py-1 font-sans text-xs font-semibold text-[#4cc38a] hover:bg-[#4cc38a]/10"
            >
              Repair cable & re-energise string
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
