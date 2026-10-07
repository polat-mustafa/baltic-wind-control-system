/** Own-project locks: each module follows the stage before it. */

import { describe, expect, it } from "vitest";

import { locks, type ProgressInput } from "../../src/lib/project/progress";

const EMPTY: ProgressInput = { hasSite: false, permitDone: false, outcome: null, turbines: 0, oss: false, problems: null, done: [] };
const LAID_OUT: ProgressInput = { hasSite: true, permitDone: true, outcome: "approved", turbines: 34, oss: true, problems: 0, done: [] };
const open = (i: ProgressInput) =>
  Object.entries(locks(i))
    .filter(([, l]) => l === null)
    .map(([p]) => p);

describe("locks", () => {
  it("opens nothing but the always-open modules for an empty project", () => {
    const l = locks(EMPTY);
    expect(open(EMPTY)).toEqual([]);
    expect(l["/develop/layout"]?.go).toBe("/develop"); // a lock always says where to go
    expect(l["/scada"]?.need).toMatch(/Draw a site/); // the first missing step, not the last
    expect(l["/develop"]).toBeUndefined(); // Site & Permits, Control Room, Academy: never locked
  });

  it("opens Layout only after a permit that was not refused", () => {
    const site = { ...EMPTY, hasSite: true };
    expect(open(site)).toEqual(["/wind-resource"]);
    expect(locks({ ...site, permitDone: true, outcome: "refused" })["/develop/layout"]?.need).toMatch(/refused/);
    expect(locks({ ...site, permitDone: true })["/develop/layout"]?.need).toMatch(/assessment/);
    expect(open({ ...site, permitDone: true, outcome: "approved_with_conditions" })).toContain("/develop/layout");
  });

  it("opens Grid and Construction for a complete layout without rule breaches", () => {
    expect(locks({ ...LAID_OUT, oss: false })["/hv-grid"]?.need).toMatch(/offshore substation/);
    expect(locks({ ...LAID_OUT, problems: null })["/hv-grid"]?.need).toMatch(/Checking/);
    expect(locks({ ...LAID_OUT, problems: 2 })["/build"]?.need).toMatch(/2 turbine/);
    expect(open(LAID_OUT)).toEqual(["/wind-resource", "/develop/layout", "/hv-grid", "/build"]);
  });

  it("walks construction → commissioning → hand-over → operation", () => {
    expect(open({ ...LAID_OUT, done: ["build"] })).toContain("/commissioning");
    expect(open({ ...LAID_OUT, done: ["build", "commissioning"] })).toContain("/build/handover");
    const all = open({ ...LAID_OUT, done: ["build", "commissioning", "handover"] });
    expect(all).toEqual(expect.arrayContaining(["/scada", "/forecast", "/digital-twin", "/decommission"]));
    // a milestone does not skip the stages before it
    expect(locks({ ...LAID_OUT, problems: 1, done: ["build", "commissioning", "handover"] })["/scada"]?.go).toBe("/develop/layout");
  });
});
