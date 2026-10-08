/**
 * Guided-tour model.
 *
 * A tour is a list of steps. A step points at an element tagged
 * `data-tour="<target>"` (or at nothing: a centred card) and is one of
 * three kinds:
 *   - info: explanation only;
 *   - action: the user has to do something (`task`); the tour waits until
 *     the task's predicate turns true (it can always be skipped);
 *   - caution: any step can carry a "Watch out" note (`caution`).
 */

/** Project lifecycle stage a tour belongs to (sidebar order). */
export type TourStage = "Start" | "Develop" | "Design" | "Build & Commission" | "Operate" | "Decommission" | "Learn";

export interface TourTask {
  /** What the user has to do, e.g. "Click any turbine on the map". */
  instruction: string;
  /**
   * Called once when the step starts; returns the completion predicate,
   * which the overlay polls. The closure can capture a baseline (e.g. the
   * element's starting position for a drag task).
   */
  watch: () => () => boolean;
}

/** Call-out shown as a labelled list in the card (e.g. turbine parts). */
export interface TourPoint {
  label: string;
  text: string;
}

export interface TourStep {
  id: string;
  /** Route the step lives on; the overlay navigates there first. */
  route?: string;
  /**
   * `data-tour` id of the element to spotlight; none → centred card. A list
   * gives fallbacks: the first one visible on screen wins (e.g. the sidebar,
   * or the menu button on phones where the sidebar is a hidden drawer).
   */
  target?: string | string[];
  title: string;
  body: string;
  points?: TourPoint[];
  task?: TourTask;
  /** "Watch out" note: safety, standards or a common mistake. */
  caution?: string;
  /** Draw the node arrow from the target to the card (default: true). */
  arrow?: boolean;
  /**
   * Lift the target above sibling overlays for this step (e.g. the wind rose
   * under an open 3D turbine viewer), so the spotlit element gets the clicks.
   */
  raise?: boolean;
}

export interface Tour {
  id: string;
  title: string;
  summary: string;
  stage: TourStage;
  steps: TourStep[];
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Size {
  w: number;
  h: number;
}
