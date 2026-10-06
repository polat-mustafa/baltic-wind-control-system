/**
 * First-energisation mission: put the key steps of the export system and
 * array energisation in order. Condensed from the 30-step switching
 * programme of P5 Commissioning (backend services/p5/switching_programme.py,
 * steps S-001 … S-030); the step ids below point back to it.
 *
 * The learner picks the next step from the remaining cards; a wrong pick is
 * a mistake and shows why that step cannot come yet. Score: the training
 * score of store/trainingStore (100 − 15 per mistake − 1 per 10 s over par).
 */

export interface SequenceStep {
  id: string;
  title: string;
  /** Programme steps this card stands for. */
  steps: string;
  /** Shown when the card is picked too early. */
  needs: string;
}

export const ENERGISATION: SequenceStep[] = [
  {
    id: "authorise",
    title: "Get the TSO dispatch authorisation; the person in charge declares the programme started",
    steps: "S-001 – S-002",
    needs: "Nothing is switched before the TSO (PSE) has authorised the energisation and the person in charge has started the programme.",
  },
  {
    id: "earths",
    title: "Remove the 220 kV earths and close the onshore disconnector",
    steps: "S-003 – S-008",
    needs: "The export circuit is still earthed: closing a breaker onto applied earths is a bolted fault. Earths come off first.",
  },
  {
    id: "export-cable",
    title: "Close the onshore 220 kV breaker: the export cable is live; watch its charging current",
    steps: "S-009 – S-012",
    needs: "The export cable is energised from the onshore end first, after the hold point; nothing offshore can be live before it.",
  },
  {
    id: "oss-220",
    title: "Close the OSS 220 kV disconnector and breaker: the offshore 220 kV busbar is live",
    steps: "S-013 – S-015",
    needs: "The OSS 220 kV busbar is fed through the export cable, so the cable has to be live and stable first.",
  },
  {
    id: "statcom",
    title: "Put the STATCOM in voltage control to absorb the cable charging power",
    steps: "S-016 – S-017",
    needs: "The STATCOM regulates the 220 kV busbar it is connected to; that busbar must be live before it can absorb the charging power.",
  },
  {
    id: "transformer",
    title: "Energise the OSS transformer from the 220 kV side; check the magnetising inrush",
    steps: "S-018 – S-019",
    needs: "The transformer is energised from a live, voltage-controlled 220 kV busbar — after the STATCOM holds the voltage.",
  },
  {
    id: "oss-66",
    title: "Remove the 66 kV busbar earth and close the transformer's 66 kV breaker",
    steps: "S-019A – S-022",
    needs: "The 66 kV busbar is fed by the transformer, so the transformer must be energised first.",
  },
  {
    id: "strings",
    title: "Remove the string earth, close the string feeder breaker, connect the turbines and ramp the power",
    steps: "S-022A – S-030",
    needs: "Array strings hang off the 66 kV busbar: it must be live and confirmed at the hold point first.",
  },
];

export const SEQUENCE_PAR_S = 120;
