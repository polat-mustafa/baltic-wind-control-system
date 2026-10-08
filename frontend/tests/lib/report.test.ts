import { describe, expect, it, vi } from "vitest";

import { OSS_GEO, SB510_EXPORT_KM, TURBINE_POSITIONS } from "../../src/constants/windFarmLayout";
import { DEFAULT_TURBINE_ID } from "../../src/constants/turbineModels";
import { DEFAULT_COSTS } from "../../src/lib/layout/cost";
import { buildReport, findMoves, REPORT_SCHEMA, type ReportInput } from "../../src/lib/project/report";
import { CASE_STUDY_SITE } from "../../src/store/siteStore";

const input = (over: Partial<ReportInput> = {}): ReportInput => ({
  name: "SB-510",
  reference: true,
  generated: "2026-10-08 12:00 UTC",
  turbineModel: DEFAULT_TURBINE_ID,
  site: CASE_STUDY_SITE,
  turbines: TURBINE_POSITIONS.map((t) => ({ id: t.id, lon: t.lon, lat: t.lat })),
  oss: [OSS_GEO.lon, OSS_GEO.lat],
  costs: DEFAULT_COSTS,
  exportKm: SB510_EXPORT_KM,
  assessment: null,
  layers: null,
  depthAt: () => 44,
  pywake: null,
  history: [],
  moves: null,
  network: null,
  loadFlow: null,
  construction: null,
  ...over,
});

describe("project report", () => {
  const rep = buildReport(input());

  it("takes the external wake loss of the neighbours off the net energy", () => {
    const ext = buildReport(input({ external: { lossPct: 4.77, farms: 9, turbines: 646 } }));
    expect(ext.energy.external_wake).toMatchObject({ loss_pct: 4.77, farms: 9, virtual_turbines: 646 });
    expect(ext.energy.net_gwh / rep.energy.net_gwh).toBeCloseTo(1 - 0.0477, 3);
    expect(rep.energy.external_wake).toBeNull();
  });

  it("is plain JSON (the download is the object itself)", () => {
    expect(rep.schema).toBe(REPORT_SCHEMA);
    expect(JSON.parse(JSON.stringify(rep))).toEqual(rep);
    expect(rep.note).toMatch(/re-verify/);
  });

  it("reports SB-510 with physically sane numbers", () => {
    expect(rep.layout.turbines).toBe(34);
    expect(rep.layout.capacity_mw).toBe(510); // MW
    expect(rep.layout.problems).toEqual({ outside: 0, excluded: 0, basin: 0, close: 0 });
    expect(rep.layout.min_spacing_d).toBeGreaterThan(5.9); // 6 D along a string
    const s = rep.energy.screening!;
    expect(s.net_wake_gwh).toBeLessThanOrEqual(s.gross_gwh);
    expect(s.wake_loss_pct).toBeGreaterThan(2);
    expect(s.wake_loss_pct).toBeLessThan(12);
    expect(s.capacity_factor).toBeGreaterThan(0.35); // CF 0.35–0.55 offshore Baltic, wake only
    expect(s.capacity_factor).toBeLessThan(0.55);
    expect(rep.energy.net_gwh).toBeCloseTo(s.net_wake_gwh * 0.92, -1); // GWh/yr after 8 % other losses
    expect(rep.energy.turbines).toHaveLength(34);
    expect(rep.energy.turbines[0]).toMatchObject({ id: "WTG-01", depth_m: 44, status: "ok" });
    expect(rep.layout.strings).toBeGreaterThanOrEqual(6); // ≤ 6 × 15 MW per 66 kV string
    expect(rep.cost.capex_meur_per_mw).toBeGreaterThan(2);
    expect(rep.cost.lcoe_eur_mwh).toBeGreaterThan(40);
    expect(rep.cost.lcoe_eur_mwh).toBeLessThan(150); // €/MWh
    expect(rep.site).toBeNull();
    expect(rep.permit.outcome).toBe("more_information");
  });

  it("uses PyWake when it ran for this layout", () => {
    const per = Array.from({ length: 34 }, () => 60);
    const r = buildReport(
      input({
        pywake: { gross_aep_gwh: 2500, net_aep_gwh: 2350, wake_loss_percent: 6, capacity_factor: 0.526, per_turbine_aep_gwh: per, per_turbine_wake_loss_percent: per },
      }),
    );
    expect(r.energy.basis).toBe("PyWake");
    expect(r.energy.net_gwh).toBe(2166); // 2350 × (1 − 7.83 %)
    expect(r.energy.turbines[5].net_gwh).toBe(60);
  });

  it("finds moves and keeps PyWake's verdict", async () => {
    const check = vi.fn(async (_x: number[], _y: number[], moves: { index: number }[]) => ({
      base_net_aep_gwh: 2350,
      moves: moves.map((m, k) => ({ index: m.index, net_aep_gwh: 2350, delta_gwh: k === 0 ? 1 : -1, delta_percent: k === 0 ? 0.04 : -0.04, wake_loss_percent: 6 })),
    }));
    const moves = await findMoves(input(), check);
    expect(moves.list.length).toBeGreaterThan(0);
    expect(check).toHaveBeenCalledOnce();
    const r = buildReport(input({ moves }));
    expect(r.moves?.[0]).toMatchObject({ confirmed: true, pywake_gain_pct: 0.04 });
    expect(r.moves?.slice(1).every((m) => m.confirmed === false)).toBe(true);
  });
});
