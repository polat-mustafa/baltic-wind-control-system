/**
 * Academy (route /academy): a course map along the project lifecycle with
 * lessons and scored missions, local progress and a printable training
 * record. The open mission lives in the URL (?mission=<id>) so it can be
 * linked and survives a reload.
 *
 * Logic: src/academy (courses, scoring, FRT cases, energisation sequence);
 * progress: store/academyStore (of.academy.v1).
 */

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FileText, GraduationCap, RotateCcw } from "lucide-react";

import { MISSIONS, TRACKS, lessonId, missionById } from "../academy/courses";
import { bestScores, PASS_MARK, passed, useAcademyStore } from "../store/academyStore";
import { Button } from "../components/ui/Button";
import CourseMap from "../components/academy/CourseMap";
import MissionFrame from "../components/academy/MissionFrame";
import { LayoutMission, SiteMission } from "../components/academy/WorkMissions";
import SequenceMission from "../components/academy/SequenceMission";
import FrtMission from "../components/academy/FrtMission";
import DiagnosisMission from "../components/academy/DiagnosisMission";
import DrillMission from "../components/academy/DrillMission";
import TrainingRecord from "../components/academy/TrainingRecord";

function MissionBody({ id }: { id: string }) {
  const m = missionById(id)!;
  if (m.kind === "drill") return <DrillMission mission={m} />;
  switch (id) {
    case "site-selection":
      return <SiteMission />;
    case "layout-challenge":
      return <LayoutMission />;
    case "energisation-sequence":
      return <SequenceMission />;
    case "frt-compliance":
      return <FrtMission />;
    case "twin-diagnosis":
      return <DiagnosisMission />;
    default:
      return null;
  }
}

function Progress() {
  const learner = useAcademyStore((s) => s.learner);
  const setLearner = useAcademyStore((s) => s.setLearner);
  const lessons = useAcademyStore((s) => s.lessons);
  const attempts = useAcademyStore((s) => s.attempts);
  const best = bestScores(attempts);
  const all = TRACKS.flatMap((t) => t.lessons.map(lessonId));
  const read = all.filter((id) => lessons.includes(id)).length;
  const done = MISSIONS.filter((m) => passed(best[m.id])).length;
  const [name, setName] = useState(learner);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-[12px]" data-tour="academy-progress">
      <label className="flex items-center gap-1.5 text-text-secondary">
        Learner
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setLearner(name)}
          placeholder="name on the record"
          maxLength={48}
          className="w-40 rounded border border-border-primary bg-bg-tertiary px-1.5 py-0.5 text-text-primary"
        />
      </label>
      <span className="text-text-secondary">
        Lessons <span className="font-semibold tabular-nums text-text-primary">{read}</span> / {all.length}
      </span>
      <span className="text-text-secondary">
        Missions passed <span className="font-semibold tabular-nums text-text-primary">{done}</span> / {MISSIONS.length}
      </span>
      <span className="text-text-muted">Pass mark {PASS_MARK}. Progress stays in this browser.</span>
    </div>
  );
}

export default function AcademyPage() {
  const [params, setParams] = useSearchParams();
  const view = params.get("view");
  const mission = params.get("mission");
  const active = mission && missionById(mission) ? mission : null;
  const reset = useAcademyStore((s) => s.reset);
  const learner = useAcademyStore((s) => s.learner);
  const missionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (active) missionRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [active]);

  const open = (id: string | null) => setParams(id ? { mission: id } : {});

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2" data-tour="page-header">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-text-primary">
            <GraduationCap size={20} className="text-accent" aria-hidden />
            Academy
          </h2>
          <p className="mt-1 text-xs text-text-muted">
            Learn the lifecycle of an offshore wind farm — develop, design, build, operate — with lessons and scored missions graded on
            the engines of this platform and on your own project.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant={view === "record" ? "primary" : "secondary"} size="sm" onClick={() => setParams(view === "record" ? {} : { view: "record" })}>
            <FileText size={13} /> Training record
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (window.confirm("Delete all Academy progress in this browser?")) reset();
            }}
          >
            <RotateCcw size={13} /> Reset
          </Button>
        </div>
      </div>

      <Progress key={learner} />

      {view === "record" ? (
        <TrainingRecord />
      ) : (
        <>
          <CourseMap active={active} onMission={(id) => open(id === active ? null : id)} />
          {active && (
            <div ref={missionRef} className="scroll-mt-4">
              <MissionFrame key={active} mission={missionById(active)!} onClose={() => open(null)}>
                <MissionBody id={active} />
              </MissionFrame>
            </div>
          )}
        </>
      )}
    </div>
  );
}
