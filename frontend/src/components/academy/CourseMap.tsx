/**
 * Course map: the four lifecycle tracks side by side, each with its lessons
 * (primer to read, or a module to explore) and its scored missions.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, CheckCircle2, Compass, Target } from "lucide-react";

import { MISSIONS, TRACKS, lessonId, lessonTitle, type Lesson } from "../../academy/courses";
import { cn } from "../../lib/utils";
import { bestScores, useAcademyStore } from "../../store/academyStore";
import type { EducationContent } from "../../types/education";
import { EducationPanel } from "../ui/EducationPanel";
import { ScoreBadge } from "./MissionFrame";

function LessonItem({ lesson, onRead }: { lesson: Lesson; onRead: (c: EducationContent) => void }) {
  const id = lessonId(lesson);
  const done = useAcademyStore((s) => s.lessons.includes(id));
  const openLesson = useAcademyStore((s) => s.openLesson);
  const Icon = done ? CheckCircle2 : lesson.kind === "read" ? BookOpen : Compass;
  const cls = "flex w-full items-start gap-1.5 rounded px-1.5 py-1 text-left text-[12px] hover:bg-bg-hover";
  const icon = <Icon size={13} className={cn("mt-0.5 shrink-0", done ? "text-status-normal" : "text-text-muted")} aria-hidden />;
  if (lesson.kind === "explore")
    return (
      <Link to={lesson.route} onClick={() => openLesson(id)} className={cls} title={lesson.note}>
        {icon}
        <span className="text-text-secondary">
          Explore: <span className="text-text-primary">{lesson.title}</span>
        </span>
      </Link>
    );
  return (
    <button
      type="button"
      className={cls}
      onClick={() => {
        openLesson(id);
        onRead(lesson.content);
      }}
    >
      {icon}
      <span className="text-text-primary">{lessonTitle(lesson)}</span>
    </button>
  );
}

export default function CourseMap({ active, onMission }: { active: string | null; onMission: (id: string) => void }) {
  const [reading, setReading] = useState<EducationContent | null>(null);
  const attempts = useAcademyStore((s) => s.attempts);
  const best = bestScores(attempts);

  return (
    <>
      <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-tour="academy-tracks">
        {TRACKS.map((t, i) => (
          <li key={t.id} className="flex flex-col rounded-lg border border-border-primary bg-bg-secondary p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">
              {i + 1} · {t.title}
            </p>
            <p className="mb-2 text-[12px] text-text-secondary">{t.goal}</p>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-muted">Lessons</h4>
            <ul className="mb-2 space-y-0.5">
              {t.lessons.map((l) => (
                <li key={lessonId(l)}>
                  <LessonItem lesson={l} onRead={setReading} />
                </li>
              ))}
            </ul>
            <h4 className="mb-1 mt-auto text-xs font-semibold uppercase tracking-wider text-text-muted">Missions</h4>
            <ul className="space-y-1" data-tour="academy-missions">
              {MISSIONS.filter((m) => m.track === t.id).map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => onMission(m.id)}
                    aria-pressed={active === m.id}
                    className={cn(
                      "flex w-full items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-[12px]",
                      active === m.id ? "border-accent bg-accent/10" : "border-border-primary hover:border-accent/60 hover:bg-bg-hover",
                    )}
                  >
                    <Target size={13} className="shrink-0 text-accent" aria-hidden />
                    <span className="min-w-0 flex-1 font-medium text-text-primary">{m.title}</span>
                    <ScoreBadge score={best[m.id]} />
                  </button>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      {reading && <EducationPanel content={reading} open onOpenChange={(o) => !o && setReading(null)} />}
    </>
  );
}
