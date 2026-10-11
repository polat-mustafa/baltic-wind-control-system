/**
 * The RCE price of the quarter-hour running now (PSE, GET /grid/pse/price-now).
 * The control room curtails the farm to a zero schedule while it is negative —
 * no CfD support for those periods (CEEAG 2022 §122), as on the Market tab.
 * Unknown (offline backend, unpublished day) → null and no price curtailment.
 */

import { request } from "../../services/apiClient";

export interface PriceNow {
  time: string;
  period: string;
  price_pln_mwh: number;
  negative: boolean;
}

let _price: PriceNow | null = null;

export const priceNow = (): PriceNow | null => _price;

/** For tests and the simulation reset. */
export const setPriceNow = (p: PriceNow | null): void => {
  _price = p;
};

export async function refreshPrice(): Promise<void> {
  try {
    _price = await request<PriceNow>("/api/v1/grid/pse/price-now");
  } catch {
    _price = null;
  }
}
