/**
 * TransformerDetailPanel: IEC 60076-7 ageing rate and the OSS single-line diagram.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import TransformerDetailPanel from "../../../src/components/landing/TransformerDetailPanel";
import type { TransformerData } from "../../../src/types/landing";
import { ageingRate } from "../../../src/utils/landingPhysics";

const OSS_TX: TransformerData = {
  name: "TX-OSS-01/02",
  type: "Three-phase ONAN/ONAF",
  ratingMVA: 300,
  units: 2,
  hvKV: 220,
  lvKV: 66,
  tapPosition: 0,
  totalTaps: 17,
  oilTemperatureC: 54,
  windingTempHVC: 66,
  windingTempLVC: 62,
  loadPercent: 76,
  coolingStatus: "ONAN",
  buchholzStatus: "Normal",
  dgaStatus: "Normal",
  operatingHours: 18500,
};

describe("ageingRate (IEC 60076-7, non-upgraded paper)", () => {
  it("is 1 at the 98 °C reference and doubles every 6 K", () => {
    expect(ageingRate(98)).toBeCloseTo(1);
    expect(ageingRate(104)).toBeCloseTo(2);
    expect(ageingRate(92)).toBeCloseTo(0.5);
  });
});

describe("TransformerDetailPanel", () => {
  it("draws the OSS single-line diagram with one feeder per SB-510 string", () => {
    render(<TransformerDetailPanel transformer={OSS_TX} onClose={vi.fn()} onNavigate={vi.fn()} navLabel="Open SCADA" />);
    const sld = screen.getByRole("img", { name: "OSS single-line diagram" });
    for (const s of ["S1", "S2", "S3", "S4", "S5", "S6"]) expect(sld.textContent).toContain(s);
    // 76 % of 2 × 300 MVA = 456 MVA → the surviving unit carries 300, 156 MW curtailed
    expect(screen.getByText("curtail 156 MW")).toBeTruthy();
  });

  it("shows unit cards instead of the diagram onshore", () => {
    render(
      <TransformerDetailPanel
        transformer={{ ...OSS_TX, name: "TX-ONS-01/02", lvKV: 220, hvKV: 400 }}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
        navLabel="Open HV Grid"
      />,
    );
    expect(screen.queryByRole("img", { name: "OSS single-line diagram" })).toBeNull();
    expect(screen.getByText("Circuit 2")).toBeTruthy();
  });
});
