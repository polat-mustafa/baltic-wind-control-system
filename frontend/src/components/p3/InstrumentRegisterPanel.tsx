/**
 * Instrument register — the field sensors behind the SCADA tags: per turbine, per 66 kV
 * feeder bay and per export circuit, with signal type, range, accuracy, the governing
 * standard and the IEC 61850 logical node (GET /api/v1/info/sensors; counts follow the farm).
 */

import { useEffect, useState } from "react";

import { request } from "../../services/apiClient";

interface SensorSpec {
  name: string;
  quantity_per_location: number;
  signal_type: string;
  range: string;
  accuracy: string;
  standard: string;
  iec_61850_ln: string | null;
  notes: string;
}

interface SensorRegister {
  turbine: { turbine_model: string; sensors: SensorSpec[]; total_per_turbine: number };
  oss_bay: { bay_voltage_kv: number; sensors: SensorSpec[]; total_per_bay: number };
  export_cable: {
    cable_length_km: number;
    cable_voltage_kv: number;
    num_circuits: number;
    sensors: SensorSpec[];
    total_cable_instruments: number;
  };
  total_turbine_locations: number;
  total_oss_bays: number;
  total_instrument_tags: number;
  disclaimer: string;
}

function Group({ title, sensors }: { title: string; sensors: SensorSpec[] }) {
  return (
    <div className="space-y-1">
      <h4 className="text-sm font-semibold text-text-primary">{title}</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-text-muted">
              {["Instrument", "Qty", "Signal", "Range", "Accuracy", "Standard", "IEC 61850 LN"].map((h) => (
                <th key={h} className="text-left font-medium px-2 py-1 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sensors.map((s) => (
              <tr key={s.name} className="border-t border-border-primary align-top" title={s.notes}>
                <td className="px-2 py-1">{s.name}</td>
                <td className="px-2 py-1 tabular-nums">{s.quantity_per_location}</td>
                <td className="px-2 py-1" translate="no">{s.signal_type}</td>
                <td className="px-2 py-1" translate="no">{s.range}</td>
                <td className="px-2 py-1" translate="no">{s.accuracy}</td>
                <td className="px-2 py-1 whitespace-nowrap" translate="no">{s.standard}</td>
                <td className="px-2 py-1 font-mono" translate="no">{s.iec_61850_ln ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function InstrumentRegisterPanel() {
  const [reg, setReg] = useState<SensorRegister | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    request<SensorRegister>("/api/v1/info/sensors").then(setReg, (e: unknown) =>
      setError(e instanceof Error ? e.message : String(e)),
    );
  }, []);

  if (error) return <p className="text-sm text-status-alarm">{error}</p>;
  if (!reg) return <p className="text-sm text-text-muted">Loading...</p>;

  const t = reg.turbine.total_per_turbine * reg.total_turbine_locations;
  const b = reg.oss_bay.total_per_bay * reg.total_oss_bays;
  const c = reg.export_cable.total_cable_instruments * reg.export_cable.num_circuits;

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-text-primary">Instrument register</h3>
        <p className="text-sm text-text-secondary mt-1">
          {`${reg.total_instrument_tags} field instruments: ${reg.total_turbine_locations} turbines × ${reg.turbine.total_per_turbine} = ${t}, ${reg.total_oss_bays} feeder bays × ${reg.oss_bay.total_per_bay} = ${b}, ${reg.export_cable.num_circuits} export circuits × ${reg.export_cable.total_cable_instruments} = ${c}.`}
        </p>
      </div>
      <Group title="Per turbine" sensors={reg.turbine.sensors} />
      <Group title="Per 66 kV feeder bay" sensors={reg.oss_bay.sensors} />
      <Group title="Per 220 kV export circuit" sensors={reg.export_cable.sensors} />
      <p className="text-xs text-text-muted">{reg.disclaimer}</p>
    </section>
  );
}
