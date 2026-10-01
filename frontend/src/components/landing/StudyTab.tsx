/**
 * Study tab of the Scenario Center — evidence for the evaluation chapter:
 * participant code, completed drill scores, the System Usability Scale
 * questionnaire, summary statistics (mean ± SD, 95 % CI) and CSV export.
 * Everything stays in this browser until exported.
 */

import { useState } from "react";
import { Download } from "lucide-react";

import {
  SUS_ITEMS,
  studyCsv,
  summary,
  susGrade,
  useStudyStore,
} from "../../store/studyStore";

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function StudyTab() {
  const { participant, runs, sus, setParticipant, addSus, clear } = useStudyStore();
  const [answers, setAnswers] = useState<number[]>(Array(10).fill(0));
  const [last, setLast] = useState<number | null>(null);
  const complete = answers.every((a) => a > 0);

  const susStats = summary(sus.map((r) => r.score));
  const byScenario = Object.entries(
    runs.reduce<Record<string, number[]>>((m, r) => ({ ...m, [r.title]: [...(m[r.title] ?? []), r.score] }), {}),
  );

  return (
    <div className="max-h-[60vh] space-y-3 overflow-y-auto p-3 text-[12px] text-text-secondary">
      <label className="flex items-center gap-2 font-semibold">
        Participant code
        <input
          value={participant}
          onChange={(e) => setParticipant(e.target.value)}
          placeholder="e.g. P07 (no names)"
          className="flex-1 rounded border border-border-primary bg-bg-secondary px-2 py-1 font-mono text-text-primary"
          aria-label="Anonymous participant code"
        />
      </label>

      <section>
        <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-text-muted">Drill scores</h4>
        {byScenario.length === 0 ? (
          <p>No completed drills yet — finished Training drills are recorded here.</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full font-mono text-[11.5px]">
              <tbody>
                {byScenario.map(([title, scores]) => {
                  const s = summary(scores);
                  return (
                    <tr key={title}>
                      <td className="py-0.5 pr-2 font-sans font-semibold text-text-primary">{title}</td>
                      <td className="text-right">n={s.n}</td>
                      <td className="text-right">{s.mean.toFixed(0)}{s.n > 1 ? ` ± ${s.sd.toFixed(0)}` : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-text-muted">
          System Usability Scale (Brooke, 1996)
        </h4>
        <p className="mb-1.5">1 = strongly disagree … 5 = strongly agree</p>
        <ol className="space-y-1.5">
          {SUS_ITEMS.map((item, i) => (
            <li key={item}>
              <div className="font-semibold text-text-primary">
                {i + 1}. {item}
              </div>
              <div className="mt-0.5 flex gap-1" role="radiogroup" aria-label={`SUS item ${i + 1}`}>
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={answers[i] === v}
                    onClick={() => setAnswers((a) => a.map((x, k) => (k === i ? v : x)))}
                    className={
                      "h-6 w-7 rounded border font-mono text-[12px] font-bold " +
                      (answers[i] === v ? "border-accent bg-accent text-white" : "border-border-primary bg-bg-secondary")
                    }
                  >
                    {v}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ol>
        <button
          type="button"
          disabled={!complete}
          onClick={() => {
            setLast(addSus(answers));
            setAnswers(Array(10).fill(0));
          }}
          className="mt-2 w-full rounded border border-accent px-2 py-1 font-bold text-accent disabled:opacity-40"
        >
          Submit SUS
        </button>
        {last !== null && (
          <p className="mt-1 font-semibold text-text-primary">
            Recorded: SUS {last.toFixed(1)} (grade {susGrade(last)}; 68 = average across studies)
          </p>
        )}
      </section>

      <section className="rounded border border-border-primary bg-bg-secondary/60 p-2 font-mono text-[11.5px]">
        SUS n={susStats.n}
        {susStats.n > 0 && ` · mean ${susStats.mean.toFixed(1)} (${susGrade(susStats.mean)})`}
        {susStats.n > 1 && ` · SD ${susStats.sd.toFixed(1)} · 95 % CI ± ${susStats.ci95.toFixed(1)}`}
      </section>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            const csv = studyCsv(runs, sus);
            download("drill_scores.csv", csv.runs);
            download("sus_responses.csv", csv.sus);
          }}
          className="flex flex-1 items-center justify-center gap-1 rounded border border-border-primary px-2 py-1 font-semibold hover:bg-bg-hover"
        >
          <Download size={13} /> Export CSV
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Delete all study data stored in this browser?")) clear();
          }}
          className="rounded border border-border-primary px-2 py-1 text-text-muted hover:bg-bg-hover"
        >
          Clear
        </button>
      </div>
      <p className="text-[11px] text-text-muted">
        Anonymous codes only; data stays in this browser (localStorage) until exported.
      </p>
    </div>
  );
}
