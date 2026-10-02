/**
 * BESS API — backend/app/routers/p2_bess.py (/api/v1/grid/bess/*, /ppc/bess-dispatch).
 */

import type {
  BESSDispatchRequest,
  BESSDispatchResponse,
  DegradationRequest,
  DegradationResponse,
  FrequencyResponseRequest,
  FrequencyResponseResult,
  RampSmoothingRequest,
  RampSmoothingResult,
} from "../types/bess";
import { post } from "./apiClient";

const BASE = "/api/v1/grid/bess";

export const simFrequencyResponse = (req: FrequencyResponseRequest): Promise<FrequencyResponseResult> =>
  post(`${BASE}/simulate/frequency-response`, req);

export const simRampSmoothing = (req: RampSmoothingRequest): Promise<RampSmoothingResult> =>
  post(`${BASE}/simulate/ramp-smoothing`, req);

export const calcDegradation = (req: DegradationRequest): Promise<DegradationResponse> => post(`${BASE}/degradation`, req);

export const dispatchBESS = (req: BESSDispatchRequest): Promise<BESSDispatchResponse> =>
  post("/api/v1/grid/ppc/bess-dispatch", req);
