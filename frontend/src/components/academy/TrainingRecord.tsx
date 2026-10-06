/**
 * Printable training record of this browser's Academy progress. Printed
 * with the same rule as the Site & Permits documents (index.css: only
 * `.print-doc[data-printing]` is printed). Self-recorded, so it says plainly
 * that it is not a certificate of competence.
 */

import { useState } from "react";
import { Download, Printer } from "lucide-react";

import { MISSIONS, TRACKS, lessonId } from "../../academy/courses";
import { bestScores, PASS_MARK, passed, useAcademyStore } from "../../store/academyStore";
import { Button } from "../ui/Button";

const date = (iso: string) => iso.slice(0, 10);

export default function TrainingRecord() {
  const { learner, lessons, attempts, exportJson } = useAcademyStore();
  const [printing, setPrinting] = useState(false);
  const best = bestScores(attempts);
  const allLessons = TRACKS.flatMap((t) => t.lessons.map(lessonId));
  const read = allLessons.filter((id) => lessons.includes(id)).length;
  const passedCount = MISSIONS.filter((m) => passed(best[m.id])).length;

  const print = () => {
    setPrinting(true);
    window.setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 50);
  };
  const download = () => {
    const blob = new Blob([exportJson()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "training-record.offshoreforge.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={download}>
          <Download size={13} /> Export JSON
        </Button>
        <Button size="sm" onClick={print}>
          <Printer size={13} /> Print / save as PDF
        </Button>
      </div>
      <div className="print-doc mx-auto max-w-3xl" data-printing={printing ? "" : undefined}>
        <article className="relative overflow-hidden rounded-md border border-slate-300 bg-white p-6 font-serif text-[13px] leading-relaxed text-slate-900 shadow-md sm:p-8">
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center text-center text-[30px] font-black uppercase tracking-widest sm:text-[44px]"
            // fixed colour: the record looks the same in every app palette
            style={{ transform: "rotate(-24deg)", color: "rgba(37, 99, 235, 0.07)", fontFamily: "Arial, sans-serif" }}
            aria-hidden
          >
            Training record
          </div>
          <header className="relative border-b border-slate-300 pb-3">
            <p className="font-sans text-[10px] font-semibold uppercase tracking-widest text-slate-500">OffshoreForge Academy</p>
            <h3 className="text-lg font-bold">Training record</h3>
            <p className="text-[12px] text-slate-600">
              Learner: <span className="font-semibold text-slate-900">{learner || "(no name set)"}</span> · printed{" "}
              {new Date().toISOString().slice(0, 10)}
            </p>
          </header>
          <section className="relative mt-3 space-y-1">
            <p>
              Lessons opened: {read} of {allLessons.length}. Missions passed (score ≥ {PASS_MARK}): {passedCount} of {MISSIONS.length}.
              Attempts: {attempts.length}.
            </p>
          </section>
          <table className="relative mt-3 w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-slate-400 text-left font-sans text-[10px] uppercase tracking-wider text-slate-500">
                <th className="py-1 pr-2">Track</th>
                <th className="py-1 pr-2">Mission</th>
                <th className="py-1 pr-2 text-right">Best</th>
                <th className="py-1 pr-2 text-right">Attempts</th>
                <th className="py-1">Result</th>
              </tr>
            </thead>
            <tbody>
              {MISSIONS.map((m) => {
                const n = attempts.filter((a) => a.mission === m.id).length;
                return (
                  <tr key={m.id} className="border-b border-slate-200">
                    <td className="py-1 pr-2 capitalize">{m.track}</td>
                    <td className="py-1 pr-2">{m.title}</td>
                    <td className="py-1 pr-2 text-right tabular-nums">{best[m.id] ?? "—"}</td>
                    <td className="py-1 pr-2 text-right tabular-nums">{n}</td>
                    <td className="py-1">{n === 0 ? "not attempted" : passed(best[m.id]) ? "passed" : "not yet passed"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {attempts.length > 0 && (
            <>
              <h4 className="relative mt-4 font-sans text-[10px] font-semibold uppercase tracking-wider text-slate-500">Attempt log</h4>
              <ol className="relative mt-1 space-y-0.5 text-[11px]">
                {[...attempts].reverse().slice(0, 40).map((a, i) => (
                  <li key={`${a.at}-${i}`}>
                    {date(a.at)} · {MISSIONS.find((m) => m.id === a.mission)?.title ?? a.mission} · <b>{a.score}</b>
                    {a.detail && <span className="text-slate-600"> — {a.detail}</span>}
                  </li>
                ))}
              </ol>
            </>
          )}
          <footer className="relative mt-4 border-t border-slate-300 pt-2 text-[10px] text-slate-500">
            Self-recorded in this browser by the OffshoreForge training platform. Mission weights are illustrative teaching choices. This
            record is not a certificate of competence and not proof of any qualification (e.g. GWO, ECITB, national electrical
            authorisation).
          </footer>
        </article>
      </div>
    </div>
  );
}
