/**
 * Online copy of the project: the document (lib/project/document.ts) saved in
 * the backend (routers/projects.py) and opened again by its link
 * (`?project=<id>`). There is no account — anyone with the link can open and
 * edit it; projects not opened for 12 months are deleted.
 *
 * Edits in the site, layout and lifecycle stores are saved after a short pause
 * with the revision they are based on (409 → `conflict`, the learner chooses
 * which copy to keep). Offline, the latest document waits and is sent when the
 * browser is back online. `of.cloud.v1` remembers {id, revision, name}.
 */

import { create } from "zustand";

import { applyDoc, buildDoc, DEFAULT_NAME, parseDoc } from "../lib/project/document";
import { readStored, writeStored } from "../lib/storage";
import { ApiError } from "../services/apiClient";
import { createProject, deleteProject, getProject, runProjectAep, saveProject, type AepRun } from "../services/projectApi";
import { useLifecycleStore } from "./lifecycleStore";
import { useProjectStore, type PyWakeWind } from "./projectStore";
import { useSiteStore } from "./siteStore";

export const CLOUD_KEY = "of.cloud.v1";
export const SAVE_DELAY_MS = 1500;

/** saved · saving · offline (will retry) · conflict (changed elsewhere) · error. */
export type SyncState = "saved" | "saving" | "offline" | "conflict" | "error";

interface SyncStore {
  /** Saved project id; null = this browser only. */
  id: string | null;
  revision: number;
  name: string;
  sync: SyncState | null;
  error: string | null;
  /** First save: creates the online project and starts auto-saving. */
  saveOnline: (name?: string) => Promise<void>;
  /** Open a saved project by id (replaces the local project). */
  open: (id: string) => Promise<void>;
  setName: (name: string) => void;
  /** Save now if anything changed. */
  flush: () => Promise<void>;
  /** Save after a pause (called on every store change). */
  schedule: () => void;
  /** After a conflict: load the saved copy, or overwrite it with this one. */
  resolve: (keep: "saved" | "mine") => Promise<void>;
  /** Stop saving online; the local project stays. */
  detach: () => void;
  /** Delete the online copy (the local project stays). */
  remove: () => Promise<void>;
  /** PyWake run on the saved layout, kept as AEP history. */
  runAep: (wind?: PyWakeWind) => Promise<AepRun>;
}

export const shareLink = (id: string) => new URL(`${import.meta.env.BASE_URL}develop/layout?project=${id}`, window.location.origin).href;

