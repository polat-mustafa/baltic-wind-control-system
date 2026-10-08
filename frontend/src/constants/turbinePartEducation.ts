/**
 * Educational content for the clickable parts of the SB-510 turbine (15 MW
 * "V236 class", modelled with the IEA 15 MW reference turbine — direct drive).
 *
 * Each entry provides:
 * - Plain-language overview for non-engineers
 * - Key formulas from backend turbine_physics services
 * - Design values of the modelled turbine (IEA 15 MW; field name v236Value)
 * - Relevant IEC/ISO/DNV standards
 * - Efficiency/loss notes
 * - Fault-to-part mapping for diagnostic context
 * - Simple + technical explanations (interview prep)
 *
 * Physics sources: backend/app/services/turbine_physics/*.py
 */

import type { TurbineFaultType } from "../types/scada";

// ── Part Identifier ─────────────────────────────────────────────

export type TurbinePartId =
  | "blades"
  | "hub"
  | "shaft"
  | "bearing"
  | "brake"
  | "generator"
  | "converter"
  | "cooler"
  | "anemometer"
  | "yaw"
  | "tower"
  | "foundation"
  | "nacelle"
  | "wind"
  | "power_output"
  // ── New nacelle components (B2, B1, B3–B12) ──
  | "bedplate"
  | "hpu"
  | "control_cabinet"
  | "transformer"
  | "coolant_skid"
  | "ups"
  | "crane_rail"
  | "yaw_brake"
  | "cable_routing"
  | "fire_suppression"
  | "lightning_conductor";

// ── Educational Content Schema ──────────────────────────────────

export interface FormulaVariable {
  symbol: string;
  name: string;
  unit: string;
}

export interface FormulaEntry {
  expression: string;
  variables: FormulaVariable[];
  explanation: string;
}

export interface EfficiencyNote {
  name: string;
  typicalLossPct: string;
  dissipation: string;
}

export interface TurbinePartEducation {
  partId: TurbinePartId;
  title: string;
  overview: string;
  standards: string[];
  formulas: FormulaEntry[];
  design: {
    v236Value: string;
    reasoning: string;
    influencingFactors: string[];
  };
  efficiencyNotes: EfficiencyNote[];
  simpleExplanation: string;
  technicalExplanation: string;
  faultTypes: TurbineFaultType[];
}

// ── Fault-to-Part Mapping ───────────────────────────────────────

export const FAULT_TO_PART: Record<TurbineFaultType, TurbinePartId> = {
  PITCH_CONTROL_FAULT: "blades",
  HYDRAULIC_PRESSURE_LOW: "hub",
  BEARING_OVERTEMP: "bearing",
  VIBRATION_ALARM: "bearing",
  COOLANT_FLOW_LOW: "coolant_skid",
  GENERATOR_WINDING_TEMP: "generator",
  CONVERTER_OVERTEMP: "converter",
  GRID_FREQUENCY_FAULT: "converter",
  YAW_ERROR: "yaw",
  COMMUNICATION_LOSS: "nacelle",
};

// ── Educational Content (12 Parts) ──────────────────────────────

