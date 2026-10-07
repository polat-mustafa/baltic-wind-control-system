/** Typed client for saved projects (backend/app/routers/projects.py). */

import type { ProjectDoc } from "../lib/project/document";
import type { WakeAnalysisResult } from "../types/windResource";
import { post, request } from "./apiClient";

const BASE = "/api/v1/projects";

export interface SavedProject {
  id: string;
  revision: number;
  is_reference: boolean;
  updated_at: string;
  /** null for the read-only SB-510 reference row. */
  data: ProjectDoc | null;
}

/** A stored PyWake run (GWh/yr); P-values after the P1 loss cascade. */
export interface AepRun extends WakeAnalysisResult {
  id: string;
  revision: number | null;
  calculated_at: string;
  p50_gwh: number;
  p75_gwh: number;
  p90_gwh: number;
  uncertainty_percent: number;
  turbine_ids: string[];
}

export interface AepWind {
  weibull_a?: number;
  weibull_k?: number;
  sector_frequencies?: number[] | null;
}

export const createProject = (data: ProjectDoc) => post<SavedProject>(BASE, data);
export const getProject = (id: string) => request<SavedProject>(`${BASE}/${encodeURIComponent(id)}`);
export const saveProject = (id: string, revision: number, data: ProjectDoc) =>
  request<SavedProject>(`${BASE}/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ revision, data }),
  });
export const deleteProject = (id: string) => request<void>(`${BASE}/${encodeURIComponent(id)}`, { method: "DELETE" });
export const runProjectAep = (id: string, wind: AepWind) => post<AepRun>(`${BASE}/${encodeURIComponent(id)}/aep`, wind);
