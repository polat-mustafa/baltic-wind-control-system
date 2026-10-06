import { describe, expect, it } from "vitest";
import * as THREE from "three";

import {
  aeroHeatingK,
  chordFraction,
  evaluateBladeField,
  fieldToUnit,
  unitToField,
  flapMomentMNm,
  pressureCoefficient,
  sectionState,
  type BladeOperatingPoint,
} from "../../../../src/components/landing/turbine3d/model/bladeField";
import { BLADE_LENGTH_M, STATIONS } from "../../../../src/components/landing/turbine3d/scene/bladeConstants";
import { V236, v236ThrustMN } from "../../../../src/utils/landingPhysics";

const RATED: BladeOperatingPoint = { windMs: 11.1, rpm: 8.33, pitchDeg: 0 };

describe("sectionState", () => {
  it("tip relative wind ≈ ωR ≈ 103 m/s at rated", () => {
    const tip = sectionState(BLADE_LENGTH_M, RATED);
    expect(tip.w).toBeGreaterThan(100);
    expect(tip.w).toBeLessThan(106);
    expect(tip.q).toBeCloseTo(0.5 * 1.225 * tip.w ** 2, 6);
  });

  it("outboard angle of attack is in the attached-flow design range (3–7°) at rated", () => {
    for (const span of [50, 80, 110]) {
      const a = sectionState(span, RATED).alphaDeg;
      expect(a).toBeGreaterThan(3);
      expect(a).toBeLessThan(7);
    }
  });

  it("pitching above rated lowers the angle of attack", () => {
    const at15 = sectionState(90, { windMs: 15, rpm: 8.33, pitchDeg: 10 });
    expect(at15.alphaDeg).toBeLessThan(sectionState(90, RATED).alphaDeg);
  });
});

describe("thermal — kinetic heating", () => {
  it("stagnation rise is W²/2cp (≈ 5 K at 103 m/s), lower aft of the LE", () => {
    expect(aeroHeatingK(103, 0)).toBeCloseTo((103 * 103) / 2010, 3);
    expect(aeroHeatingK(103, 0)).toBeGreaterThan(5);
    expect(aeroHeatingK(103, 0.5)).toBeCloseTo(0.89 * aeroHeatingK(103, 0), 2);
  });

  it("tip is warmer than the root (rise ∝ W²)", () => {
    const tip = aeroHeatingK(sectionState(BLADE_LENGTH_M, RATED).w, 0);
    const root = aeroHeatingK(sectionState(0, RATED).w, 0);
    expect(tip).toBeGreaterThan(10 * root);
  });
});

describe("pressure coefficient", () => {
  it("stagnation Cp = 1 at the leading edge", () => {
    expect(pressureCoefficient(0, false, 5, 0.21)).toBeCloseTo(1, 6);
  });

  it("suction side is below free stream, pressure side above, at α = 5°", () => {
    const cpU = pressureCoefficient(0.3, true, 5, 0.21);
    const cpL = pressureCoefficient(0.3, false, 5, 0.21);
    expect(cpU).toBeLessThan(0);
    expect(cpL).toBeGreaterThan(0);
  });

  it("suction peak near the LE is −1 … −3 at α = 5°", () => {
    const peak = Math.min(...[0.01, 0.015, 0.02, 0.03].map((x) => pressureCoefficient(x, true, 5, 0.21)));
    expect(peak).toBeLessThan(-1);
    expect(peak).toBeGreaterThan(-3);
  });

  it("integrated ΔCp gives a lift slope near 2π plus camber lift", () => {
    let cl = 0;
    const n = 2000;
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5) / n;
      cl += (pressureCoefficient(x, false, 5, 0.21) - pressureCoefficient(x, true, 5, 0.21)) / n;
    }
    // thin-airfoil: 2π·α + 4π·m = 0.548 + 0.44 ≈ 0.99 (stagnation ramp trims the LE)
    expect(cl).toBeGreaterThan(0.75);
    expect(cl).toBeLessThan(1.15);
  });
});

describe("flapwise bending", () => {
  it("root moment ≈ T/3 · (2R/3 − r_h) ≈ 62 MN·m at rated, zero at the tip", () => {
    const t = v236ThrustMN(V236.ratedMs); // ≈ 2.45 MN
    expect(flapMomentMNm(0, t)).toBeGreaterThan(55);
    expect(flapMomentMNm(0, t)).toBeLessThan(70);
    expect(flapMomentMNm(BLADE_LENGTH_M, t)).toBeCloseTo(0, 6);
  });

  it("decreases monotonically along the span", () => {
    const t = v236ThrustMN(11.1);
    let prev = Infinity;
    for (let s = 0; s <= BLADE_LENGTH_M; s += 5) {
      const m = flapMomentMNm(s, t);
      expect(m).toBeLessThanOrEqual(prev);
      prev = m;
    }
  });
});

describe("chordFraction", () => {
  it("recovers LE (0) and TE (1) of a twisted, swept section", () => {
    const st = STATIONS[7]; // 80 m, twist 1.8°, sweep 0.3, prebend 2.55
    const a = (-st.twistDeg * Math.PI) / 180;
    const place = (xi: number) => {
      const px = (xi - 0.25) * st.chord;
      const xt = Math.cos(a) * px;
      const zt = -Math.sin(a) * px;
      return [-(xt + st.sweep), st.span, -zt + st.prebend] as const;
    };
    expect(chordFraction(...place(0))).toBeCloseTo(0, 2);
    expect(chordFraction(...place(1))).toBeCloseTo(1, 2);
    expect(chordFraction(...place(0.5))).toBeCloseTo(0.5, 2);
  });
});

describe("evaluateBladeField", () => {
  const geom = new THREE.BufferGeometry();
  // two vertices: root and tip leading edges (uv.x = 0.5)
  geom.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1.35, 0, 0, -1.2 + 0.1, 115.5, 5]), 3));
  geom.setAttribute("uv", new THREE.BufferAttribute(new Float32Array([0.5, 0, 0.5, 1]), 2));

  it("colours every vertex and reports a stopped rotor as zero load", () => {
    const colors = new Float32Array(6);
    const s = evaluateBladeField(geom, "bending", { ...RATED, rpm: 0 }, colors);
    expect(s.max).toBe(0);
    expect(s.root).toBe(0);
    expect(colors.every((v) => Number.isFinite(v))).toBe(true);
  });

  it("thermal summary: tip LE ≈ 5 K at rated", () => {
    const s = evaluateBladeField(geom, "thermal", RATED, new Float32Array(6));
    expect(s.tip).toBeGreaterThan(5);
    expect(s.tip).toBeLessThan(5.8);
  });
});

describe("colour-bar mapping", () => {
  it("unitToField inverts fieldToUnit (sqrt and linear scales)", () => {
    for (const mode of ["thermal", "pressure", "bending"] as const) {
      for (const t of [0, 0.1, 0.25, 0.5, 0.8, 1]) {
        expect(fieldToUnit(mode, unitToField(mode, t))).toBeCloseTo(t, 6);
      }
    }
  });

  it("pressure is diverging: free stream at the middle, suction below", () => {
    expect(fieldToUnit("pressure", 0)).toBe(0.5);
    expect(fieldToUnit("pressure", -2.5)).toBeCloseTo(0.25, 6);
    expect(fieldToUnit("pressure", 99)).toBe(1);
  });
});
