/** V236 blade length [m] (rotor Ø 236 m minus the hub). */
export const BLADE_LENGTH_M = 115.5;

// ─── Spanwise station table — V236-realistic ──────────────────────────────

export interface Station {
  span: number;       // metres along blade axis (0 = root flange, 115.5 = tip)
  chord: number;      // metres
  twistDeg: number;   // nose-down rotation about span axis
  prebend: number;    // forward (+Z) offset
  sweep: number;      // aft (+X) offset
  airfoil: "cylinder" | "transition" | "du-thick" | "du-mid" | "du-thin" | "naca64";
}

export const STATIONS: Station[] = [
  { span:   0.0, chord: 5.4, twistDeg: 13.0, prebend: 0.00, sweep: 0.00, airfoil: "cylinder"   },
  { span:   3.5, chord: 5.6, twistDeg: 13.0, prebend: 0.02, sweep: 0.00, airfoil: "cylinder"   },
  { span:  10.0, chord: 6.2, twistDeg: 15.0, prebend: 0.10, sweep: 0.00, airfoil: "transition" },
  { span:  20.0, chord: 6.4, twistDeg: 14.5, prebend: 0.30, sweep: 0.00, airfoil: "du-thick"   },
  { span:  35.0, chord: 5.7, twistDeg:  9.5, prebend: 0.65, sweep: 0.00, airfoil: "du-thick"   },
  { span:  50.0, chord: 4.7, twistDeg:  5.5, prebend: 1.10, sweep: 0.05, airfoil: "du-mid"     },
  { span:  65.0, chord: 3.8, twistDeg:  3.2, prebend: 1.75, sweep: 0.12, airfoil: "du-mid"     },
  { span:  80.0, chord: 3.0, twistDeg:  1.8, prebend: 2.55, sweep: 0.30, airfoil: "du-thin"    },
  { span:  92.0, chord: 2.3, twistDeg:  0.9, prebend: 3.40, sweep: 0.55, airfoil: "du-thin"    },
  { span: 102.0, chord: 1.7, twistDeg:  0.4, prebend: 4.20, sweep: 0.85, airfoil: "naca64"     },
  { span: 110.0, chord: 1.1, twistDeg:  0.0, prebend: 4.75, sweep: 1.10, airfoil: "naca64"     },
  { span: 115.5, chord: 0.4, twistDeg: -0.3, prebend: 5.00, sweep: 1.20, airfoil: "naca64"     },
];


/** Structural twist at a span station [°] (linear between stations). */
export function bladeTwistDeg(span: number): number {
  if (span <= STATIONS[0].span) return STATIONS[0].twistDeg;
  for (let i = 1; i < STATIONS.length; i++) {
    const a = STATIONS[i - 1];
    const b = STATIONS[i];
    if (span <= b.span) return a.twistDeg + ((b.twistDeg - a.twistDeg) * (span - a.span)) / (b.span - a.span);
  }
  return STATIONS[STATIONS.length - 1].twistDeg;
}
