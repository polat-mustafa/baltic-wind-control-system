/**
 * SB-510 wind climate at the 150 m hub — NEWA mean speed + Microscale-Atlas Weibull k,
 * averaged over the 34 turbine positions (backend `sb510_wind()`, `wind_climate.SB510_*`).
 * Default of every P1 / P2 form; backend `test_sb510_defaults_match_the_site_pack`
 * checks these numbers against the region pack.
 */
export const SB510_WIND = {
  /** Weibull scale A [m/s]. */
  weibullA: 10.8,
  /** Weibull shape k [-]. */
  weibullK: 2.04,
  /** Mean speed A·Γ(1 + 1/k) [m/s]. */
  meanMs: 9.57,
  source: "NEWA Mesoscale + Microscale Atlas, 150 m (doi:10.11583/DTU.14414096.v1)",
} as const;
