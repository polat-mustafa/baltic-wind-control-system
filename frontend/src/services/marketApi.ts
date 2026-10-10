/** Market endpoint — backend/app/routers/p2_market.py. */

import type { MarketDayRequest, MarketDayResponse, PseDay } from "../types/market";

import { post, request } from "./apiClient";

export const simMarketDay = (body: MarketDayRequest): Promise<MarketDayResponse> => post("/api/v1/grid/market/day", body);

/** The real Polish system on one day (PSE open data); default today (Polish time). */
export const getPseDay = (date?: string): Promise<PseDay> => request(`/api/v1/grid/pse/day${date ? `?date=${date}` : ""}`);
