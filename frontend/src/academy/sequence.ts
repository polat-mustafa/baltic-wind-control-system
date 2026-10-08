/**
 * First-energisation mission: put the key stages of the circuit 1 energisation
 * in order. Condensed from the 63-step switching programme of HV Commissioning
 * (backend services/p5/switching_programme.py, steps 1.01 … 6.03); the step
 * ids below point back to it.
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
    title: "Cancel all permits, confirm the SAT is approved and PSE has issued the EON; PiC gives GO",
    steps: "1.01 – 1.07",
    needs: "Nothing is switched while anyone may still be working on the circuit, before the site acceptance tests have passed and before PSE's energisation notification (EON, NC RfG Art. 34).",
  },
  {
    id: "earths",
    title: "Release the locks, open both cable earth switches, connect the onshore line reactor to the dead cable and close the onshore disconnector",
    steps: "2.01 – 2.10",
    needs: "The export cable is still earthed at both ends: closing a breaker onto an earth — even one 76.5 km away at the OSS — is a bolted fault. Earths come off first.",
  },
  {
    id: "export-cable",
    title: "Close the onshore 220 kV breaker: the cable and its line reactor are live, OSS end open — check charging current, onshore voltage and Ferranti rise, then soak",
    steps: "2.11 – 2.14",
    needs: "The export cable is energised from the onshore end, after its earths are removed; nothing offshore can be live before it.",
  },
  {
    id: "oss-220",
    title: "Remove the OSS busbar earth, close the OSS disconnector and breaker: the offshore 220 kV busbar is live",
    steps: "3.01 – 3.06",
    needs: "The OSS 220 kV busbar is fed through the export cable, so the cable has to be live and soaked first.",
  },
  {
    id: "reactive",
    title: "Put the STATCOM in voltage control, then switch in OSS reactor 1",
    steps: "3.07 – 3.14",
    needs: "The STATCOM and the OSS reactor are connected to the OSS 220 kV busbar; it must be live before they can absorb the cable's charging power.",
  },
  {
    id: "transformer",
    title: "Energise TX-OSS-01 from the 220 kV side; check the no-load current",
    steps: "4.01 – 4.04",
    needs: "The transformer is energised from a live, voltage-controlled 220 kV busbar — after the reactor and STATCOM hold the voltage.",
  },
  {
    id: "oss-66",
    title: "Remove the 66 kV section A earth and close TX-OSS-01's 66 kV breaker",
    steps: "4.05 – 4.09",
    needs: "66 kV section A is fed by TX-OSS-01, so the transformer must be energised first.",
  },
  {
    id: "strings",
    title: "With the ION issued: remove each string earth, close the feeder breaker and release the turbines",
    steps: "5.01 – 6.03",
    needs: "Strings hang off 66 kV section A, which must be live and confirmed at the hold point; generating also needs PSE's ION (NC RfG Art. 35).",
  },
];

export const SEQUENCE_PAR_S = 120;
