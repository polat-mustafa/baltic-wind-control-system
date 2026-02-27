/**
 * Anomaly injection panel — instructor/educational mode.
 *
 * Client-side only fault overlay for training scenarios. No backend
 * endpoints exist for this; it purely sets visual overlays on the SLD
 * and components to simulate fault conditions.
 *
 * Available fault types:
 * 1. SF6 gas leak — simulates low SF6 pressure in a CB (IEC 62271-100)
 * 2. Communications failure — simulates GOOSE/MMS link loss
 * 3. Voltage anomaly — simulates Ferranti effect or transient overvoltage
 *
 * The panel is clearly labeled "Educational Simulation" to distinguish
 * it from real SCADA alarm systems.
 */

import { useState } from "react";

import { SCADA_COLORS } from "../../constants/scadaColors";
import { useCommissioningStore, type AnomalyOverlay } from "../../store/commissioningStore";

interface FaultTemplate {
  type: AnomalyOverlay["type"];
  label: string;
  description: string;
  defaultEquipment: string;
}

const FAULT_TEMPLATES: FaultTemplate[] = [
  {
    type: "sf6_leak",
    label: "SF6 Gas Leak",
    description: "Low SF6 pressure alarm — CB cannot operate (IEC 62271-100)",
    defaultEquipment: "CB-OSS-220-01",
  },
  {
    type: "comms_failure",
    label: "Comms Failure",
    description: "GOOSE/MMS link loss — protection relay communication down",
    defaultEquipment: "CB-TX-OSS-HV",
  },
  {
    type: "voltage_anomaly",
    label: "Voltage Anomaly",
    description: "Ferranti effect — cable capacitance causing voltage rise",
    defaultEquipment: "TX-OSS-01",
  },
];

export default function AnomalyInjection() {
  const { anomalies, injectAnomaly, clearAnomaly, clearAllAnomalies } = useCommissioningStore();
  const [selectedTemplate, setSelectedTemplate] = useState(0);
  const [equipmentId, setEquipmentId] = useState(FAULT_TEMPLATES[0].defaultEquipment);

  const template = FAULT_TEMPLATES[selectedTemplate];

  return (
    <div className="bg-slate-800 rounded-lg border border-amber-700/50 overflow-hidden">
      {/* Header with warning label */}
      <div className="px-4 py-3 border-b border-amber-700/50 bg-amber-900/20">
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase"
            style={{ backgroundColor: SCADA_COLORS.WARNING + "33", color: SCADA_COLORS.WARNING }}
          >
            Instructor Mode
          </span>
          <h3 className="text-sm font-semibold">Anomaly Injection</h3>
        </div>
        <p className="text-[10px] text-amber-400/80 mt-1">
          Educational Simulation — client-side fault overlay only
        </p>
      </div>

      <div className="p-4 space-y-4">
        {/* Fault type selector */}
        <div className="space-y-2">
          {FAULT_TEMPLATES.map((ft, i) => (
            <label
              key={ft.type}
              className={`flex items-start gap-2 p-2 rounded cursor-pointer transition-colors ${
                selectedTemplate === i ? "bg-slate-700" : "hover:bg-slate-700/50"
              }`}
            >
              <input
                type="radio"
                name="fault-type"
                checked={selectedTemplate === i}
                onChange={() => { setSelectedTemplate(i); setEquipmentId(ft.defaultEquipment); }}
                className="mt-0.5"
              />
              <div>
                <div className="text-xs font-medium">{ft.label}</div>
                <div className="text-[10px] text-slate-400">{ft.description}</div>
              </div>
            </label>
          ))}
        </div>

        {/* Equipment target */}
        <div>
          <label className="text-[10px] text-slate-400 block mb-1">Target Equipment</label>
          <input
            type="text"
            value={equipmentId}
            onChange={(e) => setEquipmentId(e.target.value)}
            className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs text-white font-mono focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Inject button */}
        <button
          onClick={() => {
            injectAnomaly({
              id: `${template.type}-${Date.now()}`,
              type: template.type,
              equipment_id: equipmentId,
              label: `${template.label} on ${equipmentId}`,
            });
          }}
          className="w-full py-2 rounded text-sm font-medium transition-colors"
          style={{ backgroundColor: SCADA_COLORS.WARNING + "33", color: SCADA_COLORS.WARNING }}
        >
          Inject Fault
        </button>

        {/* Active anomalies */}
        {anomalies.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400">Active Anomalies ({anomalies.length})</span>
              <button
                onClick={clearAllAnomalies}
                className="text-[10px] text-red-400 hover:text-red-300"
              >
                Clear All
              </button>
            </div>
            {anomalies.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between p-2 rounded text-xs"
                style={{ backgroundColor: SCADA_COLORS.FAULT + "15", border: `1px solid ${SCADA_COLORS.FAULT}33` }}
              >
                <span style={{ color: SCADA_COLORS.FAULT }}>{a.label}</span>
                <button
                  onClick={() => clearAnomaly(a.id)}
                  className="text-slate-400 hover:text-white text-[10px]"
                >
                  Clear
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
