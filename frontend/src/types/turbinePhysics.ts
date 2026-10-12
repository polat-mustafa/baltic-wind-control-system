/**
 * Support structure and tower loads of the IEA-15-240-RWT on the DEME 50 m jacket
 * (backend app/routers/turbine_physics.py, schemas SupportStructureResponse,
 * TowerLoadsResponse, TowerFatigueResponse). Frequencies in Hz, moments in MN·m.
 */

export interface SupportStructure {
  frequencies_hz: number[];
  first_bending_hz: number;
  /** OpenFAST free-decay reference (DEME jacket) [Hz]. */
  reference_hz: number;
  /** [low, high] of the rotor 1P / blade-passing 3P / 50-year wave (1/Tp) band [Hz]. */
  band_1p_hz: number[];
  band_3p_hz: number[];
  wave_band_hz: number[];
  hs50_m: number;
  soft_stiff_ok: boolean;
  /** Relative margins of f1 to the band edges [–] (0.1 = 10 %). */
  margin_to_1p: number;
  margin_to_3p: number;
  required_margin: number;
  source: string;
}

export interface TowerLoads {
  wind_mean_ms: number;
  /** Rotor-effective turbulence intensity [–]. */
  turbulence_intensity: number;
  time_s: number[];
  wind_ms: number[];
  thrust_mn: number[];
  tower_top_m: number[];
  base_moment_mnm: number[];
  power_mw: number[];
  /** 1 Hz damage-equivalent load, Wöhler m = 4 [MN·m]. */
  del_base_moment_mnm: number;
  mean_base_moment_mnm: number;
  max_base_moment_mnm: number;
  max_tower_top_m: number;
  /** Structural + aerodynamic damping ratio from free decay [–]. */
  total_damping_ratio: number;
  source: string;
}

export interface TowerFatigue {
  bins_ms: number[];
  del_10min_mnm: number[];
  probability: number[];
  lifetime_del_mnm: number;
  wohler_m: number;
  source: string;
}
