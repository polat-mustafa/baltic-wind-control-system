import { describe, expect, it } from "vitest";

import { DIP_START_S, frequencyEvent, lvrtLimit, voltageDipEvent } from "../../src/utils/gridEvents";

describe("CE reference incident (3 GW loss)", () => {
  const traj = frequencyEvent("underfrequency", 400, 0, 510);
  const nadir = traj.reduce((m, s) => (s.f < m.f ? s : m));

  it("dips to ≈ 49.7 Hz and settles within 200 mHz", () => {
    expect(nadir.f).toBeGreaterThan(49.6);
    expect(nadir.f).toBeLessThan(49.8);
    expect(nadir.t).toBeGreaterThan(8);
    expect(nadir.t).toBeLessThan(18);
    expect(50 - traj[traj.length - 1].f).toBeLessThan(0.2);
    // initial RoCoF = −ΔP/(2HS)·f0 = −0.05 Hz/s
    expect((traj[20].f - 50) / traj[20].t).toBeCloseTo(-0.05, 2);
  });

  it("gives no LFSM-U response at MPPT, but ~16 MW with a 5 % Δ-reserve", () => {
    const maxUp = (r: typeof traj) => Math.max(...r.map((s) => s.pMW)) - r[0].pMW;
    expect(maxUp(traj)).toBeCloseTo(0, 6);
    const withReserve = frequencyEvent("underfrequency", 400, 5, 510);
    expect(maxUp(withReserve)).toBeGreaterThan(8);
    expect(maxUp(withReserve)).toBeLessThanOrEqual(400 / 0.95 - 400 + 1e-9); // headroom
  });

  it("reduces output above 50.2 Hz (LFSM-O)", () => {
    const of = frequencyEvent("overfrequency", 400, 0, 510);
    expect(Math.max(...of.map((s) => s.f))).toBeGreaterThan(50.2);
    expect(Math.min(...of.map((s) => s.pMW))).toBeLessThan(400);
  });
});

describe("voltage dip / FRT", () => {
  const traj = voltageDipEvent(450, 510);

  it("stays above the PSE LVRT envelope and injects reactive current", () => {
    for (const s of traj) expect(s.u).toBeGreaterThanOrEqual(lvrtLimit(s.t - DIP_START_S) - 1e-9);
    const during = traj.find((s) => s.t === 0.1)!;
    expect(during.qMVAr).toBeGreaterThan(0);
    expect(during.statcomMVAr).toBeGreaterThan(0);
    expect(during.pMW).toBeLessThan(10); // reactive current priority
  });

  it("holds 0.3 pu for the 140 ms the drill text states", () => {
    const dip = traj.filter((s) => s.u === 0.3);
    expect(dip[0].t).toBeCloseTo(DIP_START_S, 6);
    // the last 0.3 pu sample is the clearance instant, where the recovery ramp starts
    expect(dip[dip.length - 1].t - dip[0].t).toBeCloseTo(0.14, 6);
  });

  it("recovers ≥ 90 % of pre-fault power within 1 s of clearance", () => {
    const after = traj.find((s) => Math.abs(s.t - (DIP_START_S + 0.14 + 1)) < 1e-6)!;
    expect(after.pMW).toBeGreaterThanOrEqual(0.9 * 450);
  });
});

describe("grid events scale with the farm", () => {
  it("LFSM-U response is a droop on the farm's own Pmax", () => {
    const peak = (pmax: number) => Math.max(...frequencyEvent("underfrequency", 0.8 * pmax, 10, pmax).map((s) => s.pMW - 0.8 * pmax));
    expect(peak(150) / peak(510)).toBeCloseTo(150 / 510, 1);
  });
});
