/**
 * Tests for the P3 SCADA Zustand store.
 *
 * Tests async actions by mocking the API client and verifying
 * state transitions for IEC 61850 data, GOOSE simulation, and PtW lifecycle.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useScadaStore } from "../../src/store/scadaStore";
import * as api from "../../src/services/scadaApi";

vi.mock("../../src/services/scadaApi");

const mockApi = vi.mocked(api);

function resetStore() {
  useScadaStore.setState({
    substationSummary: null,
    faultScenarios: [],
    selectedFaultType: "busbar_overcurrent",
    simulationResult: null,
    retransmissionResult: null,
    roles: [],
    zones: [],
    selectedRoleLevel: 4,
    permitList: null,
    activePermit: null,
    loading: false,
    error: null,
    dataLoaded: false,
  });
}

beforeEach(() => {
  resetStore();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parameter setters", () => {
  it("setSelectedFaultType updates state", () => {
    useScadaStore.getState().setSelectedFaultType("line_to_ground");
    expect(useScadaStore.getState().selectedFaultType).toBe("line_to_ground");
  });

  it("setSelectedRoleLevel updates state", () => {
    useScadaStore.getState().setSelectedRoleLevel(2);
    expect(useScadaStore.getState().selectedRoleLevel).toBe(2);
  });
});

describe("fetchInitialData", () => {
  it("loads all initial data into state", async () => {
    const mockSummary = { total_devices: 42 };
    const mockScenarios = [{ fault_type: "busbar_overcurrent", description: "Busbar fault" }];
    const mockRoles = [{ level: 1, name: "Observer" }];
    const mockZones = [{ zone: "Zone_0", min_access_level: 1 }];
    const mockPermits = { total: 2, permits: [] };

    mockApi.getSubstationSummary.mockResolvedValue(mockSummary as ReturnType<typeof api.getSubstationSummary> extends Promise<infer T> ? T : never);
    mockApi.listFaultScenarios.mockResolvedValue(mockScenarios as ReturnType<typeof api.listFaultScenarios> extends Promise<infer T> ? T : never);
    mockApi.listRoles.mockResolvedValue(mockRoles as ReturnType<typeof api.listRoles> extends Promise<infer T> ? T : never);
    mockApi.listZones.mockResolvedValue(mockZones as ReturnType<typeof api.listZones> extends Promise<infer T> ? T : never);
    mockApi.listPermits.mockResolvedValue(mockPermits as ReturnType<typeof api.listPermits> extends Promise<infer T> ? T : never);

    await useScadaStore.getState().fetchInitialData();

    expect(useScadaStore.getState().substationSummary).toEqual(mockSummary);
    expect(useScadaStore.getState().faultScenarios).toEqual(mockScenarios);
    expect(useScadaStore.getState().roles).toEqual(mockRoles);
    expect(useScadaStore.getState().zones).toEqual(mockZones);
    expect(useScadaStore.getState().permitList).toEqual(mockPermits);
    expect(useScadaStore.getState().dataLoaded).toBe(true);
    expect(useScadaStore.getState().loading).toBe(false);
  });

  it("sets error on failure", async () => {
    mockApi.getSubstationSummary.mockRejectedValue(new Error("Connection refused"));
    mockApi.listFaultScenarios.mockResolvedValue([] as ReturnType<typeof api.listFaultScenarios> extends Promise<infer T> ? T : never);
    mockApi.listRoles.mockResolvedValue([] as ReturnType<typeof api.listRoles> extends Promise<infer T> ? T : never);
    mockApi.listZones.mockResolvedValue([] as ReturnType<typeof api.listZones> extends Promise<infer T> ? T : never);
    mockApi.listPermits.mockResolvedValue({ total: 0, permits: [] } as ReturnType<typeof api.listPermits> extends Promise<infer T> ? T : never);

    await useScadaStore.getState().fetchInitialData();

    expect(useScadaStore.getState().error).toBe("Connection refused");
    expect(useScadaStore.getState().loading).toBe(false);
  });
});

describe("runGooseSimulation", () => {
  it("runs simulation and stores results", async () => {
    const mockSimResult = { fault_type: "busbar_overcurrent", events: [] };
    const mockRetrans = { schedule_ms: [2, 4], intervals_ms: [2, 2] };

    mockApi.runFaultSimulation.mockResolvedValue(mockSimResult as unknown as ReturnType<typeof api.runFaultSimulation> extends Promise<infer T> ? T : never);
    mockApi.calculateRetransmission.mockResolvedValue(mockRetrans as ReturnType<typeof api.calculateRetransmission> extends Promise<infer T> ? T : never);

    await useScadaStore.getState().runGooseSimulation();

    expect(mockApi.runFaultSimulation).toHaveBeenCalledWith("busbar_overcurrent");
    expect(useScadaStore.getState().simulationResult).toEqual(mockSimResult);
    expect(useScadaStore.getState().retransmissionResult).toEqual(mockRetrans);
    expect(useScadaStore.getState().loading).toBe(false);
  });

  it("sets error on failure", async () => {
    mockApi.runFaultSimulation.mockRejectedValue(new Error("Simulation failed"));
    mockApi.calculateRetransmission.mockResolvedValue({} as ReturnType<typeof api.calculateRetransmission> extends Promise<infer T> ? T : never);

    await useScadaStore.getState().runGooseSimulation();

    expect(useScadaStore.getState().error).toBe("Simulation failed");
    expect(useScadaStore.getState().loading).toBe(false);
  });
});

describe("createPermit", () => {
  it("creates permit and refreshes list", async () => {
    const mockPermit = { ptw_number: "PtW-2025-001", status: "requested" };
    const mockList = { total: 1, permits: [{ ptw_number: "PtW-2025-001" }] };

    mockApi.createPermit.mockResolvedValue(mockPermit as ReturnType<typeof api.createPermit> extends Promise<infer T> ? T : never);
    mockApi.listPermits.mockResolvedValue(mockList as ReturnType<typeof api.listPermits> extends Promise<infer T> ? T : never);

    const result = await useScadaStore.getState().createPermit({
      work_description: "Replace CT wiring",
      equipment_id: "OSS_PROT_IED01",
      requested_by: "Control Engineer",
    });

    expect(result).toEqual(mockPermit);
    expect(useScadaStore.getState().activePermit).toEqual(mockPermit);
    expect(useScadaStore.getState().permitList).toEqual(mockList);
  });

  it("returns null on error", async () => {
    mockApi.createPermit.mockRejectedValue(new Error("Validation error"));

    const result = await useScadaStore.getState().createPermit({
      work_description: "Test",
      equipment_id: "IED01",
      requested_by: "User",
    });

    expect(result).toBeNull();
    expect(useScadaStore.getState().error).toBe("Validation error");
  });
});

describe("clearError", () => {
  it("clears the error state", () => {
    useScadaStore.setState({ error: "Something went wrong" });
    useScadaStore.getState().clearError();
    expect(useScadaStore.getState().error).toBeNull();
  });
});
