import type { EducationContent } from "../../../types/education";

export const n1SecurityEducation: EducationContent = {
  id: "p2.n1-security",
  title: "N-1 Security of the Export System",
  subtitle: "Which single outage the farm rides through, and which needs a runback",
  discipline: "Electrical",

  overview:
    "The N-1 criterion asks: after the loss of any one element, does everything left stay within its limits? " +
    "For an offshore wind farm the elements are the array string feeders, the export circuits and the transformers. " +
    "Each outage is solved here as an AC load flow with the controls that act within seconds — the STATCOM " +
    "re-dispatching reactive power and the reactor intertrip — and, where a limit is still exceeded, the power " +
    "plant controller running the turbines back.",

  simpleExplanation:
    "Two export cables and two transformers per stage share the 510 MW. Lose one, and the other suddenly carries " +
    "everything: about 140–170 % of its rating. It does not fail at once — it heats up over hours — so the turbines " +
    "have time to turn down to what one cable or one transformer can carry. Losing a string is easy: that power is " +
    "simply gone and the rest of the network has less to carry.",

  technicalExplanation:
    "Preventive security means the pre-outage dispatch is already safe for every contingency; corrective security " +
    "allows a remedial action after the outage. For this farm, preventive security against an export-circuit or " +
    "transformer outage would cap the output at about 300 MW permanently. Corrective security keeps the full 510 MW " +
    "and accepts a runback of about 170–210 MW, which the PPC executes in seconds — far inside the thermal time " +
    "constants of cables (hours) and transformers (IEC 60076-7). Because the farm's marginal cost is zero and the " +
    "network is radial, an optimal power flow has nothing to trade: it reproduces this result. The binding " +
    "constraints are the N-1 thermal limits, not cost. The reactor intertrip matters for voltage: without it, " +
    "240 MVAR of shunt reactors would face only one cable's ~130 MVAR of charging.",

  standards: [
    { label: "Commission Regulation (EU) 2017/1485 (SO GL) — (N-1) criterion, contingency list, remedial actions", type: "regulation" },
    { label: "IEC 60076-7 — Loading guide for mineral-oil-immersed power transformers", type: "standard" },
  ],

  formulas: [
    {
      expression: "Firm output = min over k of P_after,k",
      variables: [{ symbol: "P_after,k", name: "Output after the runback for contingency k", unit: "MW" }],
      explanation: "The highest output that every listed outage leaves within limits without any action.",
    },
    {
      expression: "t_runback = ΔP / ramp",
      variables: [
        { symbol: "ΔP", name: "Runback", unit: "MW" },
        { symbol: "ramp", name: "Runback rate (assumed 2 % Pn/s = 10.2 MW/s)", unit: "MW/s" },
      ],
      explanation: "Seconds of overload against thermal time constants of hours.",
    },
  ],

  workedExamples: [
    {
      title: "Losing one export circuit at full output",
      scenario: "510 MW, both 220 kV circuits in service, one trips.",
      steps: [
        "The survivor (~362 MVA) is loaded to ~143 %, and its reactor partner is intertripped",
        "The STATCOM re-dispatches reactive power and holds the OSS voltage",
        "The PPC runs the turbines back by ~167 MW to ~343 MW: 100 % loading, ~16 s at 10.2 MW/s",
      ],
      result: "Secure with a corrective runback; preventive security would have cost ~170 MW all the time.",
    },
  ],

  realWorldCases: [],

  furtherReading: [
    {
      label: "F. Capitanescu et al., State-of-the-art, challenges, and future trends in security constrained optimal power flow",
      type: "paper",
      citation: "Electric Power Systems Research 81 (2011) 1731–1741",
    },
  ],

  codeReferences: [
    { file: "backend/app/services/p2/n1_security.py", description: "Contingency list, STATCOM re-dispatch, runback by bisection." },
  ],
};
