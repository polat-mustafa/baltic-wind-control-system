/** Typed client for the lifecycle API (backend/app/routers/lifecycle.py). */

import type { CampaignRequest, CampaignResult } from "../types/lifecycle";
import { post } from "./apiClient";

export function runCampaign(req: CampaignRequest): Promise<CampaignResult> {
  return post("/api/v1/lifecycle/campaign", req);
}
