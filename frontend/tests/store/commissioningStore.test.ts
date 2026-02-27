/**
 * Tests for the commissioning Zustand store.
 *
 * Tests async actions by mocking the API client and verifying
 * state transitions for the full programme lifecycle.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCommissioningStore } from "../../src/store/commissioningStore";
import * as api from "../../src/services/commissioningApi";
import type { ProgrammeDetail, ProgrammeSummary } from "../../src/types/commissioning";

vi.mock("../../src/services/commissioningApi");

const mockApi = vi.mocked(api);

const MOCK_SUMMARY: ProgrammeSummary = {
  programme_id: "p-1",
  title: "OSS First Energisation",
  pic_name: "Jan",
  status: "created",
  total_steps: 30,
  completed_steps: 0,
  current_step_index: 0,
  created_at: "2025-01-01T00:00:00Z",
};

const MOCK_DETAIL: ProgrammeDetail = {
  ...MOCK_SUMMARY,
  steps: [
    {
      step_id: "S-001",
      step_number: 1,
      phase: 1,
      step_type: "check",
      action: "Verify megger test",
      equipment_id: "",
      responsible: "PiC",
      pic_confirmation: true,
      verification: "Check log",
      notes: "",
      status: "pending",
      executed_at: null,
      executed_by: "",
    },
  ],
  equipment_states: [
    {
      equipment_id: "CB-OSS-220-01",
      equipment_type: "circuit_breaker",
      voltage_kv: 220,
      location: "OSS 220 kV",
      state: "open",
    },
  ],
};

function resetStore() {
  useCommissioningStore.setState({
    programmes: [],
    activeProgramme: null,
    lotoSet: null,
    auditRecords: [],
    fatCampaigns: [],
    satCampaign: null,
    anomalies: [],
    error: null,
    loading: false,
  });
}

beforeEach(() => {
  resetStore();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchProgrammes", () => {
  it("loads programmes into state", async () => {
    mockApi.listProgrammes.mockResolvedValue([MOCK_SUMMARY]);

    await useCommissioningStore.getState().fetchProgrammes();

    expect(useCommissioningStore.getState().programmes).toEqual([MOCK_SUMMARY]);
  });

  it("sets error on failure", async () => {
    mockApi.listProgrammes.mockRejectedValue(new Error("Network error"));

    await useCommissioningStore.getState().fetchProgrammes();

    expect(useCommissioningStore.getState().error).toBe("Network error");
  });
});

describe("createProgramme", () => {
  it("creates and refreshes list", async () => {
    mockApi.createProgramme.mockResolvedValue(MOCK_SUMMARY);
    mockApi.listProgrammes.mockResolvedValue([MOCK_SUMMARY]);

    await useCommissioningStore.getState().createProgramme("Jan");

    expect(mockApi.createProgramme).toHaveBeenCalledWith("Jan");
    expect(mockApi.listProgrammes).toHaveBeenCalled();
    expect(useCommissioningStore.getState().loading).toBe(false);
  });
});

describe("selectProgramme", () => {
  it("loads programme detail", async () => {
    mockApi.getProgrammeDetail.mockResolvedValue(MOCK_DETAIL);

    await useCommissioningStore.getState().selectProgramme("p-1");

    expect(useCommissioningStore.getState().activeProgramme).toEqual(MOCK_DETAIL);
    expect(useCommissioningStore.getState().loading).toBe(false);
  });
});

describe("executeStep", () => {
  it("executes step and refreshes programme", async () => {
    useCommissioningStore.setState({ activeProgramme: MOCK_DETAIL });
    mockApi.executeStep.mockResolvedValue({
      success: true,
      step_id: "S-001",
      status: "completed",
      message: "Done",
      programme_status: "in_progress",
    });
    mockApi.getProgrammeDetail.mockResolvedValue(MOCK_DETAIL);
    mockApi.getAuditTrail.mockResolvedValue({
      programme_id: "p-1",
      total_records: 0,
      records: [],
    });

    await useCommissioningStore.getState().executeStep("S-001", "Jan");

    expect(mockApi.executeStep).toHaveBeenCalledWith("p-1", "S-001", {
      executed_by: "Jan",
      pic_confirmed: true,
    });
  });
});

describe("emergencyStop", () => {
  it("calls API and refreshes", async () => {
    useCommissioningStore.setState({ activeProgramme: MOCK_DETAIL });
    mockApi.emergencyStop.mockResolvedValue({
      success: true,
      programme_status: "aborted",
      message: "STOP",
    });
    mockApi.getProgrammeDetail.mockResolvedValue({
      ...MOCK_DETAIL,
      status: "aborted",
    });
    mockApi.getAuditTrail.mockResolvedValue({
      programme_id: "p-1",
      total_records: 0,
      records: [],
    });

    await useCommissioningStore.getState().emergencyStop("Jan", "Fire alarm");

    expect(mockApi.emergencyStop).toHaveBeenCalledWith("p-1", {
      initiated_by: "Jan",
      reason: "Fire alarm",
    });
  });
});

describe("anomaly injection (client-only)", () => {
  it("injects and clears anomalies", () => {
    const store = useCommissioningStore.getState();

    store.injectAnomaly({
      id: "a-1",
      type: "sf6_leak",
      equipment_id: "CB-OSS-220-01",
      label: "SF6 leak on CB",
    });

    expect(useCommissioningStore.getState().anomalies).toHaveLength(1);
    expect(useCommissioningStore.getState().anomalies[0].active).toBe(true);

    useCommissioningStore.getState().clearAnomaly("a-1");
    expect(useCommissioningStore.getState().anomalies).toHaveLength(0);
  });

  it("clearAllAnomalies removes all", () => {
    const store = useCommissioningStore.getState();
    store.injectAnomaly({ id: "a-1", type: "sf6_leak", equipment_id: "CB-1", label: "1" });
    store.injectAnomaly({ id: "a-2", type: "comms_failure", equipment_id: "CB-2", label: "2" });

    expect(useCommissioningStore.getState().anomalies).toHaveLength(2);

    useCommissioningStore.getState().clearAllAnomalies();
    expect(useCommissioningStore.getState().anomalies).toHaveLength(0);
  });
});

describe("clearError", () => {
  it("clears the error state", () => {
    useCommissioningStore.setState({ error: "Something went wrong" });
    useCommissioningStore.getState().clearError();
    expect(useCommissioningStore.getState().error).toBeNull();
  });
});
