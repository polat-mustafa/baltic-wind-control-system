/**
 * Tests for the AnomalyInjection panel (educational fault overlay).
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AnomalyInjection from "../../../src/components/p5/AnomalyInjection";
import { useCommissioningStore } from "../../../src/store/commissioningStore";

vi.mock("../../../src/store/commissioningStore");

beforeEach(() => {
  vi.mocked(useCommissioningStore).mockReturnValue({
    anomalies: [],
    injectAnomaly: vi.fn(),
    clearAnomaly: vi.fn(),
    clearAllAnomalies: vi.fn(),
  } as unknown as ReturnType<typeof useCommissioningStore>);
});

describe("AnomalyInjection", () => {
  it("renders the panel title", () => {
    render(<AnomalyInjection />);
    expect(screen.getByText("Anomaly Injection")).toBeDefined();
  });

  it("shows educational simulation label", () => {
    render(<AnomalyInjection />);
    expect(screen.getByText(/Educational.*Simulation/i)).toBeDefined();
  });

  it("lists available fault templates", () => {
    render(<AnomalyInjection />);
    expect(screen.getByText(/SF6.*Gas.*Leak|SF₆/i)).toBeDefined();
    expect(screen.getByText(/Comms.*Failure/i)).toBeDefined();
  });

  it("shows active anomaly count when anomalies exist", () => {
    vi.mocked(useCommissioningStore).mockReturnValue({
      anomalies: [
        { id: "a1", type: "sf6_leak", equipment_id: "CB-1", label: "SF6 Leak", active: true },
      ],
      injectAnomaly: vi.fn(),
      clearAnomaly: vi.fn(),
      clearAllAnomalies: vi.fn(),
    } as unknown as ReturnType<typeof useCommissioningStore>);

    render(<AnomalyInjection />);
    expect(screen.getByText(/1.*active|Active.*1/i)).toBeDefined();
  });
});
