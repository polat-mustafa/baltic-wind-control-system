import type { EducationContent } from "../../../types/education";

export const faultRideThroughEducation: EducationContent = {
  id: "p2.fault-ride-through",
  title: "Fault Ride-Through (FRT) and Fast Fault Current",
  subtitle: "Stay connected through a grid fault, support the voltage, recover the power",
  discipline: "Electrical",

  overview:
    "A fault anywhere in the transmission grid collapses the voltage for 100–250 ms until protection clears it. If " +
    "every wind farm tripped on such a dip, one fault could take gigawatts off the system. Grid codes therefore " +
    "require power park modules to stay connected above a voltage-time profile, to inject reactive current while the " +
    "voltage is low, and to restore active power afterwards.",

  simpleExplanation:
    "When the grid voltage suddenly drops, the farm must not switch off. Instead it pushes reactive current to hold " +
    "the voltage up, and once the fault is gone it brings its power back within a few seconds.",

  technicalExplanation:
    "PSE's requirements for a type-D power park module (18-12-2018): (1) FRT profile at the connection point — " +
    "0 p.u. may last 150 ms, then the limit rises linearly to 0.85 p.u. at 2.5 s; only below it may the farm " +
    "disconnect. (2) Additional reactive current ΔIq = K·ΔU with K adjustable 2–10, 90 % within 60 ms, target within " +
    "100 ms (−10 %/+20 %); below 0.2 Un at the terminals it is not required. (3) Active power recovery starts at " +
    "U ≥ 0.9 Un and reaches 90 % of pre-fault power within 5 s. This tab uses a quasi-static phasor model of the " +
    "radial chain (grid Thevenin source, two transformer stages, export cable) with the WTGs aggregated at 66 kV and " +
    "the STATCOM at 220 kV, both following the K-characteristic with reactive-current priority and a 1.0 p.u. current " +
    "limit. It is a screening model — balanced faults, no EMT or PLL dynamics, no array impedance. HVRT: PSE sets no " +
    "short overvoltage profile for PPMs (only continuous ranges, e.g. 1.118–1.15 p.u. for 60 min at 110–300 kV), so " +
    "the swell case is illustrative.",

  standards: [
    {
      label: "PSE — Wymogi ogólnego stosowania wynikające z NC RfG (18-12-2018), Art. 16(3), 20(2)(b), 20(3)(a)",
      type: "regulation",
      url: "https://www.pse.pl/documents/20182/31216853/20181218_Wymogi_ogolnego_stosowania_OSP_i_OSD.pdf",
    },
    {
      label: "Commission Regulation (EU) 2016/631 — NC RfG Art. 16(3) and Table 7.2 (PPM FRT profile ranges)",
      type: "regulation",
      url: "https://eur-lex.europa.eu/eli/reg/2016/631/oj",
    },
  ],

  formulas: [
    {
      expression: "ΔIq = K · ΔU   for |ΔU| > 0.1 p.u.;   |I| ≤ I_max, Ip = min(Ip,pre, √(I_max² − Iq²))",
      variables: [
        { symbol: "ΔU", name: "Voltage deviation from pre-fault", unit: "p.u." },
        { symbol: "K", name: "Fast fault current gain (PSE: 2–10)", unit: "—" },
        { symbol: "I_max", name: "Converter current limit", unit: "p.u." },
      ],
      explanation: "Reactive current has priority; what current is left carries active power.",
    },
    {
      expression: "V_POC = E · Z_f / (Z_th + Z_f) + Z_th∥Z_f · I_farm",
      variables: [
        { symbol: "Z_th", name: "Grid Thevenin impedance at the fault", unit: "p.u." },
        { symbol: "Z_f", name: "Fault impedance", unit: "p.u." },
      ],
      explanation:
        "Retained voltage = voltage divider of the passive network, plus the lift from the farm's injected current. " +
        "Through a 10 GVA grid that lift is small at 400 kV but large at the 66 kV terminals.",
    },
  ],

  workedExamples: [
    {
      title: "Near-zero voltage fault at the 400 kV busbar",
      scenario: "Fault at PSE 400 kV, Z_f = 0.005 p.u. (100 MVA), 150 ms, K = 2, farm at 510 MW.",
      steps: [
        "Retained voltage at the POC ≈ 0.33 p.u.; at the WTG terminals ≈ 0.30 p.u. at fault inception",
        "Iq = 0.1 (pre-fault) + K·ΔU rises to ≈ 0.9 p.u. within ≈ 60 ms and lifts the 66 kV busbar to ≈ 0.60 p.u.",
        "With Iq priority only √(1 − 0.9²) ≈ 0.44 p.u. active current remains → P ≈ 0.60 × 0.44 × 510 ≈ 134 MW; STATCOM ≈ 59 MVAR",
        "After clearance P ramps at 1 p.u./s → 90 % of 510 MW within ≈ 0.46 s (PSE limit 5 s)",
      ],
      result: "POC voltage stays above the PSE profile → the farm must, and does, ride through.",
    },
  ],

  realWorldCases: [
    {
      title: "South Australia black system, 28 September 2016",
      description:
        "Storms tripped transmission lines and caused a series of faults. Several wind farms reduced output because a " +
        "protection setting limited how many voltage dips they would ride through in a short period; the loss of " +
        "about 456 MW of wind generation overloaded the interconnector, which tripped, and the state blacked out.",
      takeaway: "FRT is not one fault — settings must handle repeated dips. AEMO tightened performance standards afterwards.",
      source: "AEMO, Black System South Australia 28 September 2016 — Final Report (March 2017)",
    },
  ],

  furtherReading: [
    {
      label: "AEMO — Black System South Australia 28 September 2016, Final Report",
      type: "website",
      citation: "Australian Energy Market Operator, March 2017 (published on aemo.com.au)",
    },
  ],

  codeReferences: [
    {
      file: "backend/app/services/p2/frt_simulation.py",
      description: "Nodal phasor model, K-factor characteristic, PSE profile, recovery check.",
    },
  ],
};
