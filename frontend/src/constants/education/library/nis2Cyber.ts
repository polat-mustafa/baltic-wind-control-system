import type { EducationContent } from "../../../types/education";

export const nis2CyberEducation: EducationContent = {
  id: "library.nis2-cyber",
  title: "NIS2 & OT Cybersecurity",
  subtitle: "Securing the SCADA stack against state-actor threats",
  discipline: "Cyber",

  overview:
    "EU Directive 2022/2555 (NIS2) makes offshore wind operators 'essential entities' obliged to maintain a written " +
    "cybersecurity programme, report incidents to the national CSIRT within 24 h, and accept up to €10 M (or 2% global " +
    "turnover) penalties for non-compliance. The sector is high-value and attractive: ENISA's 2023 Threat Landscape " +
    "lists energy as the most-targeted vertical after public administration. The technical reference standard for OT is " +
    "IEC 62443, which divides the SCADA architecture into security zones connected by carefully audited conduits.",

  simpleExplanation:
    "Wind farms are now critical infrastructure. The EU has decided that anyone running one is legally responsible for " +
    "keeping it secure from cyber attack — and a successful attack could shut down a chunk of the national grid. NIS2 is " +
    "the law that says 'you must have a written cybersecurity plan, you must report incidents quickly, and if you don't, " +
    "you can be fined millions of euros'. The technical playbook for how to actually do it is called IEC 62443.",

  technicalExplanation:
    "Architecture: implement the Purdue Reference Model with explicit zone segregation — Level 0 (sensors/actuators), " +
    "Level 1 (control), Level 2 (supervisory), Level 3 (operations), Level 4 (enterprise IT). Conduits between zones use " +
    "hardware data diodes (one-way Level 3 → Level 4) or stateful firewalls with whitelist allow-rules. Achieve IEC " +
    "62443-3-3 Security Level 2 or 3 for OT zones (multi-factor authentication, signed firmware, timestamped audit logs, " +
    "anomaly-based intrusion detection). Vulnerability management: subscribe to vendor PSIRTs, run internal vuln scans " +
    "monthly, patch within 30 days for HIGH, 90 days for MEDIUM. Incident response: documented playbook for at least " +
    "ransomware, GOOSE injection, OPC-UA credential brute force, and rogue device on the WAN.",

  standards: [
    {
      label: "EU Directive 2022/2555 — NIS2",
      type: "regulation",
      url: "https://eur-lex.europa.eu/eli/dir/2022/2555",
    },
    {
      label: "IEC 62443 series — Industrial OT cybersecurity",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/IEC_62443",
    },
    {
      label: "IEC 62351 — Power systems data and communications security",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/IEC_62351",
    },
    {
      label: "ENISA Threat Landscape — annual EU cybersecurity threat report",
      type: "website",
      url: "https://www.enisa.europa.eu/topics/cyber-threats/threats-and-trends",
    },
  ],

  formulas: [
    {
      expression: "Risk = Likelihood · Impact",
      variables: [
        { symbol: "Risk", name: "Inherent risk score", unit: "—" },
        { symbol: "Likelihood", name: "Probability of threat actor success (0–5)", unit: "—" },
        { symbol: "Impact", name: "Operational + financial impact (0–5)", unit: "—" },
      ],
      explanation:
        "5×5 risk matrix used in IEC 62443-3-2 zone-and-conduit risk assessment. Mitigations are applied to reduce risk " +
        "into the green/amber band; residual risk in the red band requires escalation to executive management.",
    },
  ],

  workedExamples: [
    {
      title: "Risk score for an OPC-UA brute-force attack on Baltic Wind",
      scenario:
        "OPC-UA server at the OSS exposed to MFA-protected vendor remote access; vendor account uses 12-character " +
        "password but no MFA, last rotated 8 months ago.",
      steps: [
        "Likelihood: 3 (mid — credential is reachable but rate-limited)",
        "Impact: 4 (high — successful login allows turbine control commands)",
        "Inherent risk = 3 · 4 = 12 (red zone)",
        "Mitigation: enable hardware MFA on vendor account → likelihood drops to 1",
        "Residual risk = 1 · 4 = 4 (green zone)",
      ],
      result:
        "MFA enrolment moves the vendor account from red to green at near-zero cost. This is the highest-leverage NIS2 " +
        "control for any operator and should be prioritised before fancier defences.",
    },
  ],

  realWorldCases: [
    {
      title: "Vestas ransomware incident, November 2021",
      description:
        "Vestas IT systems were encrypted by a Conti-style ransomware actor. Operational SCADA was reportedly not " +
        "affected, but the line between IT and OT was tested. Response cost ~€100 M and a multi-month recovery.",
      takeaway:
        "The IT/OT boundary is the key control. Strong segregation lets you survive an IT incident without losing " +
        "generation. Air-gap is the gold standard but rarely practical; the next best is a Level-3 → Level-4 data diode.",
    },
    {
      title: "Industroyer2 / CrashOverride (2016 → 2022)",
      description:
        "Sandworm group's Industroyer malware was the first proven OT-targeted toolkit, used against the Ukrainian grid " +
        "in 2016 and a refined variant in 2022. It speaks IEC 60870-5-104 and IEC 61850 GOOSE natively.",
      takeaway:
        "Protocol-aware OT malware exists in the wild and targets exactly the standards offshore wind uses. Treat this as " +
        "the design basis threat for any SCADA deployment.",
    },
  ],

  furtherReading: [
    {
      label: "CISA — ICS advisories and industrial control systems security",
      type: "website",
      url: "https://www.cisa.gov/topics/industrial-control-systems",
    },
    {
      label: "CISA Industrial Control Systems Joint Working Group",
      type: "website",
      url: "https://www.cisa.gov/topics/industrial-control-systems",
    },
  ],

  relatedLessons: ["lesson-014"],
};
