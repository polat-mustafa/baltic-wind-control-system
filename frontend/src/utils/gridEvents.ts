/**
 * Grid events seen from the farm (Pmax = its installed capacity) — pure, testable trajectories.
 *
 * 1. Frequency events in the Continental Europe (CE) synchronous area:
 *    aggregated swing equation
 *        2H·S/f0 · df/dt = ΔP_FCR(t) + D·(f0 − f) − ΔP_loss
 *    Reference incident 3 GW (ENTSO-E SOGL Art. 153 / CE dimensioning),
 *    H = 5 s, S = 300 GW, load self-regulation D = 1 %/Hz, FCR 3 GW fully
 *    activated at 200 mHz with an 8 s lag (full activation ≤ 30 s).
 *    → nadir ≈ 49.72 Hz at ≈ 13 s, quasi-steady ≈ 49.83 Hz (≤ 200 mHz).
 *    Illustrative system parameters; the real CE inertia varies with the
 *    generation mix.
 *
 *    The farm (Type D PPM, NC RfG Art. 13/15, droop 5 %):
 *      LFSM-O above 50.2 Hz: ΔP = −(Pref/0.05)·(f − 50.2)/50
 *      LFSM-U below 49.8 Hz: ΔP = +(Pmax/0.05)·(49.8 − f)/50, limited by
 *      the headroom it holds (Δ-reserve) — at MPPT it has none.
 *
 * 2. Voltage dip at the PCC (400 kV fault near the grid node, cleared in 140 ms)
 *    against the PSE LVRT envelope used by backend services/p2/frt_simulation.py.
 *    During the dip the converters give reactive current priority:
 *      ΔIq = K·ΔU, K = 2 (NC RfG Art. 20/21), capped at 1.0 pu,
 *      Ip = √(1 − Iq²); after clearance P recovers ≥ 90 % within 1 s.
 *    STATCOM ±120 MVAr injects its full current: Q = U·I·120.
 */

export type GridEventKind = "underfrequency" | "overfrequency" | "voltage-dip";

export interface GridSample {
  /** Event time [s] (real time, not slow-motion). */
  t: number;
  /** Grid frequency [Hz] (frequency events) */
  f: number;
  /** PCC voltage [pu] (dip) */
  u: number;
  /** Farm active power [MW] */
  pMW: number;
  /** Farm (WTG) reactive power [MVAr], generating positive */
  qMVAr: number;
  /** STATCOM reactive power [MVAr], generating positive */
  statcomMVAr: number;
}

const F0 = 50;
const DROOP = 0.05;
export const CE = { H: 5, S_MW: 300_000, lossMW: 3000, fcrMW: 3000, fcrLagS: 8, loadDampingPerHz: 0.01 };

/** PSE type-D FRT profile (NC RfG Art. 16(3)(a), backend frt_simulation.py PSE_FRT_PROFILE):
 *  time after fault inception [s] → minimum POC voltage [pu] the farm must ride through. */
export const PSE_LVRT: [number, number][] = [
  [0, 0],
  [0.15, 0],
  [2.5, 0.85],
  [3.0, 0.85],
];

export function lvrtLimit(t: number): number {
  for (let i = 1; i < PSE_LVRT.length; i++) {
    const [t1, u1] = PSE_LVRT[i];
    const [t0, u0] = PSE_LVRT[i - 1];
    if (t <= t1) return u0 + ((u1 - u0) * (t - t0)) / (t1 - t0);
  }
  return 1;
}

/**
 * Frequency event: CE swing equation + farm LFSM response.
 * @param pFarmMW  farm output before the event
 * @param reservePct Δ-reserve held (0 = MPPT, no upward headroom)
 * @param pmaxMW   installed capacity (LFSM-U droop is on Pmax)
 */
