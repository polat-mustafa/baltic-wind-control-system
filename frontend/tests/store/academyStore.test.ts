import { beforeEach, describe, expect, it } from "vitest";

import { ACADEMY_KEY, bestScores, drillMissionId, passed, useAcademyStore } from "../../src/store/academyStore";
import { useTrainingStore } from "../../src/store/trainingStore";
import { MISSIONS, TRACKS, lessonId } from "../../src/academy/courses";

const s = () => useAcademyStore.getState();

describe("academyStore", () => {
  beforeEach(() => {
    localStorage.clear();
    s().reset();
  });

  it("records attempts, clamps scores and persists them", () => {
    s().setLearner("  Ada  ");
    s().record({ mission: "frt-compliance", score: 64.6, detail: "x", seed: 7 });
    s().record({ mission: "frt-compliance", score: 140, detail: "y" });
    s().openLesson("p1.weibull");
    s().openLesson("p1.weibull");
    expect(s().learner).toBe("Ada");
    expect(s().attempts.map((a) => a.score)).toEqual([65, 100]);
    expect(s().lessons).toEqual(["p1.weibull"]);
    const stored = JSON.parse(localStorage.getItem(ACADEMY_KEY)!);
    expect(stored.attempts).toHaveLength(2);
    expect(bestScores(s().attempts)).toEqual({ "frt-compliance": 100 });
  });

  it("exports a JSON record", () => {
    s().record({ mission: "site-selection", score: 80, detail: "" });
    const out = JSON.parse(s().exportJson());
    expect(out).toMatchObject({ app: "OffshoreForge", record: "academy", schema: 1 });
    expect(out.attempts[0].mission).toBe("site-selection");
  });

  it("passes at 70", () => {
    expect(passed(70)).toBe(true);
    expect(passed(69)).toBe(false);
    expect(passed(undefined)).toBe(false);
  });

  it("records a finished control-room drill", () => {
    useTrainingStore.getState().setVoice(false);
    useTrainingStore.getState().start("underfrequency");
    const steps = useTrainingStore.getState().active!.steps.length;
    for (let i = 0; i < steps; i++) useTrainingStore.getState().skip();
    useTrainingStore.getState().stop();
    const a = s().attempts.at(-1)!;
    expect(a.mission).toBe(drillMissionId("underfrequency"));
    expect(a.score).toBe(Math.max(0, 100 - 15 * steps));
  });
});

describe("course map", () => {
  it("has unique lesson and mission ids, and every drill maps to a scenario mission", () => {
    const lessons = TRACKS.flatMap((t) => t.lessons.map(lessonId));
    expect(new Set(lessons).size).toBe(lessons.length);
    const ids = MISSIONS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of MISSIONS) if (m.kind === "drill") expect(m.id).toBe(drillMissionId(m.scenario!));
    for (const t of TRACKS) expect(MISSIONS.some((m) => m.track === t.id)).toBe(true);
  });
});
