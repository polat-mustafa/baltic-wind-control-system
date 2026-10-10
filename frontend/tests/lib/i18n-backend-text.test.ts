/**
 * Backend text composed at run time (switching steps, equipment tooltips,
 * screening findings) translates through the `{name}` patterns, including the
 * recursive ones (a sediment mix of any length).
 */

import { beforeAll, describe, expect, it } from "vitest";

import { loadLanguage, translate } from "../../src/lib/i18n";

beforeAll(() => loadLanguage("tr"));

describe("Turkish for backend-composed text", () => {
  it("translates a switching step with its device tag and numbers", () => {
    expect(translate("tr", "Close CB-SR-01 — OSS shunt reactor 1 (180 Mvar) in service")).toBe(
      "CB-SR-01'i kapat — OSS şönt reaktörü 1 (180 Mvar) devrede",
    );
    expect(translate("tr", "Release the 6 turbines of string 2 — start-up and synchronisation per the turbine supplier's procedure")).toMatch(
      /^Dizi 2'nin 6 türbinini serbest bırak/,
    );
  });

  it("translates an SLD tooltip: tag, nested location pattern, state", () => {
    expect(translate("tr", "CB-SR-ON-01 — Onshore shunt reactor 1 (180 Mvar) circuit breaker, cable side of CB-ON-220-01 · CLOSED")).toBe(
      "CB-SR-ON-01 — Kara şönt reaktörü 1 (180 Mvar) kesicisi, CB-ON-220-01'in kablo tarafı · KAPALI",
    );
  });

  it("translates a seabed finding with a mix of any length", () => {
    const en =
      "Mixed sediment 40 %, Coarse-grained sediment 31 %, Sand 29 %, Mud to muddy sand 1 %. Mixed sediment: Gravel, sand and mud — in the Baltic often glacial till with boulders: boulder survey and clearance before piling. Boulders: pre-lay clearance (grab, plough) and more rock placement. A geotechnical survey decides.";
    expect(translate("tr", en)).toMatch(/^Karışık sediman %40, İri taneli sediman %31, Kum %29, Çamur – çamurlu kum %1\. Karışık sediman:/);
  });
});
