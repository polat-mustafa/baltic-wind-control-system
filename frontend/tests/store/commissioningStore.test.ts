/**
 * Commissioning store: actions call the API, then refresh the open programme.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCommissioningStore } from "../../src/store/commissioningStore";
import * as api from "../../src/services/commissioningApi";
import { programme } from "../components/p5/fixture";

vi.mock("../../src/services/commissioningApi");
const mockApi = vi.mocked(api);

beforeEach(() => {
  vi.resetAllMocks();
  useCommissioningStore.setState({ active: programme(), error: null, busy: false, lastResult: null });
  mockApi.getProgramme.mockResolvedValue(programme({ completed_steps: 2 }));
  mockApi.getLOTO.mockResolvedValue({ programme_id: "p", points: [], applied_count: 0 });
  mockApi.getSAT.mockRejectedValue(new Error("No SAT campaign"));
  mockApi.getCompliance.mockRejectedValue(new Error("No compliance campaign"));
  mockApi.listFAT.mockResolvedValue([]);
});

describe("commissioningStore", () => {
  it("executes the current step as the Person in Control and refreshes", async () => {
    mockApi.executeStep.mockResolvedValue({
      success: true, step_id: "2.08", status: "completed", message: "", programme_status: "in_progress",
      reading: "CB-ON-220-01: open → closed",
    });
    await useCommissioningStore.getState().executeCurrentStep();
    expect(mockApi.executeStep).toHaveBeenCalledWith("SB5-SP-20261005-ABC123", "2.08", "Jan Kowalski");
    const s = useCommissioningStore.getState();
    expect(s.lastResult).toEqual({ stepId: "2.08", ok: true, text: "CB-ON-220-01: open → closed" });
    expect(s.active?.completed_steps).toBe(2);
    expect(s.sat).toBeNull(); // 404 → no campaign yet
  });

  it("keeps a refused step out of the error banner", async () => {
    mockApi.executeStep.mockRejectedValue(new Error("2.08: ILK-001 earth on cable"));
    await useCommissioningStore.getState().executeCurrentStep();
    const s = useCommissioningStore.getState();
    expect(s.error).toBeNull();
    expect(s.lastResult).toMatchObject({ ok: false, text: "2.08: ILK-001 earth on cable" });
    expect(mockApi.getProgramme).toHaveBeenCalled(); // audit record of the refusal shows up
  });

  it("surfaces other API errors", async () => {
    mockApi.lotoAction.mockRejectedValue(new Error("Only the Person in Control may remove locks."));
    await useCommissioningStore.getState().lockAction("LOTO-ES-ON-220-01", "remove");
    expect(useCommissioningStore.getState().error).toMatch(/Person in Control/);
  });

  it("fills only the pending FAT tests with their typical values", async () => {
    useCommissioningStore.setState({
      fat: [{
        campaign_id: "FAT-1", equipment_tag: "TX-OSS-01", equipment_class: "power_transformer",
        status: "in_progress", all_passed: false, created_at: "", approved_by: "", approved_at: null,
        specs: [
          { test_id: "T1", name: "", standard: "", description: "", unit: "%", min_value: -0.5, max_value: 0.5, typical_value: 0.08 },
          { test_id: "T2", name: "", standard: "", description: "", unit: "%", min_value: 0, max_value: 1, typical_value: 0.4 },
        ],
        results: [{ test_id: "T1", measured_value: 0.1, verdict: "pass", recorded_by: "x", recorded_at: "", notes: "" }],
      }],
    });
    await useCommissioningStore.getState().fillFAT("FAT-1");
    expect(mockApi.recordFAT).toHaveBeenCalledTimes(1);
    expect(mockApi.recordFAT).toHaveBeenCalledWith("FAT-1", "T2", 0.4, "Jan Kowalski");
  });
});
