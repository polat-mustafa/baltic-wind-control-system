import { describe, expect, it } from "vitest";

import { makeTurbulence, turbAt } from "../../../../src/components/landing/turbine3d/model/turbulence";

describe("synthetic turbulence (random Fourier modes)", () => {
  const f = makeTurbulence(7);
  const o = { x: 0, y: 0, z: 0 };

  it("has roughly unit longitudinal σ and IEC anisotropy", () => {
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (let i = 0; i < 4000; i++) {
      turbAt(f, (i * 37.1) % 3000, 20 + ((i * 11.3) % 280), (i * 53.7) % 4000, 0, 10, o);
      sx += o.x * o.x; sy += o.y * o.y; sz += o.z * o.z; n++;
    }
    const su = Math.sqrt(sz / n);
    expect(su).toBeGreaterThan(0.6);
    expect(su).toBeLessThan(1.5);
    expect(Math.sqrt(sy / n)).toBeLessThan(su); // σ_w < σ_u
    expect(Math.sqrt(sx / n)).toBeLessThan(su * 1.2);
  });

  it("is spatially coherent: nearby points correlate, far points do not", () => {
    const pairs = (dz: number) => {
      let c = 0, a2 = 0, b2 = 0;
      for (let i = 0; i < 3000; i++) {
        const x = (i * 71.3) % 3000, y = 50 + ((i * 17.9) % 200), z = (i * 97.1) % 5000;
        const a = turbAt(f, x, y, z, 0, 10, { x: 0, y: 0, z: 0 }).z;
        const b = turbAt(f, x, y, z + dz, 0, 10, { x: 0, y: 0, z: 0 }).z;
        c += a * b; a2 += a * a; b2 += b * b;
      }
      return c / Math.sqrt(a2 * b2);
    };
    expect(pairs(5)).toBeGreaterThan(0.8);
    expect(Math.abs(pairs(2000))).toBeLessThan(0.35);
  });

  it("is frozen and advected with the mean wind (Taylor)", () => {
    const a = turbAt(f, 100, 150, 0, 0, 10, { x: 0, y: 0, z: 0 });
    const b = turbAt(f, 100, 150, -50, 5, 10, { x: 0, y: 0, z: 0 }); // 50 m downwind after 5 s at 10 m/s
    expect(b.z).toBeCloseTo(a.z, 5);
  });
});
