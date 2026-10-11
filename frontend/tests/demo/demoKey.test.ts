import { describe, expect, it } from "vitest";

import { demoFile } from "../../src/demo/demoKey";

describe("demoFile — recorder and demo build must agree on the file name", () => {
  it("is readable and deterministic", () => {
    const f = demoFile("GET", "/api/v1/grid/network-spec");
    expect(f).toMatch(/^grid_network_spec-[0-9a-f]{8}\.json$/);
    expect(demoFile("get", "/api/v1/grid/network-spec")).toBe(f);
  });

  it("separates method, query and body", () => {
    const base = demoFile("POST", "/api/v1/wind/wind-rose", '{"a":1}');
    expect(demoFile("POST", "/api/v1/wind/wind-rose", '{"a":2}')).not.toBe(base);
    expect(demoFile("GET", "/api/v1/wind/wind-rose")).not.toBe(base);
    expect(demoFile("GET", "/api/v1/x?y=1")).not.toBe(demoFile("GET", "/api/v1/x?y=2"));
  });
});
