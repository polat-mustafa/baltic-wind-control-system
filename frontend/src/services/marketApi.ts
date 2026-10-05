/** Market endpoint — backend/app/routers/p2_market.py. */

import type { MarketDayRequest, MarketDayResponse } from "../types/market";

import { post } from "./apiClient";

export const simMarketDay = (body: MarketDayRequest): Promise<MarketDayResponse> => post("/api/v1/grid/market/day", body);