export function frequencyEvent(
  kind: "underfrequency" | "overfrequency",
  pFarmMW: number,
  reservePct: number,
  pmaxMW: number,
  durationS = 60,
  dt = 0.05,
): GridSample[] {
  const sign = kind === "underfrequency" ? -1 : 1;
  const pAvail = pFarmMW / (1 - reservePct / 100);
  const headroom = pAvail - pFarmMW;
  const out: GridSample[] = [];
  let f = F0;
  let fcr = 0;
  let pFarm = pFarmMW;
  for (let t = 0; t <= durationS + 1e-9; t += dt) {
    out.push({ t: Math.round(t * 100) / 100, f, u: 1, pMW: pFarm, qMVAr: 0, statcomMVAr: 0 });
    const df = f - F0;
    const fcrTarget = -Math.max(-1, Math.min(1, df / 0.2)) * CE.fcrMW;
    fcr += ((fcrTarget - fcr) * dt) / CE.fcrLagS;
    const damping = -CE.loadDampingPerHz * CE.S_MW * df;
    f += ((fcr + damping + sign * CE.lossMW) / (2 * CE.H * CE.S_MW)) * F0 * dt;

    // Farm LFSM (1 s response lag)
    let target = pFarmMW;
    if (f > 50.2) target = pFarmMW - (pFarmMW / DROOP) * ((f - 50.2) / F0);
    if (f < 49.8) target = pFarmMW + Math.min(headroom, (pmaxMW / DROOP) * ((49.8 - f) / F0));
    pFarm += ((target - pFarm) * dt) / 1.0;
  }
  return out;
}

/** Fault inception in the voltage-dip trajectory [s] (a short pre-fault stretch is drawn first). */
export const DIP_START_S = 0.02;

/** 400 kV fault near the grid node: U_ret 0.3 pu for 140 ms, then recovery (Pmax = pmaxMW). */
export function voltageDipEvent(pFarmMW: number, pmaxMW: number, durationS = 3, dt = 0.01): GridSample[] {
  const ms = (s: number) => Math.round(s * 1000) / 1000;
  const CLEAR = ms(DIP_START_S + 0.14);
  const RAMP_END = ms(CLEAR + 0.11);
  const out: GridSample[] = [];
  for (let i = 0; i * dt <= durationS + 1e-9; i++) {
    // ms-rounded time: an accumulated t drifts below 0.16 and would stretch the dip by a step
    const t = ms(i * dt);
    const u =
      t < DIP_START_S
        ? 1
        : t < CLEAR
          ? 0.3
          : t < RAMP_END
            ? 0.3 + ((t - CLEAR) / 0.11) * 0.55
            : Math.min(1, 0.85 + (t - RAMP_END) * 0.12);
    const iq = Math.min(1, 2 * Math.max(0, 0.9 - u)); // K = 2 outside the ±10 % band
    const ip = Math.sqrt(Math.max(0, 1 - iq * iq));
    // P: limited by Ip during the dip; ramps back to 100 % over 0.8 s after clearance
    const recovery = t < CLEAR ? 0 : Math.min(1, (t - CLEAR) / 0.8);
    const pLimit = u * ip * pmaxMW;
    const pMW = t < DIP_START_S ? pFarmMW : Math.min(pLimit, pFarmMW * (t < CLEAR ? 1 : recovery));
    out.push({
      t,
      f: F0,
      u,
      pMW,
      qMVAr: u * iq * pmaxMW,
      statcomMVAr: u < 0.9 ? u * 120 : 0,
    });
  }
  return out;
}

/** Sample at time t (linear interpolation). */
export function sampleAt(traj: GridSample[], t: number): GridSample {
  if (t <= traj[0].t) return traj[0];
  const last = traj[traj.length - 1];
  if (t >= last.t) return last;
  const dt = traj[1].t - traj[0].t;
  const i = Math.min(traj.length - 2, Math.floor((t - traj[0].t) / dt));
  const a = traj[i];
  const b = traj[i + 1];
  const k = (t - a.t) / (b.t - a.t);
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return {
    t,
    f: lerp(a.f, b.f),
    u: lerp(a.u, b.u),
    pMW: lerp(a.pMW, b.pMW),
    qMVAr: lerp(a.qMVAr, b.qMVAr),
    statcomMVAr: lerp(a.statcomMVAr, b.statcomMVAr),
  };
}
