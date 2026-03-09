/**
 * Educational content for the 12 clickable parts of the V236-15.0 MW
 * turbine cross-section diagram.
 *
 * Each entry provides:
 * - Plain-language overview for non-engineers
 * - Key formulas from backend turbine_physics services
 * - V236-specific design rationale
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
  | "gearbox"
  | "generator"
  | "converter"
  | "cooler"
  | "anemometer"
  | "yaw"
  | "tower"
  | "foundation"
  | "nacelle"
  | "wind"
  | "power_output";

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
  GEARBOX_OIL_TEMP: "gearbox",
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
      "Three 115.5 m carbon-fibre/glass-fibre blades capture kinetic energy from the wind. They are the largest rotating components in the turbine, sweeping a rotor area of 43,742 m\u00B2. Blade pitch is actively controlled to regulate power and protect the turbine in high winds.",
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
          "The theoretical maximum fraction of wind energy that any rotor can extract. Real turbines achieve C\u209A \u2248 0.45\u20130.48 at rated conditions due to tip losses, drag, and wake rotation.",
      },
    ],
    design: {
      v236Value: "3 \u00D7 115.5 m blades, 236 m rotor diameter",
      reasoning:
        "Longer blades sweep more area, increasing energy capture at low wind speeds. Carbon-fibre spar caps reduce weight while maintaining stiffness for the extreme blade length.",
      influencingFactors: ["Wind regime", "Tip speed constraint (<80 m/s)", "Blade mass vs. fatigue loads", "Manufacturing logistics"],
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
          "The hub sums the individual blade contributions. At rated power (15 MW, ~7.8 rpm), total torque reaches approximately 18,350 kN\u00B7m.",
      },
    ],
    design: {
      v236Value: "Spherical cast-iron hub, ~70 tonnes",
      reasoning:
        "Cast ductile iron provides the complex geometry needed for three blade-root flanges plus pitch bearing interfaces while withstanding extreme bending moments.",
      influencingFactors: ["Blade root bending moments", "Pitch bearing integration", "Ice loading", "Hub-height wind shear"],
    },
    efficiencyNotes: [],
    simpleExplanation:
      "The hub is like the center of a bicycle wheel \u2014 it's the part where all the spokes (blades) connect and spin together.",
    technicalExplanation:
      "The hub is a rigid cast-iron structure transmitting asymmetric aerodynamic loads from three independent blade roots into the main shaft bearing system. It integrates individual pitch drives (hydraulic cylinders with accumulator backup) that enable blade-specific pitch control for load mitigation.",
    faultTypes: ["PITCH_CONTROL_FAULT", "HYDRAULIC_PRESSURE_LOW"],
  },

  // ── Shaft ──
  {
    partId: "shaft",
    title: "Main Shaft (Low-Speed)",
    overview:
      "The main shaft is a forged steel component that transmits the rotor torque from the hub through the main bearing into the gearbox. It rotates slowly (5\u20139.55 rpm) under enormous torque.",
    standards: ["IEC 61400-4", "DIN 743"],
    formulas: [
      {
        expression: "P\u2098\u2091\u2092\u2095 = Q \u00B7 \u03C9",
        variables: [
          { symbol: "Q", name: "Shaft torque", unit: "N\u00B7m" },
          { symbol: "\u03C9", name: "Angular velocity", unit: "rad/s" },
          { symbol: "P\u2098\u2091\u2092\u2095", name: "Mechanical power", unit: "W" },
        ],
        explanation:
          "Mechanical power is the product of torque and angular velocity. At rated conditions: Q \u2248 18,350 kN\u00B7m, \u03C9 = 9.55 rpm \u00D7 2\u03C0/60 \u2248 1.0 rad/s, giving P \u2248 18.35 MW aerodynamic (before losses).",
      },
    ],
    design: {
      v236Value: "Forged alloy steel, ~400 mm diameter, hollow bore",
      reasoning:
        "Hollow design reduces weight while maintaining torsional stiffness. The shaft must withstand extreme torque reversals during emergency stops and grid faults.",
      influencingFactors: ["Rated torque", "Fatigue life (25 years)", "Torsional resonance", "Emergency stop loads"],
    },
    efficiencyNotes: [
      { name: "Torsional friction", typicalLossPct: "~0.1%", dissipation: "Internal material hysteresis" },
    ],
    simpleExplanation:
      "Like the axle of a car wheel, the main shaft carries the spinning motion from the blades into the gearbox. It spins slowly but with tremendous force.",
    technicalExplanation:
      "The low-speed shaft is a forged, heat-treated alloy steel component designed per DIN 743 for infinite fatigue life. It transmits rotor torque of up to 18,350 kN\u00B7m at rated speed, with critical design cases including emergency-stop transients and short-circuit torques from generator faults.",
    faultTypes: [],
  },

  // ── Main Bearing ──
  {
    partId: "bearing",
    title: "Main Bearing",
    overview:
      "The main bearing supports the entire 60+ tonne rotor assembly and allows it to spin freely. It must handle massive radial and axial loads from wind thrust while lasting 25+ years. Bearing temperature and vibration are critical health indicators.",
    standards: ["ISO 281", "ISO 10816", "ISO 15243"],
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
          "ISO 281 bearing life formula. The L\u2081\u2080 life is the number of hours at which 90% of identical bearings will survive. For a 25-year design life at 9.55 rpm, the target is >175,000 hours.",
      },
      {
        expression: "Vibration thresholds: Zone A < 2.8, B < 4.5, C < 7.1, D \u2265 7.1 mm/s",
        variables: [],
        explanation:
          "ISO 10816 vibration severity zones for large rotating machinery. Zone C (4.5\u20137.1 mm/s) triggers a warning alarm; Zone D (\u22657.1 mm/s) requires shutdown.",
      },
    ],
    design: {
      v236Value: "Single spherical roller bearing, ~1.8 m bore diameter",
      reasoning:
        "Spherical roller bearings tolerate angular misalignment from shaft deflection and handle combined radial + axial loads from rotor weight and wind thrust.",
      influencingFactors: ["Rotor weight (60+ tonnes)", "Axial wind thrust", "Lubrication quality", "Temperature cycling"],
    },
    efficiencyNotes: [
      { name: "Friction torque", typicalLossPct: "~0.3%", dissipation: "Heat in bearing oil (cooled via circulation system)" },
    ],
    simpleExplanation:
      "The main bearing is like the bearing in a bicycle wheel hub \u2014 it lets the heavy rotor spin smoothly. If it gets too hot or vibrates too much, it's a sign of trouble, like a squeaky wheel.",
    technicalExplanation:
      "A double-row spherical roller bearing rated per ISO 281 with modified life factors (a\u2081\u2082\u2083) for contamination, lubrication viscosity ratio, and load pattern. The bearing health monitoring system tracks vibration (ISO 10816 velocity RMS) and temperature to predict remaining useful life via condition-based maintenance algorithms.",
    faultTypes: ["BEARING_OVERTEMP", "VIBRATION_ALARM"],
  },

  // ── Gearbox ──
  {
    partId: "gearbox",
    title: "Gearbox",
    overview:
      "The gearbox converts the slow, high-torque rotation from the rotor (5\u20139.55 rpm) into fast rotation suitable for the generator (~344 rpm). The V236 uses a 36:1 gear ratio through a three-stage planetary/helical design.",
    standards: ["IEC 61400-4", "ISO 6336", "AGMA 6006"],
    formulas: [
      {
        expression: "\u03C9\u2091\u2091\u2099 = \u03C9\u2063\u2092\u209C\u2092\u2063 \u00D7 i",
        variables: [
          { symbol: "\u03C9\u2063\u2092\u209C\u2092\u2063", name: "Rotor speed", unit: "rpm" },
          { symbol: "i", name: "Gear ratio", unit: "dimensionless" },
          { symbol: "\u03C9\u2091\u2091\u2099", name: "Generator speed", unit: "rpm" },
        ],
        explanation:
          "The gear ratio multiplies rotational speed. At rated: 9.55 rpm \u00D7 36 = 343.8 rpm on the generator side. Torque is inversely reduced by the same ratio.",
      },
      {
        expression: "\u03B7\u2091\u2091\u2090\u2063 \u2248 97\u201398%",
        variables: [],
        explanation:
          "Each gear stage introduces ~1% loss through tooth contact friction, churning, and windage. A three-stage gearbox achieves ~97% overall efficiency.",
      },
    ],
    design: {
      v236Value: "Three-stage (1 planetary + 2 helical), 36:1 ratio, forced oil lubrication",
      reasoning:
        "Planetary first stage handles the extreme low-speed torque in a compact package. Helical stages provide quiet, efficient speed multiplication for the final ratio.",
      influencingFactors: ["Input torque (18,350 kN\u00B7m)", "Oil temperature", "Gear tooth wear", "Alignment precision"],
    },
    efficiencyNotes: [
      { name: "Gear mesh losses", typicalLossPct: "~2%", dissipation: "Heat in gear oil (oil cooler)" },
      { name: "Churning/windage", typicalLossPct: "~1%", dissipation: "Oil splash and air resistance" },
    ],
    simpleExplanation:
      "Like a bicycle gear system \u2014 the blades spin slowly with lots of force, and the gearbox converts that into fast spinning for the generator. The '36:1' means the generator shaft spins 36 times faster than the rotor.",
    technicalExplanation:
      "A three-stage gearbox (1P+2H) rated per IEC 61400-4 and ISO 6336. The planetary stage absorbs full rotor torque via a ring gear, sun gear, and planet carrier. Oil temperature monitoring detects lubrication degradation; particle counters in the oil circuit provide early warning of gear tooth pitting.",
    faultTypes: ["GEARBOX_OIL_TEMP"],
  },

  // ── Generator ──
  {
    partId: "generator",
    title: "Generator (PMSG)",
    overview:
      "The Permanent Magnet Synchronous Generator converts the gearbox's mechanical rotation into electrical energy. PMSG technology uses permanent magnets instead of electromagnets, achieving higher efficiency (97.5%) and eliminating the need for slip rings.",
    standards: ["IEC 60034", "IEC 61400-21", "IEC 60034-18-41"],
    formulas: [
      {
        expression: "P\u2091\u2097\u2091\u2092 = P\u2098\u2091\u2092\u2095 \u00D7 \u03B7\u2091\u2091\u2090\u2063 \u00D7 \u03B7\u2091\u2091\u2099",
        variables: [
          { symbol: "P\u2098\u2091\u2092\u2095", name: "Mechanical power", unit: "MW" },
          { symbol: "\u03B7\u2091\u2091\u2090\u2063", name: "Gearbox efficiency", unit: "~0.97" },
          { symbol: "\u03B7\u2091\u2091\u2099", name: "Generator efficiency", unit: "~0.975" },
          { symbol: "P\u2091\u2097\u2091\u2092", name: "Electrical power", unit: "MW" },
        ],
        explanation:
          "Electrical output is mechanical input multiplied by the efficiencies of the gearbox and generator in series. At 15 MW aerodynamic input: 15 \u00D7 0.97 \u00D7 0.975 \u2248 14.19 MW electrical.",
      },
    ],
    design: {
      v236Value: "15 MW PMSG, variable speed via full-scale converter",
      reasoning:
        "PMSG eliminates rotor windings and slip rings, reducing maintenance. Combined with full-scale converter, it enables wide speed range (5\u20139.55 rpm rotor) and full reactive power control.",
      influencingFactors: ["Winding temperature", "Rare earth magnet supply", "Cooling system", "Insulation class (F/H)"],
    },
    efficiencyNotes: [
      { name: "Copper losses (I\u00B2R)", typicalLossPct: "~1.5%", dissipation: "Heat in stator windings" },
      { name: "Iron losses", typicalLossPct: "~0.8%", dissipation: "Eddy currents and hysteresis in core" },
      { name: "Mechanical losses", typicalLossPct: "~0.2%", dissipation: "Bearing friction and windage" },
    ],
    simpleExplanation:
      "The generator is like a dynamo on a bicycle light \u2014 when it spins, it produces electricity. The faster it spins and the stronger its magnets, the more electricity it makes.",
    technicalExplanation:
      "A permanent-magnet synchronous machine rated per IEC 60034 with Class H insulation. The PMSG produces variable-frequency AC proportional to rotor speed, rectified by the machine-side converter. Winding temperature is the primary life-limiting factor \u2014 every 10\u00B0C above rated halves insulation life per Arrhenius.",
    faultTypes: ["GENERATOR_WINDING_TEMP"],
  },

  // ── Converter ──
  {
    partId: "converter",
    title: "Power Converter",
    overview:
      "The full-scale power converter converts the generator's variable-frequency AC into grid-compatible fixed-frequency AC (50 Hz). It consists of a machine-side rectifier (AC\u2192DC), DC link, and grid-side inverter (DC\u2192AC), enabling full control of active and reactive power. The converter output (690 V) feeds into the turbine's step-up transformer (690 V \u2192 66 kV) before connecting to the array cable. Transformer losses are typically ~0.5% (copper + iron losses), governed by the turns ratio N\u2082/N\u2081 = V\u2082/V\u2081 = 66,000/690 \u2248 95.7:1.",
    standards: ["ENTSO-E NC RfG Type D", "PSE IRiESP", "IEC 61400-21"],
    formulas: [
      {
        expression: "P\u2091\u2063\u2092\u209A = P\u2091\u2091\u2099 \u00D7 \u03B7\u2092\u2092\u2099\u1D65",
        variables: [
          { symbol: "P\u2091\u2091\u2099", name: "Generator output", unit: "MW" },
          { symbol: "\u03B7\u2092\u2092\u2099\u1D65", name: "Converter efficiency", unit: "~0.98" },
          { symbol: "P\u2091\u2063\u2092\u209A", name: "Power to grid", unit: "MW" },
        ],
        explanation:
          "The converter adds ~2% loss from IGBT switching and conduction losses. At rated: 14.19 MW \u00D7 0.98 \u2248 13.91 MW to the 66 kV array cable.",
      },
    ],
    design: {
      v236Value: "Full-scale AC/DC/AC, IGBT-based, 690 V generator / 66 kV grid",
      reasoning:
        "Full-scale converter decouples the generator entirely from the grid, enabling FRT compliance and full reactive power control without additional STATCOM at turbine level.",
      influencingFactors: ["IGBT junction temperature", "Cooling system", "DC link voltage", "Grid fault duration"],
    },
    efficiencyNotes: [
      { name: "Switching losses", typicalLossPct: "~1.2%", dissipation: "Heat in IGBT modules (liquid cooled)" },
      { name: "Conduction losses", typicalLossPct: "~0.8%", dissipation: "Resistive heat in power semiconductors" },
      { name: "Transformer losses (690V→66kV)", typicalLossPct: "~0.5%", dissipation: "Copper (I²R) + iron (hysteresis/eddy) losses in step-up transformer" },
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
      v236Value: "Electric yaw with 4 motors, \u00B18\u00B0 deadband, ~0.5\u00B0/s yaw rate",
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
          "The tower's first natural frequency must fall between 1P and 3P (soft-stiff design) to avoid resonance. For V236: 1P = 0.08\u20130.16 Hz, 3P = 0.24\u20130.48 Hz, target f\u2081 \u2248 0.18 Hz.",
      },
    ],
    design: {
      v236Value: "150 m hub height, tapered tubular steel, ~5 m base diameter",
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
      v236Value: "Monopile, 8\u201310 m OD, ~30 m embedment depth, ~1,500 tonnes",
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
      v236Value: "GRP (glass-reinforced polymer) enclosure, climate-controlled, ~20 m long",
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
      "A weatherproof GRP enclosure housing all nacelle-mounted equipment with IEC 61850 communication via fiber optic to the tower-base SCADA cabinet. Condition monitoring system (CMS) per ISO 10816 and ISO 13373 continuously monitors vibration, temperature, and oil quality across all drivetrain components.",
    faultTypes: ["COMMUNICATION_LOSS"],
  },

  // ── Wind (incoming flow) ──
  {
    partId: "wind",
    title: "Incoming Wind",
    overview:
      "Wind is the primary energy source. The turbine operates between cut-in (3 m/s) and cut-out (31 m/s) wind speeds, with rated power at 12.5 m/s. Wind speed follows a Weibull distribution, and hub-height speed is estimated from surface measurements using the power law. Downstream turbines experience a wake deficit — reduced wind speed and increased turbulence — which can cut power by 8–12% at farm level (see the wake cone visualization below the cross-section).",
    standards: ["IEC 61400-12-1", "IEC 61400-1 Annex B", "IEC 61400-12-2"],
    formulas: [
      {
        expression: "P\u2090\u1D65\u2090\u1D62\u2097 = \u00BD \u00D7 \u03C1 \u00D7 A \u00D7 V\u00B3",
        variables: [
          { symbol: "\u03C1", name: "Air density", unit: "kg/m\u00B3 (~1.225 at sea level)" },
          { symbol: "A", name: "Swept area", unit: "m\u00B2 (43,742 for V236)" },
          { symbol: "V", name: "Wind speed", unit: "m/s" },
        ],
        explanation:
          "Available power in the wind before any extraction. At 12.5 m/s: P = 0.5 \u00D7 1.225 \u00D7 43,742 \u00D7 12.5\u00B3 \u2248 52.3 MW available, from which the turbine extracts ~15 MW (C\u209A \u2248 0.287 at rated).",
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
      v236Value: "Cut-in 3 m/s, rated 12.5 m/s, cut-out 31 m/s",
      reasoning:
        "The wide operating range maximizes annual energy production. The high cut-out speed (31 m/s vs. typical 25 m/s) is enabled by the V236's advanced storm control strategy.",
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
    title: "Mechanical Brake",
    overview:
      "A hydraulic disc brake mounted on the high-speed shaft between the main bearing and gearbox. It is a fail-safe parking brake — spring-applied, hydraulically released — used to lock the rotor during maintenance or emergency stops. It is NOT used for normal power regulation (that's blade pitch).",
    standards: ["IEC 61400-1 §8.7", "IEC 61400-3-1", "DNV-ST-0361"],
    formulas: [
      {
        expression: "T_brake = μ · F_clamp · r_disc · n_pads",
        variables: [
          { symbol: "μ", name: "Friction coefficient", unit: "~0.35–0.45" },
          { symbol: "F_clamp", name: "Clamping force per caliper", unit: "kN" },
          { symbol: "r_disc", name: "Effective disc radius", unit: "m" },
          { symbol: "n_pads", name: "Number of friction pads", unit: "dimensionless" },
        ],
        explanation:
          "Braking torque must exceed maximum aerodynamic torque at any wind speed. For the V236 with ~18,350 kN·m rated torque (low-speed side), the high-speed brake needs only ~510 kN·m (÷36 gear ratio), but is sized with a safety factor of 1.5–2.0.",
      },
    ],
    design: {
      v236Value: "Hydraulic disc brake, ~2 m disc diameter, fail-safe (spring-applied)",
      reasoning:
        "Spring-applied design ensures the rotor is locked if hydraulic pressure is lost (fail-safe). The brake is only engaged at low rotor speeds — the primary braking method is aerodynamic (blade pitch to feather).",
      influencingFactors: ["Emergency stop loads", "Pad wear rate", "Hydraulic system reliability", "Disc thermal capacity"],
    },
    efficiencyNotes: [],
    simpleExplanation:
      "Think of the brake like a bicycle disc brake — it clamps down on a spinning disc to stop the rotor. But unlike a bike, this brake is only for parking and emergencies. Normal slowing is done by tilting the blades.",
    technicalExplanation:
      "A hydraulically-released, spring-applied disc brake on the high-speed shaft provides fail-safe rotor locking per IEC 61400-1 §8.7. The brake is engaged only after aerodynamic braking (pitch-to-feather) reduces rotor speed below the threshold (~2 rpm). Thermal capacity of the disc limits consecutive emergency stop cycles.",
    faultTypes: [],
  },

  // ── Cooler ──
  {
    partId: "cooler",
    title: "Cooling System",
    overview:
      "A top-mounted passive/forced-air radiator assembly that dissipates heat from three independent cooling loops: gearbox oil, generator liquid coolant, and converter liquid coolant. Effective cooling is critical — every 10°C above rated halves component insulation life.",
    standards: ["IEC 61400-1", "ISO 4548", "IEC 60076-7"],
    formulas: [
      {
        expression: "Q_cool = ṁ · cₚ · ΔT",
        variables: [
          { symbol: "ṁ", name: "Coolant mass flow rate", unit: "kg/s" },
          { symbol: "cₚ", name: "Specific heat capacity", unit: "J/(kg·K)" },
          { symbol: "ΔT", name: "Temperature rise across component", unit: "K" },
        ],
        explanation:
          "Heat removal rate equals mass flow × heat capacity × temperature difference. At rated power, total drivetrain losses are ~450 kW (3% of 15 MW), all of which must be dissipated by the cooling system.",
      },
    ],
    design: {
      v236Value: "Top-mounted radiator bank, 3 independent loops, forced-air fans",
      reasoning:
        "Separating gearbox oil, generator, and converter cooling prevents cross-contamination and allows independent temperature control. Top-mounting exploits natural convection and nacelle airflow.",
      influencingFactors: ["Ambient temperature", "Fan power consumption", "Coolant degradation", "Salt spray corrosion"],
    },
    efficiencyNotes: [
      { name: "Cooling fan parasitic", typicalLossPct: "~0.15%", dissipation: "Electrical consumption of radiator fans" },
    ],
    simpleExplanation:
      "Like the radiator in a car, the cooling system pumps liquid through hot components (gearbox, generator, converter) and blows air over the heated liquid to cool it down. Without it, the turbine would overheat and shut down.",
    technicalExplanation:
      "A forced-convection radiator assembly with three independent liquid cooling circuits. Gearbox oil cooling maintains viscosity for proper gear lubrication (ISO VG 320). Generator and converter cooling maintains insulation and semiconductor junction temperatures within rated limits. Offshore designs use corrosion-resistant heat exchangers rated for marine salt spray environments.",
    faultTypes: ["GEARBOX_OIL_TEMP", "GENERATOR_WINDING_TEMP", "CONVERTER_OVERTEMP"],
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
    title: "Power Output (End-to-End)",
    overview:
      "The displayed power output is the net electrical power delivered to the 66 kV array cable after all conversion losses. It represents the end product of the entire energy conversion chain: wind kinetic energy → rotor mechanical energy → gearbox → generator electrical energy → converter → transformer → grid.",
    standards: ["IEC 61400-12-1", "IEC 61400-26-1", "ENTSO-E NC RfG"],
    formulas: [
      {
        expression: "P_grid = ½ρAV³ · Cₚ · η_gear · η_gen · η_conv · η_trafo",
        variables: [
          { symbol: "½ρAV³", name: "Available wind power", unit: "MW" },
          { symbol: "Cₚ", name: "Power coefficient (Betz limit max 0.593)", unit: "~0.45" },
          { symbol: "η_gear", name: "Gearbox efficiency", unit: "~0.97" },
          { symbol: "η_gen", name: "Generator efficiency", unit: "~0.975" },
          { symbol: "η_conv", name: "Converter efficiency", unit: "~0.98" },
          { symbol: "η_trafo", name: "Transformer efficiency", unit: "~0.995" },
          { symbol: "P_grid", name: "Net power to 66 kV cable", unit: "MW" },
        ],
        explanation:
          "Each stage multiplies efficiency: 0.45 × 0.97 × 0.975 × 0.98 × 0.995 ≈ 0.414. From ~36 MW available wind power at rated speed (12.5 m/s), ~15 MW reaches the grid — a chain efficiency of ~42%.",
      },
    ],
    design: {
      v236Value: "15.0 MW rated output, ~42% overall chain efficiency at rated wind",
      reasoning:
        "The rated power of 15.0 MW is the maximum continuous net electrical output. Below rated wind speed, the turbine operates at variable speed to maximize Cₚ. Above rated, pitch control limits power to 15.0 MW to protect the drivetrain.",
      influencingFactors: ["Wind speed", "Air density", "Component degradation", "Grid curtailment", "Ambient temperature"],
    },
    efficiencyNotes: [
      { name: "Aerodynamic extraction (Cₚ)", typicalLossPct: "~55%", dissipation: "Betz limit + tip/profile losses" },
      { name: "Gearbox losses", typicalLossPct: "~3%", dissipation: "Gear mesh friction, churning, windage" },
      { name: "Generator losses", typicalLossPct: "~2.5%", dissipation: "Copper (I²R) + iron + mechanical" },
      { name: "Converter losses", typicalLossPct: "~2%", dissipation: "IGBT switching + conduction" },
      { name: "Transformer losses", typicalLossPct: "~0.5%", dissipation: "Copper + iron in step-up transformer" },
    ],
    simpleExplanation:
      "The number displayed above the turbine is how much electricity it's actually sending to the power grid right now. Only about 42% of the wind's energy makes it through the whole machine — but that's actually very good engineering!",
    technicalExplanation:
      "Net active power output measured at the 66 kV array cable terminals per IEC 61400-12-1. The end-to-end conversion efficiency of ~42% at rated conditions reflects the thermodynamic Betz limit (~59.3%) combined with mechanical, electrical, and magnetic losses across five conversion stages. Power performance is continuously monitored against the warranted power curve for degradation detection.",
    faultTypes: ["GRID_FREQUENCY_FAULT", "CONVERTER_OVERTEMP"],
  },
];

/** Lookup map for quick access by partId */
export const PART_EDUCATION_MAP: Record<TurbinePartId, TurbinePartEducation> =
  Object.fromEntries(TURBINE_PART_EDUCATION.map((p) => [p.partId, p])) as Record<TurbinePartId, TurbinePartEducation>;
