/** Cable DTS endpoints — backend/app/routers/p2_cable_dts.py. */

import type { DTSFarm, DTSProfileResponse, DTSTransientRequest, DTSTransientResponse, RouteRatingResponse } from "../types/cableDts";

import { post, request } from "./apiClient";

const BASE = "/api/v1/grid/cable/dts";

export const getDTSProfile = (currentA: number, ambientC: number): Promise<DTSProfileResponse> =>
  request(`${BASE}/profile?current_a=${currentA}&ambient_temp_c=${ambientC}`);

export const getDTSFarm = (): Promise<DTSFarm> => request(`${BASE}/farm`);
export const simTransient = (body: DTSTransientRequest): Promise<DTSTransientResponse> => post(`${BASE}/transient`, body);

/** IEC 60287 rating of every export route section, the HDD options and the 30-year load-profile check. */
export const getRouteRating = (): Promise<RouteRatingResponse> => request("/api/v1/grid/cable/route-rating");
