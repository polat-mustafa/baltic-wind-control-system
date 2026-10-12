/** Typed client for the lifecycle API (backend/app/routers/lifecycle.py). */

import type { CampaignRequest, CampaignResult, OMSimulationParams, OMSimulationResult } from "../types/lifecycle";
import { post, request } from "./apiClient";

export function runCampaign(req: CampaignRequest): Promise<CampaignResult> {
  return post("/api/v1/lifecycle/campaign", req);
}

/** Fleet O&M replay of the 30 hindcast years with limited CTVs and crews. */
export function getOMSimulation(p: OMSimulationParams): Promise<OMSimulationResult> {
  return request(`/api/v1/lifecycle/om-simulation?n_ctv=${p.n_ctv}&crews_per_ctv=${p.crews_per_ctv}&mode=${p.mode}`);
}
