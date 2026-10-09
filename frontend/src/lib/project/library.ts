/**
 * "My projects": every own project the learner keeps in this browser, as
 * project documents (lib/project/document.ts) under `of.library.v1`.
 *
 * The site / layout / lifecycle stores always hold the project on screen.
 * The library keeps the others, and the reference case:
 *   - switching to the SB-510 reference first files the own project here,
 *     then loads SB-510 into the stores (edits there never touch it);
 *   - switching back reopens the active own project from here;
 *   - opening another project files the current one first.
 * Each entry remembers its online copy (projectSync id + revision), so the
 * auto-save always writes to the right project.
 */

import { OSS_GEO, TURBINE_POSITIONS } from "../../constants/windFarmLayout";
import { useModeStore, type Mode } from "../../store/modeStore";
import { useProjectStore } from "../../store/projectStore";
import { useProjectSync } from "../../store/projectSync";
import { CASE_STUDY_GRID_NODE, CASE_STUDY_SITE, useSiteStore } from "../../store/siteStore";
import { readStored, writeStored } from "../storage";
import { applyDoc, buildDoc, DEFAULT_NAME, parseDoc, type ProjectDoc } from "./document";

export const LIBRARY_KEY = "of.library.v1";

export interface LibraryEntry {
  id: string;
  name: string;
  /** Epoch ms of the last save into the library. */
  savedAt: number;
  /** Online copy of this project, if saved online. */
  cloud: { id: string; revision: number } | null;
  doc: ProjectDoc;
}

interface Library {
  /** The own project currently on screen (own mode) or waiting (reference mode). */
  activeId: string | null;
  entries: LibraryEntry[];
}

function read(): Library {
  try {
    const p = JSON.parse(readStored(LIBRARY_KEY) ?? "null") as Library | null;
    if (p && Array.isArray(p.entries)) {
      const entries = p.entries.flatMap((e) => {
        try {
          return [{ ...e, doc: parseDoc(e.doc) }];
        } catch {
          return []; // corrupt entry: drop it, keep the rest
        }
      });
      return { activeId: entries.some((e) => e.id === p.activeId) ? p.activeId : null, entries };
    }
  } catch {
    // corrupt value: empty library
  }
  return { activeId: null, entries: [] };
}

const write = (lib: Library) => writeStored(LIBRARY_KEY, JSON.stringify(lib));