function stored(): Pick<SyncStore, "id" | "revision" | "name"> {
  try {
    const p = JSON.parse(readStored(CLOUD_KEY) ?? "null") as Record<string, unknown> | null;
    if (p && typeof p.id === "string" && typeof p.revision === "number")
      return {
        id: p.id,
        revision: p.revision,
        name: typeof p.name === "string" ? p.name : DEFAULT_NAME,
      };
  } catch {
    // corrupt value: local only
  }
  return { id: null, revision: 0, name: DEFAULT_NAME };
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const useProjectSync = create<SyncStore>((set, get) => {
  /** JSON of the document the server holds (last saved or opened). */
  let lastSent: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let queue: Promise<void> = Promise.resolve();

  const remember = () => {
    const { id, revision, name } = get();
    writeStored(CLOUD_KEY, JSON.stringify({ id, revision, name }));
  };

  const fail = (e: unknown) => {
    if (e instanceof ApiError) set({ sync: e.status === 409 ? "conflict" : "error", error: e.message });
    else set({ sync: "offline", error: null }); // network failure: retried when back online
  };

  const push = async () => {
    const { id, revision, name, sync } = get();
    if (!id || sync === "conflict") return;
    const doc = buildDoc(name);
    const json = JSON.stringify(doc);
    if (json === lastSent) {
      if (sync !== "saved") set({ sync: "saved", error: null });
      return;
    }
    set({ sync: "saving" });
    try {
      const r = await saveProject(id, revision, doc);
      lastSent = json;
      set({ revision: r.revision, sync: "saved", error: null });
      remember();
    } catch (e) {
      fail(e);
    }
  };

  const flush = () => {
    clearTimeout(timer);
    queue = queue.then(push);
    return queue;
  };
  const schedule = () => {
    clearTimeout(timer);
    if (get().id && get().sync !== "conflict") timer = setTimeout(() => void flush(), SAVE_DELAY_MS);
  };

  return {
    ...stored(),
    sync: null,
    error: null,

    saveOnline: async (name) => {
      const n = name?.trim() || get().name;
      set({ sync: "saving", error: null, name: n });
      try {
        const doc = buildDoc(n);
        const r = await createProject(doc);
        lastSent = JSON.stringify(doc);
        set({ id: r.id, revision: r.revision, sync: "saved" });
        remember();
      } catch (e) {
        set({ sync: null, error: message(e) });
      }
    },

    open: async (id) => {
      clearTimeout(timer);
      try {
        const r = await getProject(id);
        if (!r.data) throw new Error("This is the read-only SB-510 reference project.");
        const doc = parseDoc(r.data);
        applyDoc(doc);
        lastSent = JSON.stringify(buildDoc(doc.name));
        set({
          id: r.id,
          revision: r.revision,
          name: doc.name,
          sync: "saved",
          error: null,
        });
        remember();
      } catch (e) {
        set({
          error:
            e instanceof ApiError && e.status === 404 ? "Project not found — wrong link, or deleted after 12 months idle." : message(e),
        });
      }
    },

    setName: (name) => {
      set({ name: name.slice(0, 100) || DEFAULT_NAME });
      remember();
      schedule();
    },

    flush,
    schedule,

    resolve: async (keep) => {
      const id = get().id;
      if (!id) return;
      if (keep === "saved") return get().open(id);
      try {
        const r = await getProject(id); // overwrite: base the save on the latest revision
        lastSent = null;
        set({ revision: r.revision, sync: "saving", error: null });
        await flush();
      } catch (e) {
        fail(e);
      }
    },

    detach: () => {
      clearTimeout(timer);
      lastSent = null;
      set({ id: null, revision: 0, sync: null, error: null });
      remember();
    },

    remove: async () => {
      const id = get().id;
      if (!id) return;
      try {
        await deleteProject(id);
        get().detach();
      } catch (e) {
        set({ error: message(e) });
      }
    },

    runAep: async (wind) => {
      await flush();
      const { id, sync, error } = get();
      if (!id) throw new Error("The project is not saved online.");
      if (sync !== "saved") throw new Error(error ?? "The project could not be saved — PyWake runs on the saved layout.");
      return runProjectAep(id, {
        weibull_a: wind?.weibullA,
        weibull_k: wind?.weibullK,
        sector_frequencies: wind?.sectorFrequencies ?? null,
      });
    },
  };
});

let started = false;

/**
 * Start auto-saving (call once at app start). Opens `?project=<id>` from the
 * URL; otherwise a remembered project is checked against the server.
 */
export function initProjectSync(): void {
  if (started) return;
  started = true;
  const s = useProjectSync;
  const onChange = () => s.getState().schedule();
  useSiteStore.subscribe(onChange);
  useProjectStore.subscribe(onChange);
  useLifecycleStore.subscribe(onChange);
  window.addEventListener("online", () => {
    if (s.getState().sync === "offline") void s.getState().flush();
  });

  const linked = new URLSearchParams(window.location.search).get("project");
  const { id, revision } = s.getState();
  if (linked && linked !== id) void s.getState().open(linked);
  else if (id)
    void getProject(id)
      .then((r) => {
        if (r.revision > revision)
          s.setState({
            sync: "conflict",
            error: "This project was changed on another device.",
          });
        else void s.getState().flush();
      })
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 404) {
          s.getState().detach();
          s.setState({
            error: "The online copy no longer exists (deleted after 12 months idle) — this browser keeps the project.",
          });
        } else s.setState({ sync: "offline" });
      });
}