export const TURBINE_PART_EDUCATION: TurbinePartEducation[] = [
  // ── Blades ──
  {
    partId: "blades",
    title: "Rotor Blades",
    overview:
      "Three 117 m carbon-fibre/glass-fibre blades capture kinetic energy from the wind. They are the largest rotating components in the turbine, sweeping a rotor area of 45,750 m\u00B2 (rotor \u00D8 241.35 m). Blade pitch is actively controlled to regulate power and protect the turbine in high winds.",
    standards: ["IEC 61400-1", "DNV-ST-0376", "IEC 61400-23"],
    formulas: [
      {
        expression: "P = \u00BD\u00B7\u03C1\u00B7A\u00B7V\u00B3\u00B7C\u209A(\u03BB,\u03B2)",
        variables: [
          { symbol: "\u03C1", name: "Air density", unit: "kg/m\u00B3" },
          { symbol: "A", name: "Rotor swept area", unit: "m\u00B2" },
          { symbol: "V", name: "Wind speed", unit: "m/s" },
          { symbol: "C\u209A", name: "Power coefficient", unit: "dimensionless" },
          { symbol: "\u03BB", name: "Tip speed ratio", unit: "dimensionless" },
          { symbol: "\u03B2", name: "Blade pitch angle", unit: "degrees" },
        ],
        explanation:
          "The fundamental wind power equation. Available power scales with the cube of wind speed \u2014 doubling wind speed gives 8\u00D7 the power. C\u209A represents how efficiently the blades convert wind to rotation.",
      },
      {
        expression: "C\u209A,max = 16/27 \u2248 0.593 (Betz limit)",
        variables: [],
        explanation:
          "The theoretical maximum fraction of wind energy that any rotor can extract. The IEA 15 MW rotor reaches C\u209A,aero = 0.462 in operation (0.469 peak of the ROSCO table at \u03BB = 9) because of tip losses, drag and wake rotation.",
      },
    ],
    design: {
      v236Value: "3 \u00D7 117 m blades, 241.35 m rotor, max tip speed 95 m/s (IEA 15 MW)",
      reasoning:
        "Longer blades sweep more area, increasing energy capture at low wind speeds. Carbon-fibre spar caps reduce weight while maintaining stiffness for the extreme blade length.",
      influencingFactors: ["Wind regime", "Tip speed limit (95 m/s offshore)", "Blade mass vs. fatigue loads", "Manufacturing logistics"],
    },
    efficiencyNotes: [
      { name: "Tip losses", typicalLossPct: "~3-5%", dissipation: "Vortex shedding at blade tips" },
      { name: "Profile drag", typicalLossPct: "~2-3%", dissipation: "Aerodynamic friction on airfoil surfaces" },
    ],
    simpleExplanation:
      "Think of the blades like sails on a boat \u2014 they catch the wind and spin. Bigger blades catch more wind. The pitch system tilts them to control how much power is generated, like adjusting a sail angle.",
    technicalExplanation:
      "The rotor converts kinetic wind energy to rotational mechanical energy via aerodynamic lift on the blade airfoils. Power coefficient C\u209A is maximized by maintaining optimal tip-speed ratio \u03BB through variable-speed operation below rated wind, and constrained via collective pitch control above rated wind to limit loads.",
    faultTypes: ["PITCH_CONTROL_FAULT", "HYDRAULIC_PRESSURE_LOW"],
  },

  // ── Hub ──
  {
    partId: "hub",
    title: "Rotor Hub",
    overview:
      "The hub connects all three blades to the main shaft. It transfers the combined aerodynamic torque from the blades into the drivetrain and houses the pitch actuators that individually rotate each blade.",
    standards: ["IEC 61400-1", "DNV-ST-0376"],
    formulas: [
      {
        expression: "Q\u209C\u2092\u209C\u2090\u2097 = \u03A3Q\u1D62 (i=1..3)",
        variables: [
          { symbol: "Q\u1D62", name: "Blade root torque", unit: "kN\u00B7m" },
          { symbol: "Q\u209C\u2092\u209C\u2090\u2097", name: "Total rotor torque", unit: "kN\u00B7m" },
        ],
        explanation:
          "The hub sums the individual blade contributions. At rated power (15 MW, 7.56 rpm) the rotor torque is about 19.8 MN\u00B7m.",
      },
    ],
    design: {
      v236Value: "Cast hub, \u00D8 7.94 m, hub system \u2248 69 t incl. pitch system and spinner (IEA 15 MW)",
      reasoning:
        "Cast ductile iron provides the complex geometry needed for three blade-root flanges plus pitch bearing interfaces while withstanding extreme bending moments.",
      influencingFactors: ["Blade root bending moments", "Pitch bearing integration", "Ice loading", "Hub-height wind shear"],
    },
    efficiencyNotes: [],
    simpleExplanation:
      "The hub is like the center of a bicycle wheel \u2014 it's the part where all the spokes (blades) connect and spin together.",
    technicalExplanation:
      "The hub is a rigid cast-iron structure transmitting asymmetric aerodynamic loads from three independent blade roots into the main shaft bearing system. It integrates individual pitch drives (modelled here as hydraulic cylinders with accumulator backup; the IEA reference does not specify the actuator type) that enable blade-specific pitch control for load mitigation.",
    faultTypes: ["PITCH_CONTROL_FAULT", "HYDRAULIC_PRESSURE_LOW"],
  },

  // ── Shaft ──
  {
    partId: "shaft",
    title: "Main Shaft (Direct Drive)",
    overview:
      "A short, hollow, large-diameter forged shaft (outer radius 3.0 m, 2.2 m long) bolted to the hub. It turns on two main bearings around the stationary turret and carries the outer rotor of the direct-drive generator \u2014 there is no gearbox, so it turns at rotor speed (5.0\u20137.56 rpm) under the full rotor torque.",
    standards: ["IEC 61400-1", "DIN 743", "DNV-ST-0361"],
    formulas: [
      {
        expression: "P\u2098\u2091\u2092\u2095 = Q \u00B7 \u03C9",
        variables: [
          { symbol: "Q", name: "Shaft torque", unit: "N\u00B7m" },
          { symbol: "\u03C9", name: "Angular velocity", unit: "rad/s" },
          { symbol: "P\u2098\u2091\u2092\u2095", name: "Mechanical power", unit: "W" },
        ],
        explanation:
          "Mechanical power is torque times angular velocity. At rated: \u03C9 = 7.56 rpm \u00D7 2\u03C0/60 = 0.792 rad/s and the rotor delivers 15.66 MW (15 MW electrical \u00F7 generator 96.55 % \u00F7 converter 99.18 %), so Q = P/\u03C9 \u2248 19.8 MN\u00B7m \u2014 the ROSCO rated generator torque (VS_RtTq 19.79 MN\u00B7m).",
      },
    ],
    design: {
      v236Value: "Hollow forged shaft, outer radius 3.0 m / inner 2.8 m, 2.2 m long (IEA 15 MW, Table 5-2)",
      reasoning:
        "A large diameter gives torsional and bending stiffness at low mass; the hollow bore leaves room for the stationary turret and the bearings, so the shaft can be short.",
      influencingFactors: ["Rated torque (19.8 MN\u00B7m)", "Rotor weight and thrust moments", "Fatigue life (25 years)", "Emergency-stop torque reversals"],
    },
    efficiencyNotes: [
      { name: "Bearing friction", typicalLossPct: "<0.1%", dissipation: "Heat in the main-bearing grease" },
    ],
    simpleExplanation:
      "Like the axle of a car wheel, the main shaft carries the spinning motion from the blades \u2014 but here it drives the generator directly, without a gearbox. It spins slowly but with tremendous force.",
    technicalExplanation:
      "The low-speed shaft is a forged, heat-treated alloy steel tube designed per DIN 743 for fatigue. It transmits about 19.8 MN\u00B7m at rated speed; the critical design cases are emergency-stop transients and generator short-circuit torques. Its load path runs through the upwind (locating) and downwind (non-locating) main bearings into the turret and bedplate (Gaertner et al. 2020, NREL/TP-5000-75698).",
    faultTypes: [],
  },

  // ── Main Bearing ──
  {
    partId: "bearing",
    title: "Main Bearings",
    overview:
      "Two main bearings, 1.2 m apart, carry the rotor (blades + hub \u2248 270 t) and the generator rotor on the stationary turret: an upwind tapered double outer-ring bearing (locating, takes the thrust) and a downwind spherical roller bearing (non-locating). They must handle huge radial and axial loads for 25+ years; temperature and vibration are their key health indicators.",
    standards: ["ISO 281", "ISO 10816-21", "ISO 15243"],
    formulas: [
      {
        expression: "L\u2081\u2080\u2095 = (C/P)^p \u00D7 10\u2076 / (60\u00B7n)",
        variables: [
          { symbol: "C", name: "Dynamic load rating", unit: "kN" },
          { symbol: "P", name: "Equivalent dynamic load", unit: "kN" },
          { symbol: "p", name: "Life exponent (3 for balls, 10/3 for rollers)", unit: "dimensionless" },
          { symbol: "n", name: "Rotational speed", unit: "rpm" },
          { symbol: "L\u2081\u2080\u2095", name: "Basic rating life", unit: "hours" },
        ],
        explanation:
          "ISO 281 bearing life: L\u2081\u2080 is the life that 90 % of identical bearings survive. A 25-year life is \u2248 219,000 h; at 7.56 rpm that is only \u2248 1.0 \u00D7 10\u2078 revolutions, which is why low-speed main bearings are sized by static capacity and fatigue under load reversals rather than by revolutions.",
      },
      {
        expression: "BPFO = n/2 \u00B7 f\u1D63 \u00B7 (1 \u2212 d/D\u00B7cos \u03B1)",
        variables: [
          { symbol: "n", name: "Rolling elements per row", unit: "-" },
          { symbol: "f\u1D63", name: "Shaft frequency (7.56 rpm = 0.126 Hz)", unit: "Hz" },
          { symbol: "d/D", name: "Roller / pitch diameter ratio", unit: "-" },
        ],
        explanation:
          "Outer-race defect frequency used by the CMS. With assumed geometry (OEM data is confidential) the upwind bearing gives \u2248 3.6 Hz and the downwind one \u2248 2.3 Hz \u2014 far below 10 Hz, so the spectrum needs a fine 0.03 Hz resolution.",
      },
    ],
    design: {
      v236Value: "Upwind tapered double outer-ring (locating) + downwind spherical roller (non-locating), 1.2 m apart (IEA 15 MW, Table 5-2)",
      reasoning:
        "Two bearings spread the rotor overhang moment; one locating bearing takes the thrust while the non-locating one lets the shaft grow thermally.",
      influencingFactors: ["Rotor + generator weight", "Axial thrust (\u2248 2.4 MN near rated)", "Grease quality", "Temperature cycling"],
    },
    efficiencyNotes: [
      { name: "Friction torque", typicalLossPct: "<0.1%", dissipation: "Heat in the bearing grease" },
    ],
    simpleExplanation:
      "The main bearings are like the bearings in a bicycle wheel hub \u2014 they let the heavy rotor spin smoothly. If they get too hot or vibrate too much, it's a sign of trouble, like a squeaky wheel.",
    technicalExplanation:
      "Rated per ISO 281 with modified life factors for contamination, lubrication and load pattern. The CMS tracks vibration (ISO 10816-21 velocity RMS, BPFO/BPFI envelope) and temperature to estimate remaining useful life. A main-bearing exchange on a direct drive needs a jack-up vessel, so early detection is worth a lot.",
    faultTypes: ["BEARING_OVERTEMP", "VIBRATION_ALARM"],
  },

  // ── Generator ──
  {
    partId: "generator",
    title: "Direct-Drive Generator (PMSG)",
    overview:
      "A 200-pole radial-flux permanent-magnet synchronous generator with an outer rotor (air-gap radius 5.08 m, core length 2.17 m, 10 mm air gap). It sits between the hub and the nacelle and turns at rotor speed \u2014 no gearbox \u2014 so it produces low-frequency AC (12.6 Hz at 7.56 rpm, 4.77 kV) that a full-power converter turns into 50 Hz. Full-load efficiency 96.55 %.",
    standards: ["IEC 60034-1", "IEC 60034-18-41", "IEC 61400-21-1"],
    formulas: [
      {
        expression: "f\u2091 = (p/2) \u00B7 n / 60",
        variables: [
          { symbol: "p", name: "Number of poles", unit: "200" },
          { symbol: "n", name: "Rotor speed", unit: "rpm" },
          { symbol: "f\u2091", name: "Stator electrical frequency", unit: "Hz" },
        ],
        explanation:
          "A direct drive turns slowly, so it needs many poles: 100 pole pairs \u00D7 7.56 rpm / 60 = 12.6 Hz at rated. That is why the converter must handle the full power \u2014 the grid is at 50 Hz.",
      },
      {
        expression: "P\u2091\u2097 = P\u2098\u2091\u2092\u2095 \u00D7 \u03B7\u2091\u2091\u2099 \u00D7 \u03B7\u2092\u2092\u2099\u1D65",
        variables: [
          { symbol: "P\u2098\u2091\u2092\u2095", name: "Shaft power", unit: "MW" },
          { symbol: "\u03B7\u2091\u2091\u2099", name: "Generator efficiency", unit: "0.9655" },
          { symbol: "\u03B7\u2092\u2092\u2099\u1D65", name: "Converter efficiency", unit: "0.9918" },
          { symbol: "P\u2091\u2097", name: "Electrical power", unit: "MW" },
        ],
        explanation:
          "At rated the rotor delivers 15.66 MW: \u00D7 0.9655 = 15.12 MW at the generator terminals (\u2248 540 kW of heat in the stator), \u00D7 0.9918 = 15.0 MW after the converter. The product 0.95756 is the ROSCO VS_GenEff behind the official power table.",
      },
    ],
    design: {
      v236Value: "200-pole PMSG, outer rotor, 4.77 kV, 12.6 Hz at rated, \u03B7 96.55 %, active mass 214 t (IEA 15 MW, Table 5-4)",
      reasoning:
        "Removing the gearbox removes the component with the highest offshore downtime; the price is a large, heavy generator (369 t in total) and a full-power converter.",
      influencingFactors: ["Winding temperature (class F, 155 \u00B0C)", "Rare-earth magnet supply (24 t)", "Air-gap stiffness", "Cooling capacity"],
    },
    efficiencyNotes: [
      { name: "Copper losses (I\u00B2R)", typicalLossPct: "~2%", dissipation: "Heat in the stator windings" },
      { name: "Iron + magnet losses", typicalLossPct: "~1.5%", dissipation: "Eddy currents and hysteresis in the core and magnets" },
    ],
    simpleExplanation:
      "The generator is like a giant bicycle dynamo bolted straight to the rotor. Because it turns as slowly as the blades, it needs 200 magnet poles to make enough electricity.",
    technicalExplanation:
      "A permanent-magnet synchronous machine rated per IEC 60034 (class F insulation). Its variable-frequency output is rectified by the machine-side converter. The stator-winding temperature is the life-limiting quantity \u2014 roughly every 10 \u00B0C above rating halves insulation life (Arrhenius); the twin and the nacelle model use T = T_air + 10 K + 0.125 K/kW \u00B7 Q_gen \u2248 93 \u00B0C at rated on a 15 \u00B0C day (Gaertner et al. 2020, NREL/TP-5000-75698).",
    faultTypes: ["GENERATOR_WINDING_TEMP"],
  },

  // ── Converter ──
  {
    partId: "converter",
    title: "Power Converter",
    overview:
      "The full-scale power converter converts the generator's variable-frequency AC into grid-compatible fixed-frequency AC (50 Hz). It consists of a machine-side rectifier (AC\u2192DC), DC link, and grid-side inverter (DC\u2192AC), enabling full control of active and reactive power. The generator side runs at 4.77 kV and 12.6 Hz (IEA 15 MW); the grid-side output feeds the turbine's step-up transformer to 66 kV before the array cable. Transformer losses are typically ~0.5% (copper + iron losses), governed by the turns ratio N\u2082/N\u2081 = V\u2082/V\u2081 = 66,000/784 \u2248 84.2:1.",
    standards: ["ENTSO-E NC RfG Type D", "PSE IRiESP", "IEC 61400-21"],
    formulas: [
      {
        expression: "P\u2091\u2063\u2092\u209A = P\u2091\u2091\u2099 \u00D7 \u03B7\u2092\u2092\u2099\u1D65",
        variables: [
          { symbol: "P\u2091\u2091\u2099", name: "Generator output", unit: "MW" },
          { symbol: "\u03B7\u2092\u2092\u2099\u1D65", name: "Converter efficiency", unit: "0.9918" },
          { symbol: "P\u2091\u2063\u2092\u209A", name: "Power to grid", unit: "MW" },
        ],
        explanation:
          "The converter adds \u2248 0.8 % loss from IGBT switching and conduction. At rated: 15.12 MW from the generator \u00D7 0.9918 = 15.0 MW (the official power table), so that generator \u00D7 converter = 95.756 % (ROSCO VS_GenEff).",
      },
    ],
    design: {
      v236Value: "Full-scale AC/DC/AC, IGBT-based, generator side 4.77 kV / 12.6 Hz, 66 kV via step-up transformer",
      reasoning:
        "Full-scale converter decouples the generator entirely from the grid, enabling FRT compliance and full reactive power control without additional STATCOM at turbine level.",
      influencingFactors: ["IGBT junction temperature", "Cooling system", "DC link voltage", "Grid fault duration"],
    },
    efficiencyNotes: [
      { name: "Switching losses", typicalLossPct: "~1.2%", dissipation: "Heat in IGBT modules (liquid cooled)" },
      { name: "Conduction losses", typicalLossPct: "~0.8%", dissipation: "Resistive heat in power semiconductors" },
      { name: "Transformer losses (→ 66 kV, illustrative)", typicalLossPct: "~0.5%", dissipation: "Copper (I²R) + iron (hysteresis/eddy) losses in step-up transformer" },
    ],
    simpleExplanation:
      "The converter is like a universal power adapter for your laptop \u2014 it changes the electricity from what the generator produces into what the power grid needs. It also helps the turbine 'ride through' grid disturbances.",
    technicalExplanation:
      "A full-scale back-to-back voltage-source converter using IGBT modules. Machine-side converter implements field-oriented control for torque regulation; grid-side converter implements voltage-oriented control for P/Q dispatch. FRT capability per ENTSO-E NC RfG Type D requires reactive current injection within 20 ms of voltage dip detection.",
    faultTypes: ["CONVERTER_OVERTEMP", "GRID_FREQUENCY_FAULT"],
  },

  // ── Yaw System ──
  {
    partId: "yaw",
    title: "Yaw System",
    overview:
      "The yaw system rotates the nacelle to face the wind direction. It uses electric yaw motors with a gear ring on the tower top. A deadband of \u00B18\u00B0 prevents continuous hunting. Yaw misalignment causes cubic power loss.",
    standards: ["IEC 61400-1 \u00A77.6.4", "IEC 61400-11"],
    formulas: [
      {
        expression: "P\u2097\u2092\u209B\u209B = P \u00D7 (1 \u2212 cos\u00B3\u03B3)",
        variables: [
          { symbol: "P", name: "Available power", unit: "MW" },
          { symbol: "\u03B3", name: "Yaw misalignment angle", unit: "degrees" },
          { symbol: "P\u2097\u2092\u209B\u209B", name: "Power loss", unit: "MW" },
        ],
        explanation:
          "Power loss from yaw misalignment follows a cos\u00B3 relationship. A 10\u00B0 misalignment loses ~4.6% of power; 20\u00B0 loses ~17%.",
      },
    ],
    design: {
      v236Value: "Electric yaw drives on a 6.5 m yaw bearing, \u00B18\u00B0 error threshold, 0.5\u00B0/s yaw rate (ROSCO Y_ErrThresh / Y_Rate)",
      reasoning:
        "Electric motors (vs. hydraulic) are simpler to maintain offshore. The \u00B18\u00B0 deadband balances energy capture against yaw motor wear and cable twist accumulation.",
      influencingFactors: ["Wind direction variability", "Cable twist counter", "Yaw brake wear", "Wind vane accuracy"],
    },
    efficiencyNotes: [
      { name: "Average yaw misalignment", typicalLossPct: "~2-3%", dissipation: "Reduced aerodynamic capture" },
      { name: "Yaw motor energy", typicalLossPct: "~0.1%", dissipation: "Parasitic electrical consumption" },
    ],
    simpleExplanation:
      "The yaw system is like a weathervane \u2014 it turns the whole turbine top to face the wind. If it doesn't point the right way, the blades can't catch as much wind, like trying to fly a kite sideways.",
    technicalExplanation:
      "Four AC servo motors engage a slewing ring bearing via planetary gearboxes. The yaw controller uses filtered nacelle wind vane input with \u00B18\u00B0 deadband to command yaw rotations. Cable twist is managed by a twist counter with automatic unwind cycles. Yaw misalignment \u03B3 causes cos\u00B3\u03B3 power loss \u2014 a key AEP derating factor in energy yield assessments.",
    faultTypes: ["YAW_ERROR"],
  },

  // ── Tower ──
  {
    partId: "tower",
    title: "Tower",
    overview:
      "The tubular steel tower supports the nacelle and rotor at 150 m hub height. It is tapered (wider at base) and constructed from welded steel sections, transported by specialized vessels and bolted together on-site.",
    standards: ["IEC 61400-3-1", "DNV-ST-0126", "EN 1993-1-6"],
    formulas: [
      {
        expression: "f\u2081 = (1/2\u03C0) \u00D7 \u221A(k/m)",
        variables: [
          { symbol: "f\u2081", name: "First natural frequency", unit: "Hz" },
          { symbol: "k", name: "Effective stiffness", unit: "N/m" },
          { symbol: "m", name: "Effective mass (nacelle + rotor)", unit: "kg" },
        ],
        explanation:
          "The tower's first natural frequency must fall between 1P and 3P (soft-stiff design) to avoid resonance. IEA 15 MW: 1P = 0.083\u20130.126 Hz (5\u20137.56 rpm), 3P = 0.25\u20130.38 Hz, first tower-monopile mode 0.17 Hz.",
      },
    ],
    design: {
      v236Value: "150 m hub height, tapered tubular steel, \u00D8 10 m base \u2192 6.5 m top (IEA 15 MW)",
      reasoning:
        "Higher hub heights access stronger, more consistent winds. Offshore towers are shorter than onshore equivalents because surface roughness over water is lower, reducing wind shear.",
      influencingFactors: ["Hub-height wind speed", "Wave-induced fatigue", "Installation vessel constraints", "Corrosion protection"],
    },
    efficiencyNotes: [],
    simpleExplanation:
      "The tower is a giant steel tube that holds the turbine up high where the wind is stronger and steadier. It must be carefully designed so it doesn't vibrate in sync with the spinning blades.",
    technicalExplanation:
      "A soft-stiff tubular steel tower with first eigenfrequency placed between 1P and 3P to avoid rotor-excited resonance. Designed per IEC 61400-3-1 for combined wind-wave loading with 50-year extreme environmental conditions. Corrosion protection via thermal spray aluminum (TSA) coating in the splash zone.",
    faultTypes: [],
  },

  // ── Foundation ──
  {
    partId: "foundation",
    title: "Monopile Foundation",
    overview:
      "The monopile is a large steel cylinder driven 25\u201330 m into the seabed. At 8\u201310 m outer diameter, it transfers all turbine loads (weight, wind thrust, wave forces) into the seabed soil. It is the most common offshore wind foundation type.",
    standards: ["DNV-ST-0126", "DNV-RP-C212", "ISO 19901-4"],
    formulas: [
      {
        expression: "F\u209C\u2095\u2063\u1D64\u209B\u209C = \u00BD \u00D7 \u03C1 \u00D7 A \u00D7 V\u00B2 \u00D7 C\u209C",
        variables: [
          { symbol: "\u03C1", name: "Air density", unit: "kg/m\u00B3" },
          { symbol: "A", name: "Rotor area", unit: "m\u00B2" },
          { symbol: "V", name: "Wind speed", unit: "m/s" },
          { symbol: "C\u209C", name: "Thrust coefficient", unit: "dimensionless" },
        ],
        explanation:
          "The axial thrust force on the rotor is transmitted through the tower into the foundation. At rated wind speed, thrust can exceed 2,500 kN (250 tonnes-force).",
      },
    ],
    design: {
      v236Value: "Monopile, 10 m OD, 55 \u2192 44 mm wall, \u2248 1,310 t (IEA 15 MW reference in 30 m water)",
      reasoning:
        "Monopiles are cost-effective in water depths up to ~40 m. The large diameter provides sufficient lateral stiffness to meet eigenfrequency requirements without complex jacket structures.",
      influencingFactors: ["Water depth", "Seabed soil conditions", "Scour protection", "Installation hammer energy"],
    },
    efficiencyNotes: [],
    simpleExplanation:
      "The monopile is like a giant fence post hammered into the sea floor. It holds the entire turbine steady against wind, waves, and currents for 25+ years.",
    technicalExplanation:
      "A driven steel monopile designed per DNV-ST-0126 with P-y curve soil-structure interaction analysis. Lateral capacity is governed by cyclic degradation of soil stiffness under combined wind-wave loading. Scour protection (rock dumping) prevents seabed erosion around the pile.",
    faultTypes: [],
  },

  // ── Nacelle ──
  {
    partId: "nacelle",
    title: "Nacelle Enclosure",
    overview:
      "The nacelle is the climate-controlled housing atop the tower that protects all drivetrain components. It contains the condition monitoring system (CMS), SCADA controllers, and environmental sensors. Offshore nacelles must withstand salt spray, humidity, and extreme temperatures.",
    standards: ["IEC 61400-1", "IEC 61850", "IEC 61400-25"],
    formulas: [],
    design: {
      v236Value: "GRP enclosure, climate-controlled; nacelle mass \u2248 673 t incl. the 369 t generator (IEA 15 MW)",
      reasoning:
        "GRP provides corrosion resistance and light weight. Climate control maintains stable operating conditions for electronics and prevents condensation on cold metal surfaces.",
      influencingFactors: ["Humidity control", "Salt spray ingress", "Service crane access", "Helicopter winch zone"],
    },
    efficiencyNotes: [
      { name: "Climate control parasitic", typicalLossPct: "~0.2%", dissipation: "HVAC electrical consumption" },
    ],
    simpleExplanation:
      "The nacelle is the 'body' of the turbine \u2014 like the hood of a car covering the engine. It keeps rain, salt, and extreme temperatures away from the sensitive equipment inside.",
    technicalExplanation:
      "A weatherproof GRP enclosure behind the direct-drive generator, housing the bedplate, converter, transformer, cooling and hydraulics, with IEC 61850 communication via fibre optic to the tower-base SCADA cabinet. The condition monitoring system (ISO 10816-21, ISO 13373) watches main-bearing vibration, generator winding temperatures and hydraulic-oil quality.",
    faultTypes: ["COMMUNICATION_LOSS"],
  },

  // ── Wind (incoming flow) ──
  {
    partId: "wind",
    title: "Incoming Wind",
    overview:
      "Wind is the primary energy source. The turbine operates between cut-in (3 m/s) and cut-out (25 m/s) wind speeds, with rated power from 10.66 m/s (IEA 15 MW). Wind speed follows a Weibull distribution, and hub-height speed is estimated from surface measurements using the power law. Downstream turbines experience a wake deficit — reduced wind speed and increased turbulence — which can cut power by 8–12% at farm level (see the wake cone visualization below the cross-section).",
    standards: ["IEC 61400-12-1", "IEC 61400-1 Annex B", "IEC 61400-12-2"],
    formulas: [
      {
        expression: "P\u2090\u1D65\u2090\u1D62\u2097 = \u00BD \u00D7 \u03C1 \u00D7 A \u00D7 V\u00B3",
        variables: [
          { symbol: "\u03C1", name: "Air density", unit: "kg/m\u00B3 (~1.225 at sea level)" },
          { symbol: "A", name: "Swept area", unit: "m\u00B2 (45,750 for the IEA 15 MW rotor)" },
          { symbol: "V", name: "Wind speed", unit: "m/s" },
        ],
        explanation:
          "Available power in the wind before any extraction. At rated 10.66 m/s: P = 0.5 \u00D7 1.225 \u00D7 45,750 \u00D7 10.66\u00B3 \u2248 33.9 MW available, from which the turbine delivers 15 MW (C\u209A,el \u2248 0.442).",
      },
      {
        expression: "V(h) = V\u2063\u2091\u2091\u2099 \u00D7 (h/h\u2063\u2091\u2091\u2099)^\u03B1",
        variables: [
          { symbol: "V(h)", name: "Wind speed at height h", unit: "m/s" },
          { symbol: "V\u2063\u2091\u2091\u2099", name: "Reference wind speed", unit: "m/s" },
          { symbol: "\u03B1", name: "Wind shear exponent", unit: "~0.10\u20130.14 offshore" },
        ],
        explanation:
          "The wind power law estimates wind speed at hub height from a measurement at a reference height. Offshore \u03B1 is typically lower than onshore due to reduced surface roughness.",
      },
    ],
    design: {
      v236Value: "Cut-in 3 m/s, rated 10.66 m/s, cut-out 25 m/s (official IEA 15 MW table)",
      reasoning:
        "A low specific power (328 W/m\u00B2) reaches rated power early, at 10.66 m/s; the 25 m/s cut-out is the conventional limit of the reference controller (no storm ride-through).",
      influencingFactors: ["Air density (temperature/pressure)", "Turbulence intensity", "Wind shear", "Wake effects from upstream turbines"],
    },
    efficiencyNotes: [
      { name: "Wake losses (farm level)", typicalLossPct: "~8-12%", dissipation: "Reduced wind speed downstream of upstream turbines" },
      { name: "Availability losses", typicalLossPct: "~3-5%", dissipation: "Downtime for maintenance and faults" },
    ],
    simpleExplanation:
      "Wind is the fuel for the turbine. The faster the wind blows, the more power is available \u2014 but there's a sweet spot. Too little wind and the turbine can't start; too much and it has to shut down for safety.",
    technicalExplanation:
      "Hub-height wind resource characterization per IEC 61400-12-1 using cup/sonic anemometry or LiDAR. The Weibull distribution (shape k \u2248 2.0\u20132.2, scale A \u2248 9\u201310 m/s for Baltic) models long-term wind speed frequency, enabling AEP estimation through convolution with the power curve.",
    faultTypes: [],
  },

  // ── Brake ──
  {
    partId: "brake",
    title: "Rotor Brake / Lock",
    overview:
      "Hydraulic calipers grip the generator rotor disc to stop and lock the rotor for maintenance. On a direct drive there is no high-speed shaft, so the brake works at rotor speed and must hold the full rotor torque. It is a fail-safe parking brake \u2014 power regulation and emergency stopping are done by pitching the blades.",
    standards: ["IEC 61400-1 \u00A78.3", "ISO 13849-1", "DNV-ST-0361"],
    formulas: [
      {
        expression: "Q_brake \u2265 SF \u00B7 Q_aero,max",
        variables: [
          { symbol: "Q_brake", name: "Brake holding torque", unit: "MN\u00B7m" },
          { symbol: "SF", name: "Safety factor", unit: "1.5\u20132.0" },
          { symbol: "Q_aero,max", name: "Maximum aerodynamic torque", unit: "MN\u00B7m" },
        ],
        explanation:
          "Without a gear ratio to divide it, the brake sees the rotor torque directly \u2014 \u2248 19.8 MN\u00B7m at rated \u2014 so a direct drive relies on pitching the blades to feather first and uses the brake and rotor lock only near standstill.",
      },
    ],
    design: {
      v236Value: "Hydraulic calipers on the generator rotor disc + rotor lock pins (brake mass \u2248 24 t, IEA 15 MW nacelle mass table)",
      reasoning:
        "Placing the brake on the large-radius rotor disc gives a long lever arm, which keeps the caliper force manageable despite the full rotor torque.",
      influencingFactors: ["Rated rotor torque", "Storm idling loads", "Maintenance lock requirements", "Hydraulic supply"],
    },
    efficiencyNotes: [],
    simpleExplanation:
      "Like the handbrake of a car: it holds the rotor still when technicians work. The blades do the real stopping by turning out of the wind.",
    technicalExplanation:
      "Spring-applied, hydraulically released calipers act on the rotor disc; a mechanical rotor lock is engaged before personnel enter the hub. The control system stops the rotor by feathering at the 2 \u00B0/s pitch rate (ROSCO PC_MaxRat); the overspeed trip is at 9.07 rpm (ROSCO SD_MaxGenSpd).",
    faultTypes: [],
  },

  // ── Cooler ──
  {
    partId: "cooler",
    title: "Roof Cooler (CoolerTop)",
    overview:
      "A roof-mounted air/water-glycol radiator that rejects the heat of the direct-drive generator (\u2248 540 kW at rated) and the full-power converter (\u2248 124 kW). There is no gearbox oil to cool. Effective cooling matters: roughly every 10 \u00B0C above rated halves winding insulation life.",
    standards: ["IEC 61400-1", "IEC 60034-1", "IEC 60085"],
    formulas: [
      {
        expression: "Q = P\u2098\u2091\u2092\u2095\u00B7(1 \u2212 \u03B7\u2091\u2091\u2099) + P\u2098\u2091\u2092\u2095\u00B7\u03B7\u2091\u2091\u2099\u00B7(1 \u2212 \u03B7\u2092\u2092\u2099\u1D65)",
        variables: [
          { symbol: "P\u2098\u2091\u2092\u2095", name: "Shaft power (15.66 MW at rated)", unit: "MW" },
          { symbol: "\u03B7\u2091\u2091\u2099", name: "Generator efficiency", unit: "0.9655" },
          { symbol: "\u03B7\u2092\u2092\u2099\u1D65", name: "Converter efficiency", unit: "0.9918" },
        ],
        explanation:
          "Heat to reject at rated: 15.66 \u00D7 0.0345 = 0.54 MW from the generator plus 15.12 \u00D7 0.0082 = 0.12 MW from the converter \u2248 0.66 MW.",
      },
    ],
    design: {
      v236Value: "Roof radiator bank, water-glycol loop for generator stator and converter, variable-speed fans",
      reasoning:
        "Water-glycol carries the heat from the stator jacket and the converter cold plates to an air cooler on the roof, where the free-stream air is coolest and cleanest.",
      influencingFactors: ["Generator + converter losses (\u2248 665 kW)", "Baltic ambient (\u221220 to +35 \u00B0C)", "Salt-spray corrosion", "Fan parasitic power"],
    },
    efficiencyNotes: [
      { name: "Fan + pump power", typicalLossPct: "~0.1%", dissipation: "Auxiliary consumption" },
    ],
    simpleExplanation:
      "Like the radiator in a car, the cooling system pumps liquid through the hot generator and converter and blows air over it on the roof. Without it, the turbine would overheat and shut down.",
    technicalExplanation:
      "A forced-convection radiator with one water-glycol circuit serving the generator stator jacket and the converter cold plates. The stator-winding temperature (alarm 130 \u00B0C class B, trip 155 \u00B0C class F, IEC 60085) is the controlling limit; the converter coolant outlet guards the IGBT junctions.",
    faultTypes: ["COOLANT_FLOW_LOW", "GENERATOR_WINDING_TEMP", "CONVERTER_OVERTEMP"],
  },

  // ── Anemometer ──
  {
    partId: "anemometer",
    title: "Nacelle Anemometry",
    overview:
      "A heated cup anemometer and sonic anemometer mounted on the nacelle roof measure wind speed and direction for turbine control. Because the nacelle sits behind the rotor, the measured speed is disturbed by the blades — the Nacelle Transfer Function (NTF) corrects this to estimate free-stream wind speed.",
    standards: ["IEC 61400-12-2", "IEC 61400-12-1", "IEC 61400-1"],
    formulas: [
      {
        expression: "V_free = f_NTF(V_nacelle, P, ρ)",
        variables: [
          { symbol: "V_nacelle", name: "Measured nacelle wind speed", unit: "m/s" },
          { symbol: "P", name: "Active power output", unit: "MW" },
          { symbol: "ρ", name: "Air density", unit: "kg/m³" },
          { symbol: "V_free", name: "Estimated free-stream wind speed", unit: "m/s" },
          { symbol: "f_NTF", name: "Nacelle Transfer Function", unit: "calibration curve" },
        ],
        explanation:
          "The NTF is a site-specific calibration curve that maps nacelle-measured wind speed to the undisturbed free-stream speed. IEC 61400-12-2 defines the procedure for deriving this function using a temporary met mast.",
      },
    ],
    design: {
      v236Value: "Heated cup anemometer + ultrasonic, redundant sensors, nacelle-roof mounted",
      reasoning:
        "Heated cups prevent ice accumulation in offshore conditions. Ultrasonic backup has no moving parts but is affected by heavy rain. Dual-sensor redundancy ensures continuous wind measurement for safe turbine control.",
      influencingFactors: ["Icing conditions", "Rotor wake distortion", "Sensor calibration drift", "Lightning protection"],
    },
    efficiencyNotes: [],
    simpleExplanation:
      "The anemometer is a small weather station on top of the turbine that measures wind speed and direction. It tells the turbine controller how fast the wind is blowing so the turbine can adjust its blades and yaw to capture maximum energy.",
    technicalExplanation:
      "Nacelle-mounted anemometry provides the primary wind speed input for the turbine controller. Per IEC 61400-12-2, the Nacelle Transfer Function corrects for rotor induction effects — nacelle wind speed is typically 5–15% lower than free-stream due to energy extraction. Heated cup anemometers per ISO 17713-1 with ultrasonic redundancy provide resilience against icing and mechanical failure.",
    faultTypes: ["COMMUNICATION_LOSS"],
  },

  // ── Power Output ──
  {
    partId: "power_output",
    title: "Power Output",
    overview:
      "The electrical power the turbine delivers: the official IEA 15 MW power table gives it at the converter terminals; the nacelle transformer then steps it up to the 66 kV array cable. It is the end product of the chain: wind \u2192 rotor \u2192 direct-drive generator \u2192 converter \u2192 transformer \u2192 grid.",
    standards: ["IEC 61400-12-1", "IEC 61400-21-1", "ENTSO-E NC RfG"],
    formulas: [
      {
        expression: "P\u2091\u2097 = \u00BD\u03C1AV\u00B3 \u00B7 C\u209A,aero \u00B7 \u03B7\u2091\u2091\u2099 \u00B7 \u03B7\u2092\u2092\u2099\u1D65",
        variables: [
          { symbol: "C\u209A,aero", name: "Aerodynamic power coefficient", unit: "0.462 below rated" },
          { symbol: "\u03B7\u2091\u2091\u2099", name: "Generator efficiency", unit: "0.9655" },
          { symbol: "\u03B7\u2092\u2092\u2099\u1D65", name: "Converter efficiency", unit: "0.9918" },
        ],
        explanation:
          "At rated (10.66 m/s): \u00BD \u00D7 1.225 \u00D7 45,750 m\u00B2 \u00D7 10.66\u00B3 = 33.9 MW in the wind; \u00D7 0.462 = 15.66 MW on the shaft; \u00D7 0.95756 = 15.0 MW electrical \u2014 an overall C\u209A of 0.442.",
      },
    ],
    design: {
      v236Value: "15.0 MW rated from 10.66 m/s to the 25 m/s cut-out; C\u209A,el 0.442 below rated (IEA 15 MW table)",
      reasoning:
        "Above rated the pitch controller holds 15 MW; the converter limits the generator torque so the output never exceeds rating (Rule 1).",
      influencingFactors: ["Wind speed and air density", "Wake losses", "Availability", "Grid curtailment"],
    },
    efficiencyNotes: [
      { name: "Aerodynamic", typicalLossPct: "~54%", dissipation: "Betz limit, tip and profile losses" },
      { name: "Generator losses", typicalLossPct: "~3.5%", dissipation: "Copper, iron and magnet losses" },
      { name: "Converter losses", typicalLossPct: "~0.8%", dissipation: "IGBT switching and conduction" },
      { name: "Transformer losses", typicalLossPct: "~0.5%", dissipation: "Copper + iron in the step-up transformer (illustrative)" },
    ],
    simpleExplanation:
      "This is the electricity the turbine sends to the grid. Of the energy in the wind passing through the rotor, a bit over 40 % ends up as electricity at rated wind.",
    technicalExplanation:
      "Power follows the official IEA 15 MW table (cut-in 3, rated 10.66, cut-out 25 m/s), normalised for air density per IEC 61400-12-1 (v\u00B7(\u03C1/\u03C1\u2080)^\u2153). Active and reactive power set-points come from the park controller; the converter provides the reactive capability and fault ride-through required by NC RfG.",
    faultTypes: [],
  },

  // ── Bedplate / Mainframe ──
  {
    partId: "bedplate",
    title: "Bedplate (Mainframe)",
    overview:
      "The structural backbone of the nacelle: a curved cast-steel bedplate that carries the turret (with the main bearings and the generator stator) from its flange 5 m upwind of the tower axis down to the yaw bearing. All rotor loads \u2014 thrust, torque, bending moments \u2014 pass through it into the tower. IEA 15 MW: 70.3 t, 50 mm wall, nose height 4.875 m.",
    standards: ["IEC 61400-1", "EN 1993-1-9", "DNV-ST-0361"],
    formulas: [
      {
        expression: "M_tilt \u2248 F_thrust \u00B7 h + m_RNA \u00B7 g \u00B7 e",
        variables: [
          { symbol: "F_thrust", name: "Rotor thrust (\u2248 2.4 MN near rated)", unit: "MN" },
          { symbol: "m_RNA", name: "Rotor-nacelle assembly mass (\u2248 1,017 t)", unit: "t" },
          { symbol: "e", name: "Overhang of the rotor mass (11.35 m to the hub)", unit: "m" },
        ],
        explanation:
          "The overhung rotor and generator create a large nodding moment on the bedplate and yaw bearing; the thrust adds a fore-aft moment. Both cycle with every gust \u2014 fatigue (IEC 61400-1 DLC 1.x) drives the design.",
      },
    ],
    design: {
      v236Value: "Cast steel, 70.3 t, 50 mm wall, turret flange 5 m upwind of the tower axis (IEA 15 MW, Table 5-3)",
      reasoning:
        "A curved casting routes the loads from the turret flange to the 6.5 m yaw bearing smoothly, with no welds in the highest-stressed areas.",
      influencingFactors: ["Rotor thrust and nodding moment", "Fatigue (25 years)", "Casting size limits", "Yaw bearing diameter (6.5 m)"],
    },
    efficiencyNotes: [],
    simpleExplanation:
      "The bedplate is like the chassis of a car \u2014 everything bolts onto it. It carries the weight of the generator and rotor and passes every gust load down into the tower.",
    technicalExplanation:
      "Designed per EN 1993-1-9 detail categories for fatigue and checked for ultimate loads. Its stiffness also sets the air-gap stability of the direct-drive generator, which is mounted on the turret it carries (Gaertner et al. 2020, NREL/TP-5000-75698).",
    faultTypes: [],
  },

  // ── Hydraulic Power Unit ──
  {
    partId: "hpu",
    title: "Hydraulic Power Unit (HPU)",
    overview:
      "The HPU provides hydraulic pressure (180\u2013250 bar) for the blade pitch cylinders, the rotor brake calipers and the yaw brake calipers. A redundant accumulator circuit ensures blades can be feathered to a safe position even if grid power is lost. The HPU sizing here (\u2248 30 kW, \u223C200 L of ISO VG 46 oil) is illustrative \u2014 the IEA 15 MW reference does not model the pitch actuators.",
    standards: ["IEC 61400-1 \u00A76.6", "ISO 4413 (Hydraulic systems)", "EN 13849 (Safety of machinery)"],
    formulas: [
      {
        expression: "P_{accum} = P_0\u00B7(V_0/V_1)^\u03B3",
        variables: [
          { symbol: "P_0", name: "Pre-charge pressure", unit: "bar" },
          { symbol: "V_0", name: "Gas volume at pre-charge", unit: "L" },
          { symbol: "V_1", name: "Gas volume at working pressure", unit: "L" },
          { symbol: "\u03B3", name: "Adiabatic exponent (N\u2082: 1.4)", unit: "dimensionless" },
        ],
        explanation:
          "Bladder-type accumulators store energy under compressed nitrogen. At 250 bar operating pressure, a 50 L accumulator holds sufficient energy to pitch all three blades to feather (\u226590\u00B0) without any pump operation \u2014 the IEC 61400-1 safe-shutdown requirement.",
      },
    ],
    design: {
      v236Value: "30 kW pump, 180\u2013250 bar, ~200 L reservoir, 3\u00D7 blade pitch accumulators",
      reasoning:
        "Hydraulic pitch actuation is preferred over electric direct drives on this turbine class due to high force density and inherent fail-safe (spring-return to feather). Each blade has its own accumulator for single-failure tolerance.",
      influencingFactors: ["Pitch actuation force", "Fail-safe feathering energy", "Brake caliper pressure", "IEC 61400-1 DLC 2.1 (fault + shutdown)"],
    },
    efficiencyNotes: [
      { name: "Pump mechanical losses", typicalLossPct: "~5-8%", dissipation: "Bearing friction, volumetric losses" },
      { name: "Valve throttling", typicalLossPct: "~2-4%", dissipation: "Pressure drop across directional valves" },
    ],
    simpleExplanation:
      "The HPU is like the brake fluid system in a car, but much bigger. It uses pressurised oil to push the blade pitch cylinders, the main brake, and the yaw locks. If the power goes out, a stored pressure bottle (accumulator) still lets the blades turn safely to the stopped position.",
    technicalExplanation:
      "The HPU is a closed-circuit hydraulic system with fixed-displacement axial-piston pumps running at \u22481500 rpm, maintaining line pressure at 220 bar nominal. Three independent bladder accumulators (one per blade) are pre-charged to 140 bar with N\u2082 and provide the IEC 61400-1 DLC 2.1 safe-shutdown energy. Oil cleanliness is maintained at ISO 4406 class 16/14/11 via 10 \u03BCm absolute filtration. A thermal bypass valve routes oil through an air-blast cooler when T_oil > 55\u00B0C.",
    faultTypes: ["HYDRAULIC_PRESSURE_LOW"],
  },

  // ── Control Cabinets ──
  {
    partId: "control_cabinet",
    title: "Main Controller & Safety PLC",
    overview:
      "The nacelle control cabinets house the main turbine controller (TCS), the safety PLC, network switches, and I/O modules. The TCS implements the full IEC 61400-25-2 state machine, executing the MPPT algorithm below rated wind and the pitch/torque regulation above rated. The safety PLC runs IEC 61508 SIL 2 logic for overspeed, vibration, and fire trips.",
    standards: ["IEC 61400-25-2 (SCADA data model)", "IEC 61508 SIL 2 (safety PLC)", "IEC 62443-3-3 (cybersecurity)"],
    formulas: [
      {
        expression: "\u03A9_{opt} = \u03BB_{opt}\u00B7V / R",
        variables: [
          { symbol: "\u03BB_{opt}", name: "Optimal tip speed ratio", unit: "dimensionless" },
          { symbol: "V", name: "Wind speed", unit: "m/s" },
          { symbol: "R", name: "Rotor radius", unit: "m" },
        ],
        explanation:
          "Below rated wind speed, the TCS operates in MPPT mode: rotor speed is set to track \u03BB_{opt} = 9 (ROSCO VS_TSRopt, the tip-speed ratio that maximises C_p), between the 5.0 rpm minimum and 7.56 rpm. This is the Region 2 control law.",
      },
    ],
    design: {
      v236Value: "2\u00D7 cabinets, IEC 61131-3 PLC, 1 Gbps Ethernet ring, UPS-backed",
      reasoning:
        "Dual-cabinet architecture separates safety-critical I/O (PLC, e-stop, fire) from performance-critical I/O (TCS, pitch drives, grid interface). Physical separation provides fault isolation per IEC 62443 zone model.",
      influencingFactors: ["IEC 61508 SIL 2 requirement", "EMC environment (strong fields near generator)", "Operating temperature range -20\u00B0C to +55\u00B0C", "Hot-standby redundancy"],
    },
    efficiencyNotes: [],
    simpleExplanation:
      "These cabinets are the brain of the turbine. One cabinet is the main computer that decides how fast to spin and how to angle the blades. The other is the safety system that watches for faults and trips the turbine if something goes wrong.",
    technicalExplanation:
      "The TCS runs IEC 61131-3 structured text on a real-time OS with a 10 ms control loop. It implements the full four-region power curve: Region 1 (below cut-in, idling), Region 2 (MPPT, torque control), Region 2.5 (rated speed, power limiting), Region 3 (rated power, pitch control). The safety PLC is a separate processor with dedicated I/O, triple-redundant e-stop inputs, and hardware watchdog. All external communications use IEC 62443-3-3 SL-2 security measures (authentication, encryption, integrity checking).",
    faultTypes: ["COMMUNICATION_LOSS"],
  },

  // ── Nacelle Transformer ──
  {
    partId: "transformer",
    title: "Nacelle Step-Up Transformer",
    overview:
      "The nacelle transformer steps the converter output up to 66 kV for the array cable to the offshore substation. The IEA 15 MW reference specifies the generator (4.77 kV line) but not the converter output voltage or the transformer, so the rating here is illustrative: 16 MVA (\u2248 7 % above 15 MW), Dyn11, liquid-filled.",
    standards: ["IEC 60076-1", "IEC 60076-14", "IEC 61400-1"],
    formulas: [
      {
        expression: "I = S / (\u221A3 \u00B7 V)",
        variables: [
          { symbol: "S", name: "Apparent power", unit: "MVA" },
          { symbol: "V", name: "Line voltage", unit: "kV" },
        ],
        explanation:
          "At 15 MW and unity power factor the 66 kV side carries 15\u00D710\u2076 / (\u221A3 \u00B7 66,000) \u2248 131 A per turbine; a full string of six turbines adds up to \u2248 790 A on the 66 kV cable nearest the substation.",
      },
    ],
    design: {
      v236Value: "16 MVA, converter output \u2192 66 kV, Dyn11, liquid-filled (illustrative; WISDEM transformer mass \u2248 31 t)",
      reasoning:
        "A nacelle transformer keeps the high-current, lower-voltage cables short; a 66 kV array halves the current of a 33 kV array for the same power.",
      influencingFactors: ["Nacelle mass budget", "Fire safety (liquid vs dry type)", "Harmonics", "Array voltage (66 kV)"],
    },
    efficiencyNotes: [
      { name: "Transformer losses", typicalLossPct: "~0.5%", dissipation: "Copper (I\u00B2R) + iron losses (illustrative)" },
    ],
    simpleExplanation:
      "The transformer is a voltage booster: it turns the converter's output into 66,000 V, so the same power flows with much less current and the long cables lose less energy.",
    technicalExplanation:
      "A liquid-filled 66 kV transformer with Dyn11 vector group (30\u00B0 phase shift). With alternating vector groups between neighbouring turbines, part of the 5th and 7th harmonics cancels at the array bus (IEC 61000-3-6). Protection: Buchholz relay, pressure relief, winding temperature.",
    faultTypes: [],
  },

  // ── Coolant Skid / Heat Exchanger ──
  {
    partId: "coolant_skid",
    title: "Coolant Skid (Generator + Converter Loop)",
    overview:
      "Pumps, expansion tank, filter and valves of the water-glycol loop that carries heat from the direct-drive generator stator jacket (\u2248 540 kW at rated) and the converter cold plates (\u2248 124 kW) to the roof cooler. A direct drive has no gearbox oil circuit.",
    standards: ["IEC 61400-1", "IEC 60034-1", "IEC 60085"],
    formulas: [
      {
        expression: "\u1E41 = Q / (c\u209A \u00B7 \u0394T)",
        variables: [
          { symbol: "Q", name: "Heat load (\u2248 665 kW at rated)", unit: "kW" },
          { symbol: "c\u209A", name: "Water-glycol specific heat (\u2248 3.6 kJ/kg\u00B7K)", unit: "kJ/(kg\u00B7K)" },
          { symbol: "\u0394T", name: "Coolant temperature rise", unit: "K" },
        ],
        explanation:
          "With a 10 K coolant rise the loop needs \u2248 665 / (3.6 \u00D7 10) \u2248 18 kg/s \u2014 the pump sizing quantity (illustrative coolant values).",
      },
    ],
    design: {
      v236Value: "Water-glycol skid: duty/standby pumps, expansion tank, filter, 3-way valve (illustrative)",
      reasoning:
        "Duty/standby pumps keep the generator cooled if one pump fails; a thermostatic 3-way valve holds the coolant temperature on cold Baltic days.",
      influencingFactors: ["Generator + converter losses", "Ambient temperature", "Glycol concentration (freeze protection)", "Pump redundancy"],
    },
    efficiencyNotes: [
      { name: "Pump power", typicalLossPct: "~0.03%", dissipation: "Circulation pumps" },
    ],
    simpleExplanation:
      "The coolant skid is the heart of the cooling loop: it pumps the coolant through the hot generator and converter and up to the radiator on the roof.",
    technicalExplanation:
      "Coolant flow, pressure and the converter outlet temperature are monitored; a low-flow alarm (COOLANT_FLOW_LOW) derates the turbine before the stator winding reaches its class-B alarm (130 \u00B0C).",
    faultTypes: ["COOLANT_FLOW_LOW"],
  },

  // ── UPS / Battery Cabinet ──
  {
    partId: "ups",
    title: "Uninterruptible Power Supply (UPS)",
    overview:
      "The nacelle UPS provides backup power to safety-critical systems (pitch drives, yaw brakes, control systems, lighting, fire suppression) during grid loss or internal power fault. Backup duration is \u226515 minutes at full load \u2014 sufficient to complete a safe shutdown sequence and feather all blades. Battery technology: VRLA AGM (sealed lead-acid) or Li-ion in newer designs.",
    standards: ["IEC 62040-1 (UPS general requirements)", "IEC 61400-1 \u00A79 (Grid loss handling)", "IEC 60896-21 (VRLA batteries)"],
    formulas: [
      {
        expression: "E_{UPS} = P_{load}\u00B7t_{backup} / \u03B7_{discharge}",
        variables: [
          { symbol: "P_{load}", name: "UPS load power", unit: "kW" },
          { symbol: "t_{backup}", name: "Required backup duration", unit: "h" },
          { symbol: "\u03B7_{discharge}", name: "Discharge efficiency", unit: "dimensionless" },
        ],
        explanation:
          "For P_load = 15 kW (pitch drives + controls), t = 0.25 h (15 min), \u03B7 = 0.85: E = 15 \u00D7 0.25 / 0.85 = 4.4 kWh. Battery capacity is sized with a 1.5\u00D7 margin \u2192 ~6.6 kWh installed (typical: 2\u00D7 48 V / 100 Ah VRLA strings).",
      },
    ],
    design: {
      v236Value: "~6.6 kWh VRLA battery, 48 VDC bus, 15 min backup at 15 kW load",
      reasoning:
        "VRLA AGM batteries are preferred for offshore nacelles due to sealed construction (no acid spillage risk in tilted nacelle), wide temperature tolerance, and no hydrogen venting requirement. Li-ion variants offer higher energy density but require thermal management.",
      influencingFactors: ["Grid loss probability and duration", "Pitch drive energy for safe feathering", "Battery degradation at cold temperatures", "Weight budget (nacelle mass \u2248 673 t)"],
    },
    efficiencyNotes: [
      { name: "Battery round-trip", typicalLossPct: "~15%", dissipation: "Electrochemical losses, I\u00B2R in cells" },
      { name: "Inverter losses", typicalLossPct: "~5%", dissipation: "Switching losses in DC/AC inverter" },
    ],
    simpleExplanation:
      "The UPS is like the emergency battery in a laptop. If the electricity supply cuts out, the UPS keeps the blade pitch motors and computers running for 15 minutes \u2014 long enough to safely stop the turbine and point the blades away from the wind.",
    technicalExplanation:
      "The UPS is an online double-conversion system (IEC 62040-3 VFI class): grid AC \u2192 rectifier \u2192 DC bus \u2192 inverter \u2192 load. During normal operation the batteries float at full charge. On grid loss, the inverter draws from the battery without any transfer interruption. The IEC 61400-1 DLC 5.1 (emergency shutdown) analysis requires the pitch system to receive full power for at least one complete feathering cycle (~30 s at 2\u00B0/s). The 15-minute capacity far exceeds this, accommodating multiple retry attempts.",
    faultTypes: [],
  },

  // ── Service Crane Rail ──
  {
    partId: "crane_rail",
    title: "Internal Service Crane Rail",
    overview:
      "The nacelle service crane rail allows heavy components (converter modules, transformer parts, pumps, pitch parts) to be lifted and moved inside the nacelle for maintenance without requiring a large external crane. Two parallel I-beam rails run the full length of the nacelle ceiling, with a motorised trolley-hoist that can travel longitudinally. Safe working load (SWL) is typically 5\u201310 tonnes on offshore utility-scale turbines.",
    standards: ["EN 13001 (Crane design)", "IEC 61400-1 \u00A79 (O&M access)", "DNV-ST-0378 (Offshore cranes)"],
    formulas: [
      {
        expression: "M_{beam} = F\u00B7L/4 (mid-span, simply supported)",
        variables: [
          { symbol: "F", name: "Lifted load force", unit: "N" },
          { symbol: "L", name: "Rail span between supports", unit: "m" },
        ],
        explanation:
          "For a 10 t (98 kN) load at mid-span on a 20 m rail: M = 98,000 \u00D7 20 / 4 = 490 kN\u00B7m. The I-beam section modulus is sized to keep bending stress below the steel yield limit (355 MPa for S355 structural steel) with a 1.5\u00D7 safety factor.",
      },
    ],
    design: {
      v236Value: "Two HEB 300 I-beam rails, 20 m span, 10 t SWL, motorised trolley-hoist",
      reasoning:
        "Internal crane access is essential for component changeout offshore, where external crane vessels are extremely expensive (\u20AC150,000\u2013600,000/day). A main-bearing or generator exchange (generator 369 t) always needs a jack-up vessel; the internal crane handles converter and auxiliary replacements.",
      influencingFactors: ["Component replacement frequency (MTTR)", "Offshore crane vessel day rates", "Nacelle ceiling clearance", "Structural load path to bedplate"],
    },
    efficiencyNotes: [],
    simpleExplanation:
      "The crane rail is like a ceiling track in a factory. A hoist (electric winch) rolls along the track and lets technicians lift heavy components inside the nacelle \u2014 avoiding the need to bring a massive floating crane every time something needs to be replaced.",
    technicalExplanation:
      "The crane rail system consists of two parallel HEB 300 cold-rolled steel I-beams bolted to nacelle ceiling structure with gusset plates. The motorised trolley uses a variable-speed hoist with load monitoring to prevent SWL exceedance. End stops and limit switches prevent rail over-travel. Designed per EN 13001-2 with fatigue category EC1 (moderate use, \u2264100 full cycles/year). The rail is rated for dynamic loads including nacelle motion in wave-induced vessel roll (jack-up stabilisation not required as nacelle is tower-mounted).",
    faultTypes: [],
  },

  // ── Yaw Brake Calipers ──
  {
    partId: "yaw_brake",
    title: "Yaw Brake Calipers",
    overview:
      "Hydraulic disc brake calipers clamp onto the yaw slewing ring to lock the nacelle direction during normal operation and maintenance. The model uses four yaw brake calipers equally spaced around the 6.5 m yaw bearing (IEA 15 MW). During active yaw manoeuvres, the calipers are partially released to allow the yaw drives to turn the nacelle. In PARKED and MAINTENANCE states, calipers are fully applied at 250 bar.",
    standards: ["IEC 61400-1 \u00A77 (Mechanical design)", "ISO 3457 (Guards and protective devices)", "EN 13849 SIL 2 (safety brake)"],
    formulas: [
      {
        expression: "T_{brake} = 2\u00B7\u03BC\u00B7F_{clamp}\u00B7R_{disc}",
        variables: [
          { symbol: "\u03BC", name: "Friction coefficient (pad-disc)", unit: "dimensionless" },
          { symbol: "F_{clamp}", name: "Hydraulic clamping force per caliper", unit: "N" },
          { symbol: "R_{disc}", name: "Yaw ring radius", unit: "m" },
        ],
        explanation:
          "For \u03BC=0.35, F_clamp=150 kN per caliper (250 bar \u00D7 60 cm\u00B2 piston), R_disc=2.5 m: T = 4\u00D72\u00D70.35\u00D7150,000\u00D72.5 = 1.05 MN\u00B7m per caliper side. Total braking torque >>10 MN\u00B7m \u2014 far exceeds maximum yaw torque from wind loading.",
      },
    ],
    design: {
      v236Value: "4\u00D7 hydraulic calipers, 250 bar, 6.5 m yaw bearing, fail-safe spring-applied (illustrative)",
      reasoning:
        "Fail-safe spring-applied design ensures the nacelle is locked if hydraulic pressure is lost (e.g. HPU failure). Active yaw requires deliberate hydraulic release. This SIL 2 design prevents uncontrolled nacelle rotation that could overload the twist cables.",
      influencingFactors: ["Maximum yaw moment from asymmetric wind loading", "Cable twist limit (\u00B13.5 turns)", "Yaw drive motor torque for controlled rotation", "Offshore corrosion environment (316L stainless disc)"],
    },
    efficiencyNotes: [],
    simpleExplanation:
      "Yaw brakes are like powerful parking brakes for the nacelle direction. When the turbine has turned to face the wind, these hydraulic clamps lock the nacelle in place so it doesn\u2019t keep spinning. They release briefly when the wind direction changes.",
    technicalExplanation:
      "Each caliper is a spring-applied, hydraulically released (SAHR) disc brake per EN 13849 Category 3, PL d. The four calipers act on the outer flange of the yaw slewing ring. During yaw motions, the calipers are partially pressurised to provide damping torque (~20% of full clamp) to suppress yaw oscillations \u2014 the \u2018yaw damping\u2019 mode. Pad wear is monitored by a proximity sensor; worn pads generate a SCADA alarm at <5 mm remaining thickness. Disc is 25 mm 316L stainless steel for corrosion resistance.",
    faultTypes: ["YAW_ERROR"],
  },

  // ── Cable Routing (Nacelle to Tower) ──
  {
    partId: "cable_routing",
    title: "Nacelle Cable Routing (Power + Control)",
    overview:
      "A bundle of power cables and fibre-optic/control cables descends from the nacelle base through the centre of the tower to the tower base. The three MV power cables (66 kV XLPE, 240 mm\u00B2) carry rated current (~131 A at 66 kV). Control and data cables include fibre optic (1 Gbps IEC 61850 GOOSE), Profibus for pitch drives, and safety loop wiring. A cable twist loop accommodates \u00B13.5 full nacelle rotations before untwist.",
    standards: ["IEC 60840 (MV cables)", "IEC 61850-9 (Process bus)", "IEC 62305 (Lightning protection for cables)"],
    formulas: [
      {
        expression: "I_{rated} = P_{rated} / (\u221A3\u00B7U_{LL}\u00B7cos\u03C6)",
        variables: [
          { symbol: "P_{rated}", name: "Rated active power", unit: "W" },
          { symbol: "U_{LL}", name: "Line-to-line voltage", unit: "V" },
          { symbol: "cos\u03C6", name: "Power factor", unit: "dimensionless" },
        ],
        explanation:
          "At 15 MW rated, 66 kV, pf=0.9: I = 15\u00D710\u2076 / (\u221A3 \u00D7 66,000 \u00D7 0.9) = 146 A. The cable is rated at 240 mm\u00B2 XLPE with a continuous current rating of \u2265185 A (uprated by the J-tube thermal derating factor of ~0.8 \u2192 185/0.8 = 231 A \u2265 146 A).",
      },
    ],
    design: {
      v236Value: "3\u00D7 66 kV XLPE 240 mm\u00B2 MV cables, \u00B13.5-turn twist loop, 1 Gbps fibre optic ring",
      reasoning:
        "The twist loop stores cable length for nacelle rotation. At 3.5 turns \u00D7 5 m yaw ring circumference = 17.5 m of loop per cable. A cable twist counter in the TCS triggers an untwist sequence when the limit is approached.",
      influencingFactors: ["Rated current (146 A)", "Yaw rotation range (\u00B13.5 turns)", "Tower height (150 m cable run)", "IEC 62305 lightning surge protection"],
    },
    efficiencyNotes: [
      { name: "Cable I\u00B2R losses", typicalLossPct: "~0.1%", dissipation: "Resistive heating in 150 m tower cable run" },
    ],
    simpleExplanation:
      "Cables run from the nacelle all the way down through the middle of the tower to the seabed connection. Because the nacelle spins left and right to follow the wind, the cables have a looped section that uncoils as the nacelle rotates \u2014 like a retractable phone cord.",
    technicalExplanation:
      "The tower cable arrangement uses a J-tube termination at the nacelle base and free-hanging drops through the tower interior. A twist accumulator loop (spiral section) stores cable for \u00B13.5 rotations. The cable twist counter is implemented in the yaw controller: yaw angle is accumulated; at \u00B1630\u00B0 a soft warning is issued; at \u00B1900\u00B0 an untwist command executes. IEC 62305 surge protection devices are installed at the nacelle cable entry. MV cable capacitance (~0.18 \u03BCF/km) contributes to array charging current management.",
    faultTypes: [],
  },

  // ── Fire Suppression System ──
  {
    partId: "fire_suppression",
    title: "Nacelle Fire Suppression System",
    overview:
      "The nacelle contains automatic fire suppression cylinders charged with a clean agent (typically HFC-227ea/FM-200 or inert gas CO\u2082) installed near the highest fire-risk areas: the hydraulic unit, the generator cable entry and the converter IGBT modules. Smoke detectors (VESDA air-sampling) and thermal fuses provide dual-channel detection before suppression discharge.",
    standards: ["IEC 61400-1 \u00A79 (Fire protection)", "NFPA 2001 (Clean agent suppression)", "ISO 14520 (Gaseous fire suppression)"],
    formulas: [
      {
        expression: "m_{agent} = C\u00B7V_{enclosure}\u00B7\u03C1_{air}",
        variables: [
          { symbol: "C", name: "Design concentration (% vol)", unit: "%" },
          { symbol: "V", name: "Enclosure volume", unit: "m\u00B3" },
          { symbol: "\u03C1_{air}", name: "Air density", unit: "kg/m\u00B3" },
        ],
        explanation:
          "For HFC-227ea, design concentration C = 7% (NOAEL limit). Nacelle volume \u2248 900 m\u00B3. Required agent mass \u2248 0.07 \u00D7 900 \u00D7 1.225 \u00D7 0.73 (agent specific weight factor) \u2248 56 kg. Distributed across 4 cylinders \u00D7 20 kg each.",
      },
    ],
    design: {
      v236Value: "4\u00D7 20 kg HFC-227ea cylinders, VESDA smoke detection, CO\u2082 pre-warning alarm",
      reasoning:
        "Clean agents are essential offshore to avoid water damage to electrical equipment and because manual intervention is impossible. HFC-227ea is electrically non-conductive, low-toxicity at design concentration, and leaves no residue on electronics.",
      influencingFactors: ["Nacelle enclosure volume", "Occupied vs unoccupied detection strategy", "Insurance and DNV type approval requirements", "Environmental regulations on halon alternatives"],
    },
    efficiencyNotes: [],
    simpleExplanation:
      "Fire is a serious risk inside the nacelle because hydraulic oil, large electrical machines and high-voltage electronics are all confined in one space. The fire suppression cylinders automatically spray a gas that smothers flames without damaging electronics \u2014 think of it as a giant fire extinguisher that fires itself.",
    technicalExplanation:
      "The dual-channel detection (VESDA + thermal) prevents false discharge (probability <10\u207B\u2076/year per IEC 61508). On confirmed fire, a 30-second pre-alarm alert sounds (allows personnel evacuation), then agent discharges at 10 bar through nozzles designed to achieve design concentration within 10 s (ISO 14520). Post-discharge, the nacelle is ventilated before re-entry. The system interfaces with the safety PLC to trigger emergency shutdown (pitch to feather, main breaker open) simultaneously with agent discharge.",
    faultTypes: [],
  },

  // ── Lightning Down-Conductor ──
  {
    partId: "lightning_conductor",
    title: "Lightning Down-Conductor System",
    overview:
      "The lightning protection system (LPS) provides a low-impedance path from the blade tip receptors down through the hub, main shaft, and tower to the earthing system at seabed level. The model implements IEC 62305 Lightning Protection Level I (LPL I), rated for a peak current of 200 kA. Blade tips are fitted with metal receptors that intercept the majority of strikes. The conductor runs along the nacelle exterior to bypass sensitive drivetrain components.",
    standards: ["IEC 62305-1 (Lightning protection)", "IEC 62305-3 (Physical damage)", "IEC 61400-24 (Wind turbine lightning protection)"],
    formulas: [
      {
        expression: "U_{induced} = L_{loop}\u00B7di/dt",
        variables: [
          { symbol: "L_{loop}", name: "Loop inductance of protection circuit", unit: "H" },
          { symbol: "di/dt", name: "Rate of current rise", unit: "A/s" },
        ],
        explanation:
          "A lightning impulse has di/dt \u2248 200 kA / 10 \u03BCs = 2\u00D710\u00B9\u2070 A/s. Even 1 \u03BCH loop inductance induces 20 kV. This is why all electronics require surge protection devices (SPDs) at cable entries, and why the down-conductor is a dedicated low-inductance path separate from signal cables.",
      },
    ],
    design: {
      v236Value: "IEC 62305 LPL I (200 kA), 50 mm\u00B2 copper conductor, slip-ring discharge path, SPDs on all cable entries",
      reasoning:
        "Offshore Baltic turbines experience \u223C3\u20135 lightning strikes per turbine per year. LPL I provides a rolling sphere radius of 20 m, protecting the full blade swept area. The conductor bypasses the main bearings and the generator air gap via a dedicated brush/slip-ring path to prevent bearing current damage.",
      influencingFactors: ["Strike frequency (keraunic level, Baltic \u22483-5/km\u00B2/year)", "Blade receptor geometry", "Tower height (150 m \u2192 increased interception probability)", "IEC 61400-24 blade tip design"],
    },
    efficiencyNotes: [],
    simpleExplanation:
      "Wind turbines are very tall and often get struck by lightning. The down-conductor is a thick copper wire that gives the lightning a safe path to travel \u2014 from the blade tip, through the hub, down the tower, and into the sea \u2014 without damaging the main bearings or electronics.",
    technicalExplanation:
      "The IEC 61400-24 LPS design requires that all conductive parts within 3 m of the down-conductor are either bonded or maintained at >3 m separation. The main bearings and generator are bypassed using a carbon-brush slip ring assembly on the main shaft that provides a direct current path from the rotor hub to the bedplate earthing bar, avoiding bearing damage. SPDs (Type 1 + Type 2, 200 kA 10/350 \u03BCs waveshape) protect all data and power cables at the nacelle entry. The earthing electrode system at the monopile achieves <10 \u03A9 to remote earth per IEC 62305-3.",
    faultTypes: [],
  },
];

/** Lookup map for quick access by partId */
export const PART_EDUCATION_MAP: Record<TurbinePartId, TurbinePartEducation> =
  Object.fromEntries(TURBINE_PART_EDUCATION.map((p) => [p.partId, p])) as Record<TurbinePartId, TurbinePartEducation>;
