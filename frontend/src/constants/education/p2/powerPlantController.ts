import type { EducationContent } from "../../../types/education";

export const powerPlantControllerEducation: EducationContent = {
  id: "p2.power-plant-controller",
  title: "Power Plant Controller — Dispatch, Frequency and Voltage Control",
  subtitle: "One controller that makes 34 turbines and a STATCOM behave like one power plant",
  discipline: "Control",

  overview:
    "The TSO does not talk to 34 turbines; it talks to the plant. The power plant controller (PPC) receives the " +
    "TSO's commands (active power set-point, reserve, limit, voltage or reactive set-point), measures at the " +
    "connection point and sends set-points to every turbine and the STATCOM. On top of the dispatch it runs the " +
    "plant's automatic grid support: frequency response (LFSM-O/U, FSM) and voltage control.",

  simpleExplanation:
    "Think of a conductor and an orchestra. The TSO asks for 'quieter' (less power) or 'support the voltage'; the PPC " +
    "tells each player how much to do so the whole plant responds smoothly — and reacts on its own when the grid " +
    "frequency or voltage moves.",

  technicalExplanation:
    "Active power: the dispatch target from the selected mode passes a ramp limiter (a plant setting agreed with " +
    "the TSO — PSE asks wind modules to be able to ramp 90–100 % P_max/min) and is shared pro-rata over the online " +
    "turbines. Frequency response is added after the limiter so it is never slowed down: LFSM-O above 50.2 Hz and " +
    "LFSM-U below 49.8 Hz with 5 % droop on P_max (PSE defaults); FSM around 50 Hz with a TSO-set deadband " +
    "(0–500 mHz) when a reserve is held (delta mode). LFSM-U and FSM-up need headroom — at full wind and no reserve " +
    "there is nothing to give. Reactive power: voltage control follows a slope Q = Q_max·(V_ref − V)/s with s = 2–7 " +
    "% (NC RfG 21(3)(d)); PSE requires 90 % of the Q change within 5 s and the final value within 60 s. The POC " +
    "voltage is modelled as the grid's Thevenin voltage plus (R·P + X·Q)/S_base, so a 10 GVA grid moves only ≈ 1 % " +
    "per 100 MVAR — reactive power changes the voltage, but a strong grid limits how much.",

  standards: [
    {
      label: "PSE — Wymogi ogólnego stosowania wynikające z NC RfG (18-12-2018), Art. 13(2), 15(2), 15(6)(e), 21(3)(d)",
      type: "regulation",
      url: "https://www.pse.pl/documents/20182/31216853/20181218_Wymogi_ogolnego_stosowania_OSP_i_OSD.pdf",
    },
    {
      label: "Commission Regulation (EU) 2016/631 — NC RfG Art. 13–15 (frequency), 21 (voltage control)",
      type: "regulation",
      url: "https://eur-lex.europa.eu/eli/reg/2016/631/oj",
    },
    { label: "IEC 61400-25 — Communications for monitoring and control of wind power plants", type: "standard" },
    { label: "IEC 60870-5-104 — Telecontrol over TCP/IP (TSO ↔ PPC set-points)", type: "standard" },
  ],

  formulas: [
    {
      expression: "LFSM-O: ΔP = −P_max · (f − 50.2) / (50 · s),   s = 5 %   →   204 MW/Hz for 510 MW",
      variables: [
        { symbol: "f", name: "Grid frequency", unit: "Hz" },
        { symbol: "s", name: "Droop (PSE default 5 %)", unit: "—" },
      ],
      explanation: "PSE: for power park modules P_ref = P_max. LFSM-U is the mirror image below 49.8 Hz.",
    },
    {
      expression: "Q = Q_max · (V_ref − V_POC) / s,   s = 2–7 %",
      variables: [
        { symbol: "Q_max", name: "Reactive power at the slope end (0.40 · P_max = 204 MVAR)", unit: "MVAR" },
        { symbol: "s", name: "Slope: voltage change for the full Q range", unit: "%" },
      ],
      explanation: "Voltage control as a droop — several plants share the regulation without fighting each other.",
    },
    {
      expression: "P_i = P_target · P_avail,i / Σ P_avail,j",
      variables: [{ symbol: "P_avail,i", name: "Available power of turbine i", unit: "MW" }],
      explanation: "Pro-rata dispatch: every turbine is curtailed by the same fraction of what it could produce.",
    },
  ],

  workedExamples: [
    {
      title: "Over-frequency at 50.5 Hz while the farm runs down to 300 MW",
      scenario: "Wind 12 m/s (510 MW available), TSO command 300 MW at t = 10 s, ramp limit 10 % P_max/min, frequency steps to 50.5 Hz at t = 60 s.",
      steps: [
        "Dispatch ramps at 51 MW/min: 510 → 300 MW takes ≈ 247 s — inside PSE's 15 min",
        "LFSM-O: ΔP = −510 × 0.3 / (50 × 0.05) = −61.2 MW, added on top of the dispatch at once",
        "30 s after the event the farm delivers −60.8 MW of frequency response (within 2 % P_max)",
      ],
      result: "Frequency response is not slowed by the dispatch ramp limit — the two are separate paths in the PPC.",
    },
    {
      title: "Grid voltage drops 3 %",
      scenario: "Voltage control, s = 4 %, Q_max = 204 MVAR, 10 GVA grid.",
      steps: [
        "Without a response V_POC would be 0.97 pu",
        "Q rises until Q = 204 × (1 − V)/0.04 and V = V_grid + X·Q/100 agree: ≈ +104 MVAR, V ≈ 0.98 pu",
        "90 % of the Q change is reached in ≈ 2.4 s (PSE limit 5 s)",
      ],
      result: "The plant recovers about a third of the dip — the rest is the grid's to fix, as the slope intends.",
    },
  ],

  realWorldCases: [
    {
      title: "Hornsea One, 9 August 2019: plant control under a grid fault",
      description:
        "After a transmission fault the onshore control system behaved as designed, but the offshore turbine controllers reacted incorrectly to voltage fluctuations on the offshore network; the instability between them shut down two modules and the farm deloaded from 799 MW to 62 MW. A software update was installed the next day.",
      takeaway: "The PPC and the turbine controllers form one control loop — its stability at full output and on weak grid conditions has to be proven, not assumed.",
      source: "Ofgem, 9 August 2019 power outage report (January 2020)",
    },
  ],

  furtherReading: [
    {
      label: "T. Ackermann (ed.) — Wind Power in Power Systems, 2nd ed.",
      type: "textbook",
      citation: "Wiley, 2012",
    },
  ],

  codeReferences: [
    {
      file: "backend/app/services/p2/power_plant_controller.py",
      description: "Ramp limiter, LFSM/FSM, slope voltage control, POC Thevenin model, PSE checks.",
    },
  ],
};