const newId = () => (crypto.randomUUID?.() ?? `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);

/** All projects, most recently saved first. */
export function listProjects(): LibraryEntry[] {
  return [...read().entries].sort((a, b) => b.savedAt - a.savedAt);
}

export const activeProjectId = (): string | null => read().activeId;

/** The SB-510 reference case as a document (site, permit done, 34-turbine layout). */
export function referenceDoc(): ProjectDoc {
  return parseDoc({
    schema: 2,
    app: "OffshoreForge",
    name: "SB-510 reference",
    site: {
      polygon: CASE_STUDY_SITE,
      stage: "documents",
      done: ["screening", "investigation", "environment", "permit", "documents"],
      gridNode: CASE_STUDY_GRID_NODE,
    },
    turbines: TURBINE_POSITIONS.map(({ id, lon, lat }) => ({ id, lon, lat })),
    oss: [OSS_GEO.lon, OSS_GEO.lat],
  });
}

/** True when the stores hold anything worth keeping (a site or a turbine). */
const hasContent = () => useSiteStore.getState().site !== null || useProjectStore.getState().turbines.length > 0;

/** File the project on screen under the active entry (creates one if none). Own mode only. */
export function saveActive(): LibraryEntry | null {
  const lib = read();
  const sync = useProjectSync.getState();
  let entry = lib.entries.find((e) => e.id === lib.activeId);
  if (!entry) {
    if (!hasContent() && !sync.id) return null; // nothing to keep yet
    entry = { id: newId(), name: sync.name, savedAt: 0, cloud: null, doc: buildDoc(sync.name) };
    lib.entries.push(entry);
    lib.activeId = entry.id;
  }
  entry.name = sync.name;
  entry.doc = buildDoc(sync.name);
  entry.cloud = sync.id ? { id: sync.id, revision: sync.revision } : null;
  entry.savedAt = Date.now();
  write(lib);
  return entry;
}

/** Put a document on screen and point the online sync at its copy. */
function show(doc: ProjectDoc, cloud: LibraryEntry["cloud"]) {
  useProjectSync.getState().attach(doc.name, cloud);
  applyDoc(doc);
}

/**
 * Switch between the reference case and the own project. Leaving the own
 * project files it in the library first; coming back reopens it.
 */
export function switchMode(to: Mode): void {
  const from = useModeStore.getState().mode;
  if (from === to) return;
  if (from === "own") saveActive();
  else if (from === null && hasContent()) adoptLegacy();
  if (to === "reference") {
    useModeStore.getState().setMode("reference"); // first: the online sync is off outside own mode
    applyDoc(referenceDoc());
    return;
  }
  const lib = read();
  const entry = lib.entries.find((e) => e.id === lib.activeId);
  if (entry) show(entry.doc, entry.cloud);
  else if (from === "reference") show(parseDoc({ schema: 2, app: "OffshoreForge", turbines: [], name: DEFAULT_NAME }), null);
  useModeStore.getState().setMode("own");
}

/** Ask before showing the reference from the own project, and say where the project is kept. */
export function confirmReference(): boolean {
  if (useModeStore.getState().mode !== "own") return true;
  const name = useProjectSync.getState().name;
  return window.confirm(
    `Switch to the SB-510 reference?

“${name}” is kept in My projects (project menu → My projects). ` +
      "Choose “My project” in the project menu to come back to it.",
  );
}

/** Open a project from the library (the one on screen is filed first). */
export function openProject(id: string): void {
  if (useModeStore.getState().mode === "own") saveActive();
  const lib = read();
  const entry = lib.entries.find((e) => e.id === id);
  if (!entry) return;
  write({ ...lib, activeId: id });
  useModeStore.getState().setMode("own");
  show(entry.doc, entry.cloud);
}

/** Start a new project from a document (the one on screen is filed first). */
export function createProject(doc: ProjectDoc, cloud: LibraryEntry["cloud"] = null): LibraryEntry {
  if (useModeStore.getState().mode === "own") saveActive();
  const lib = read();
  const entry: LibraryEntry = { id: newId(), name: doc.name, savedAt: Date.now(), cloud, doc };
  write({ activeId: entry.id, entries: [...lib.entries, entry] });
  useModeStore.getState().setMode("own");
  show(doc, cloud);
  return entry;
}

/** Add a project (e.g. an imported file) without opening it. */
export function addProject(doc: ProjectDoc): LibraryEntry {
  const lib = read();
  const entry: LibraryEntry = { id: newId(), name: doc.name, savedAt: Date.now(), cloud: null, doc };
  write({ ...lib, entries: [...lib.entries, entry] });
  return entry;
}

export function renameProject(id: string, name: string): void {
  const lib = read();
  const entry = lib.entries.find((e) => e.id === id);
  if (!entry) return;
  entry.name = name.trim().slice(0, 100) || DEFAULT_NAME;
  entry.doc = { ...entry.doc, name: entry.name };
  write(lib);
  if (id === lib.activeId && useModeStore.getState().mode === "own") useProjectSync.getState().setName(entry.name);
}

/** Copy of a project (local only — the online copy stays with the original). */
export function duplicateProject(id: string): LibraryEntry | null {
  if (id === activeProjectId() && useModeStore.getState().mode === "own") saveActive();
  const lib = read();
  const src = lib.entries.find((e) => e.id === id);
  if (!src) return null;
  const name = `${src.name} (copy)`.slice(0, 100);
  const copy: LibraryEntry = { id: newId(), name, savedAt: Date.now(), cloud: null, doc: { ...src.doc, name } };
  write({ ...lib, entries: [...lib.entries, copy] });
  return copy;
}

/** Remove from this browser (an online copy stays reachable by its link). Not the one on screen. */
export function deleteProject(id: string): boolean {
  const lib = read();
  if (id === lib.activeId && useModeStore.getState().mode === "own") return false;
  write({ activeId: lib.activeId === id ? null : lib.activeId, entries: lib.entries.filter((e) => e.id !== id) });
  return true;
}

/**
 * First run with the library: a project drawn before it existed lives only in
 * the stores — file it so switching to the reference cannot overwrite it.
 */
export function adoptLegacy(): void {
  const lib = read();
  if (lib.entries.length > 0 || !hasContent()) return;
  const sync = useProjectSync.getState();
  const isReference = useProjectStore.getState().turbines.length === TURBINE_POSITIONS.length &&
    useProjectStore.getState().turbines.every((t, i) => t.id === TURBINE_POSITIONS[i].id);
  if (isReference && !useSiteStore.getState().site) return;
  const name = sync.name === DEFAULT_NAME ? "My project" : sync.name;
  const entry: LibraryEntry = { id: newId(), name, savedAt: Date.now(), cloud: sync.id ? { id: sync.id, revision: sync.revision } : null, doc: buildDoc(name) };
  write({ activeId: entry.id, entries: [entry] });
}

/**
 * App start: file a pre-library project, and make sure reference mode shows
 * SB-510 rather than whatever the stores held.
 */
export function initLibrary(): void {
  adoptLegacy();
  if (useModeStore.getState().mode === "reference") {
    const p = useProjectStore.getState();
    const isRef = p.turbines.length === TURBINE_POSITIONS.length && p.turbines.every((t, i) => t.id === TURBINE_POSITIONS[i].id);
    if (!isRef || !useSiteStore.getState().site) applyDoc(referenceDoc());
  }
}
