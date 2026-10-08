/**
 * Header project menu: switch between the SB-510 reference and the own
 * project; for the own project — name, online copy and link (SaveOnline),
 * new, open by link or ID, import / export the project file.
 */

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Copy, Download, FilePlus2, FolderOpen, Upload } from "lucide-react";
import { OSS_GEO, TURBINE_POSITIONS } from "../../constants/windFarmLayout";

import { applyDoc, buildDoc, DEFAULT_NAME, parseDoc } from "../../lib/project/document";
import { cn } from "../../lib/utils";
import { useModeStore, type Mode } from "../../store/modeStore";
import { useProjectSync } from "../../store/projectSync";
import { CASE_STUDY_GRID_NODE, CASE_STUDY_SITE } from "../../store/siteStore";
import { Button } from "../ui/Button";
import { SaveOnline } from "./SaveOnline";

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const MODES: { id: Mode; title: string; note: string }[] = [
  { id: "reference", title: "SB-510 reference", note: "Every module open on the case study" },
  { id: "own", title: "My project", note: "Modules open stage by stage" },
];

export default function ProjectMenu() {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const mode = useModeStore((s) => s.mode);
  const setMode = useModeStore((s) => s.setMode);
  const name = useProjectSync((s) => s.name);
  const setName = useProjectSync((s) => s.setName);
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const exportFile = () => {
    const blob = new Blob([JSON.stringify(buildDoc(name), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "project.offshoreforge.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importFile = async (f: File) => {
    try {
      const doc = parseDoc(await f.text());
      applyDoc(doc);
      setName(doc.name);
      setNote(`Imported “${doc.name}”.`);
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    }
  };
  const startProject = (question: string, content: Record<string, unknown>) => {
    if (!window.confirm(`${question} The current one is replaced in this browser; an online copy stays reachable by its link.`))
      return;
    useProjectSync.getState().detach();
    const doc = parseDoc({ schema: 2, app: "OffshoreForge", turbines: [], ...content });
    applyDoc(doc);
    setName(doc.name);
    setNote(null);
    setOpen(false);
    navigate("/develop");
  };
  const newProject = () => startProject("Start an empty project?", { name: DEFAULT_NAME });
  // SB-510's site (PZP_44) and layout; the permit stages and everything after are the learner's
  const fromSb510 = () =>
    startProject("Start from SB-510? Its site and 34-turbine layout are copied; you run the permit stages and the rest.", {
      name: "SB-510 copy",
      site: { polygon: CASE_STUDY_SITE, gridNode: CASE_STUDY_GRID_NODE },
      turbines: TURBINE_POSITIONS.map(({ id, lon, lat }) => ({ id, lon, lat })),
      oss: [OSS_GEO.lon, OSS_GEO.lat],
    });
  const openLink = () => {
    const id = link.match(UUID)?.[0];
    if (!id) return setNote("No project ID found — paste the link from “Copy link” or the ID itself.");
    setNote(null);
    setLink("");
    void useProjectSync.getState().open(id);
  };

  const own = mode === "own";
  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        data-tour="project-menu"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Project"
        className="flex max-w-[11rem] items-center gap-1.5 rounded-md border border-border-primary bg-bg-tertiary px-2 py-1 text-xs font-medium text-text-secondary hover:bg-bg-hover"
      >
        {own ? <FolderOpen size={13} className="shrink-0" /> : <BookOpen size={13} className="shrink-0" />}
        <span className="hidden truncate sm:inline">{own ? name : mode === "reference" ? "SB-510 reference" : "Project"}</span>
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Project"
          className="absolute right-0 top-full mt-1 w-80 max-w-[calc(100vw-1rem)] space-y-3 rounded-lg border border-border-primary bg-bg-secondary p-3 shadow-2xl"
          style={{ zIndex: 2100 }}
        >
          <div role="radiogroup" aria-label="Work on" className="grid grid-cols-2 gap-1.5">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={mode === m.id}
                onClick={() => setMode(m.id)}
                className={cn(
                  "rounded-md border px-2 py-1.5 text-left",
                  mode === m.id ? "border-accent bg-accent/10" : "border-border-primary hover:bg-bg-hover",
                )}
              >
                <span className="block text-xs font-semibold text-text-primary">{m.title}</span>
                <span className="block text-[10px] text-text-muted">{m.note}</span>
              </button>
            ))}
          </div>

          {own ? (
            <>
              <label className="block text-[11px] text-text-muted">
                Project name
                <input
                  key={name}
                  defaultValue={name}
                  maxLength={100}
                  onBlur={(e) => e.target.value !== name && setName(e.target.value.trim())}
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                  className="mt-0.5 block w-full rounded border border-border-primary bg-bg-tertiary px-2 py-1 text-xs text-text-primary"
                />
              </label>
              <SaveOnline />
              <div className="flex flex-wrap gap-1.5 border-t border-border-primary pt-2">
                <Button variant="ghost" size="sm" onClick={newProject}>
                  <FilePlus2 size={13} className="mr-1" /> New
                </Button>
                <Button variant="ghost" size="sm" onClick={fromSb510}>
                  <Copy size={13} className="mr-1" /> From SB-510
                </Button>
                <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload size={13} className="mr-1" /> Import
                </Button>
                <Button variant="ghost" size="sm" onClick={exportFile}>
                  <Download size={13} className="mr-1" /> Export
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  aria-label="Import a project file"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void importFile(f);
                    e.target.value = "";
                  }}
                />
              </div>
              <form
                className="flex gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  openLink();
                }}
              >
                <input
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="Paste a project link or ID"
                  aria-label="Project link or ID"
                  className="min-w-0 flex-1 rounded border border-border-primary bg-bg-tertiary px-2 py-1 text-xs text-text-primary"
                />
                <Button type="submit" variant="secondary" size="sm" disabled={!link.trim()}>
                  Open
                </Button>
              </form>
              {note && (
                <p role="status" className="text-[11px] text-text-secondary">
                  {note}
                </p>
              )}
            </>
          ) : (
            <p className="text-[11px] text-text-muted">
              SB-510 is a fictional 510 MW case study in energy basin PZP_44 of the Polish Baltic (the real site 44.E.1, permit: PGE / Baltica 9, 2023). Your own project stays in this browser while you explore it.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
