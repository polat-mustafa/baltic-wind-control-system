import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { debriefStats, useInstructorStore } from "../../src/store/instructorStore";
import { useLandingStore } from "../../src/store/landingStore";

describe("instructor console", () => {
  beforeEach(() => vi.useFakeTimers({ now: 1_000_000 }));
  afterEach(() => {
    useInstructorStore.getState().stop();
    vi.useRealTimers();
  });

  it("records an injected turbine fault and the operator's reset with its response time", () => {
    const ins = useInstructorStore.getState();
    ins.injectTurbineFault("WTG-05", "PITCH_CONTROL_FAULT");
    expect(useInstructorStore.getState().recording).toBe(true);
    expect(useLandingStore.getState().turbineMap["WTG-05"].status).toBe("fault");

    vi.setSystemTime(1_000_000 + 42_000);
    useLandingStore.getState().clearTurbineFault("WTG-05");

    const { injections, events } = useInstructorStore.getState();
    expect(injections[0].clearedT).toBe(42_000);
    expect(events.some((e) => e.kind === "operator" && /WTG-05 fault reset \(42 s\)/.test(e.text))).toBe(true);
    expect(debriefStats(injections)).toMatchObject({ injected: 1, cleared: 1, meanS: 42, worstS: 42 });
  });

  it("keeps a wind veer open until the farm is realigned", () => {
    useInstructorStore.getState().injectWindVeer(90);
    expect(useLandingStore.getState().manualWindDirDeg).not.toBeNull();
    expect(useInstructorStore.getState().injections.at(-1)?.clearedT).toBeNull();
    useLandingStore.getState().setManualWindDir(null);
  });

  it("exports the session as JSON", () => {
    const ins = useInstructorStore.getState();
    ins.start();
    ins.note("briefing done");
    const out = JSON.parse(useInstructorStore.getState().exportJson());
    expect(out.events.map((e: { text: string }) => e.text)).toContain("briefing done");
  });
});
