/**
 * The energisation replay steps through the load-flow frames of the backend
 * trace: the SLD and the step text follow the frame, the readings come from it.
 */

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import EnergisationReplay from "../../../src/components/p5/EnergisationReplay";
import type { EnergisationTrace } from "../../../src/types/commissioning";
import { programme } from "./fixture";

const base = programme();
const dead = { ...base.network, cable_i_send_a: null, cable_i_recv_a: null, poc_q_mvar: 0, generation_mw: 0 };
const trace: EnergisationTrace = {
  farm: base.farm,
  equipment: base.equipment_states,
  cable_rating_a: 825,
  frames: [
    { step_id: "0", step_number: 0, phase: 0, action: "Plant as built: earthed, nothing live", equipment_id: "", states: {}, network: dead },
    {
      step_id: "2.11",
      step_number: 30,
      phase: 2,
      action: "Close CB-ON-220-01 — export cable 1 energised from shore",
      equipment_id: "CB-ON-220-01",
      states: {},
      network: { ...dead, cable_i_send_a: 833, poc_q_mvar: 133, zones: { ...dead.zones, ONS220: "live", CABLE1: "live" } },
    },
  ],
};

vi.mock("../../../src/services/commissioningApi", () => ({ getEnergisationTrace: () => Promise.resolve(trace) }));
vi.mock("framer-motion", () => ({ useReducedMotion: () => true })); // no autoplay

describe("EnergisationReplay", () => {
  it("steps through the frames with the load-flow readings", async () => {
    render(<EnergisationReplay onClose={() => {}} />);
    expect(await screen.findByText(/Plant as built/)).toBeDefined();
    expect(screen.getByRole("img", { name: "Circuit 1 single-line diagram" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(screen.getByText(/export cable 1 energised from shore/)).toBeDefined();
    expect(screen.getByText(/cable 833 A at the shore end \(101 % of 825 A\)/)).toBeDefined();
    expect(screen.getByText(/\+133 Mvar into PSE/)).toBeDefined();
    expect(screen.getByRole("button", { name: /Replay/ })).toBeDefined(); // last frame
  });
});
