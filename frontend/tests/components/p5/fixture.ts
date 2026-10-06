/** A small programme detail in the shape of GET /commissioning/programmes/{id}. */

import type { ProgrammeDetail, Step } from "../../../src/types/commissioning";

export const step = (over: Partial<Step>): Step => ({
  step_id: "2.08",
  step_number: 1,
  phase: 2,
  step_type: "switching",
  action: "Close CB-ON-220-01 — export cable 1 energised from shore",
  equipment_id: "CB-ON-220-01",
  responsible: "SCADA",
  pic_confirmation: true,
  verification: "Position indication",
  notes: "",
  status: "pending",
  executed_at: null,
  executed_by: "",
  reading: "",
  ...over,
});

export function programme(over: Partial<ProgrammeDetail> = {}): ProgrammeDetail {
  return {
    programme_id: "SB5-SP-20261005-ABC123",
    title: "Circuit 1 first energisation",
    pic_name: "Jan Kowalski",
    status: "in_progress",
    total_steps: 2,
    completed_steps: 1,
    current_step_index: 1,
    created_at: "2026-10-05T08:00:00Z",
    phases: { "2": "Export cable 1" },
    steps: [
      step({ step_id: "2.07", step_number: 1, step_type: "verification", equipment_id: "", status: "completed", action: "Verify cable isolated", reading: "Cable 1 dead; CB-OSS-220-01 open" }),
      step({ step_number: 2 }),
    ],
    equipment_states: [
      { equipment_id: "DS-ON-220-01", equipment_type: "disconnector", voltage_kv: 220, location: "Onshore bay E1 busbar disconnector", state: "closed", zones: ["ONS220", "ONS-E1"], locked: false },
      { equipment_id: "CB-ON-220-01", equipment_type: "circuit_breaker", voltage_kv: 220, location: "Onshore bay E1 circuit breaker", state: "open", zones: ["ONS-E1", "CABLE1"], locked: false },
      { equipment_id: "ES-ON-220-01", equipment_type: "earth_switch", voltage_kv: 220, location: "Export cable 1 earth switch, onshore end", state: "open", zones: ["CABLE1"], locked: false },
      { equipment_id: "ES-OSS-220-BB", equipment_type: "earth_switch", voltage_kv: 220, location: "OSS 220 kV busbar earth switch", state: "closed", zones: ["OSS220"], locked: true },
    ],
    network: {
      zones: { ONS220: "live", "ONS-E1": "live", CABLE1: "dead", OSS220: "earthed" },
      buses: [
        { name: "PSE 400 kV (POC)", zone: "PSE400", vn_kv: 400, vm_pu: 1.0, kv: 400 },
        { name: "Onshore 220 kV", zone: "ONS220", vn_kv: 220, vm_pu: 1.0, kv: 220 },
      ],
      poc_p_mw: -0.1,
      poc_q_mvar: -0.2,
      generation_mw: 0,
      cable_i_send_a: null,
      cable_i_recv_a: null,
      cable_loading_pct: null,
      reactor_q_mvar: null,
      statcom_q_mvar: null,
      tx1_i_hv_a: null,
      tx1_loading_pct: null,
    },
    audit_trail: [],
    emergency_log: [],
    ...over,
  };
}
