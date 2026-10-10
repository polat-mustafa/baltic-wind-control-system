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
    "everything: about 170 % of its rating. It does not fail at once — it heats up over hours — so the turbines " +
    "have time to turn down to what one cable or one transformer can carry. Losing a string is easy: that power is " +
    "simply gone and the rest of the network has less to carry.",

  technicalExplanation:
    "Preventive security means the pre-outage dispatch is already safe for every contingency; corrective security " +
    "allows a remedial action after the outage. For this farm, preventive security against an export-circuit or " +
    "transformer outage would cap the output at about 280 MW permanently. Corrective security keeps the full 510 MW " +
    "and accepts a runback of about 210–230 MW, which the PPC executes in seconds — far inside the thermal time " +
    "constants of cables (hours) and transformers (IEC 60076-7). Because the farm's marginal cost is zero and the " +
    "network is radial, an optimal power flow has nothing to trade: it reproduces this result. The binding " +
    "constraints are the N-1 thermal limits, not cost. The reactor intertrip matters for voltage: without it, " +
    "the tripped cable's two 180 MVAR reactors (onshore and OSS) would stay in service against no charging at all, " +
    "so protection trips them with the cable.",

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
        "The survivor (√3 × 220 kV × 825 A ≈ 314 MVA, ABB/NKT datasheet) is loaded to ~174 % (its own 108 km of charging current adds to the load current); the tripped cable's two reactors are intertripped",
        "The STATCOM re-dispatches reactive power and holds the OSS voltage",
        "The PPC runs the turbines back by ~231 MW to ~279 MW: 99.5 % loading, ~23 s at 10.2 MW/s",
      ],
      result: "Secure with a corrective runback; preventive security would have cost ~230 MW all the time.",
    },
  ],

  realWorldCases: [
    {
      title: "Gwynt y Môr (UK): five months on fewer export cables",
      description:
        "An export cable fault took one circuit of the Gwynt y Môr connection out from 15 October 2020 until 7 March 2021; Ofgem treated it as an income-adjusting event for the transmission owner.",
      takeaway: "Subsea cable repairs take months, so the loss of one export circuit is a planning case, not a rare event.",
      source: "Ofgem determination; newpower.info (2021)",
    },
    {
      title: "Rentel (Belgium, 2024): a meshed offshore grid",
      description:
        "When Rentel's export cable failed, repair took about four months, but the farm kept producing through Elia's Modular Offshore Grid with its output slightly capped in high winds.",
      takeaway: "A second path for the power turns an export cable fault from a full outage into a curtailment.",
      source: "Elia press release, 28 May 2024",
    },
  ],

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
