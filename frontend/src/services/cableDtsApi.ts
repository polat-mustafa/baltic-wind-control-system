/** Cable DTS endpoints — backend/app/routers/p2_cable_dts.py. */

import type { DTSProfileResponse, DTSTransientRequest, DTSTransientResponse } from "../types/cableDts";

import { post, request } from "./apiClient";

const BASE = "/api/v1/grid/cable/dts";

export const getDTSProfile = (currentA: number, ambientC: number): Promise<DTSProfileResponse> =>
  request(`${BASE}/profile?current_a=${currentA}&ambient_temp_c=${ambientC}`);

export const simTransient = (body: DTSTransientRequest): Promise<DTSTransientResponse> => post(`${BASE}/transient`, body);
