/**
 * Event log / SOE panel — chronological sequence of events.
 *
 * Every protection event and GOOSE message logged with ms timestamps.
 * Matches real SCADA SOE (Sequence of Events) recorder.
 */

import { useMemo } from "react";

import { useScadaStore } from "../../store/scadaStore";
import { SCADA_COLORS } from "../../constants/scadaColors";
import { InfoButton } from "../ui/InfoButton";
import { eventLogInfo } from "../../constants/panelInfo";

interface SOEEntry {
  timestamp_ms: number;
  source: string;
  type: string;
  description: string;
}

export default function EventLogPanel() {
  const { simulationResult } = useScadaStore();

  const entries = useMemo<SOEEntry[]>(() => {
    if (!simulationResult) return [];

    const events: SOEEntry[] = simulationResult.events.map((e) => ({
      timestamp_ms: e.timestamp_ms,
      source: e.ied_name || "System",
      type: e.event_type,
      description: e.description,
    }));

    const gooseEntries: SOEEntry[] = simulationResult.goose_messages.map(
      (m) => ({
        timestamp_ms:
          simulationResult.events.find((e) => e.event_type === "goose_publish")
            ?.timestamp_ms ?? 0,
        source: m.gocb_ref.split("/")[0] || "GoCB",
        type: "goose_pdu",
        description: `GOOSE st=${m.st_num} sq=${m.sq_num} → ${Object.entries(m.all_data)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ")}`,
      }),
    );

    return [...events, ...gooseEntries].sort(
      (a, b) => a.timestamp_ms - b.timestamp_ms,
    );
  }, [simulationResult]);

  return (
    <div className="bg-bg-secondary rounded-lg border border-border-primary overflow-hidden">
      <div className="px-4 py-2 border-b border-border-primary flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">
          Event Log / SOE
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-muted font-mono">
            {entries.length} entries
          </span>
          <InfoButton info={eventLogInfo} />
        </div>
      </div>
      <div className="max-h-[240px] overflow-y-auto">
        {entries.length === 0 ? (
          <div className="p-4 text-center text-slate-500 text-sm">
            No events — run a fault simulation
          </div>
        ) : (
          <table className="w-full text-[11px]">
            <thead className="bg-slate-900/50 sticky top-0">
              <tr>
                <th className="text-left px-3 py-1.5 text-slate-500 font-medium w-20">
                  T [ms]
                </th>
                <th className="text-left px-3 py-1.5 text-slate-500 font-medium w-32">
                  Source
                </th>
                <th className="text-left px-3 py-1.5 text-slate-500 font-medium w-24">
                  Type
                </th>
                <th className="text-left px-3 py-1.5 text-slate-500 font-medium">
                  Description
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => (
                <tr
                  key={i}
                  className="border-b border-slate-700/50 hover:bg-slate-700/30"
                >
                  <td className="px-3 py-1 font-mono text-slate-300">
                    {entry.timestamp_ms.toFixed(1)}
                  </td>
                  <td className="px-3 py-1 font-mono text-slate-400">
                    {entry.source}
                  </td>
                  <td className="px-3 py-1">
                    <span
                      className="font-mono text-[10px]"
                      style={{
                        color:
                          entry.type === "goose_pdu"
                            ? SCADA_COLORS.EARTHED
                            : entry.type === "relay_trip"
                              ? SCADA_COLORS.FAULT
                              : SCADA_COLORS.DE_ENERGIZED,
                      }}
                    >
                      {entry.type}
                    </span>
                  </td>
                  <td className="px-3 py-1 text-slate-300 truncate max-w-[300px]">
                    {entry.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
