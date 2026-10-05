/**
 * Tour store: navigation, completion, persistence and the first-visit welcome.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { nextTour, PROGRESS_KEY, useTourStore } from "../../src/tour/tourStore";
import { TOURS } from "../../src/tour/tours";

const s = () => useTourStore.getState();

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  s().reload();
});

describe("welcome", () => {
  it("opens on a first visit", () => {
    expect(s().welcomeOpen).toBe(true);
  });

  it("'Later' hides it for the session only", () => {
    s().dismissWelcome(false);
    expect(s().welcomeOpen).toBe(false);
    s().reload();
    expect(s().welcomeOpen).toBe(false);
    sessionStorage.clear();
    s().reload();
    expect(s().welcomeOpen).toBe(true);
  });

  it("'Don't show again' persists", () => {
    s().dismissWelcome(true);
    sessionStorage.clear();
    s().reload();
    expect(s().welcomeOpen).toBe(false);
  });

  it("survives a corrupt stored value", () => {
    localStorage.setItem(PROGRESS_KEY, "{not json");
    s().reload();
    expect(s().progress).toEqual({ completed: [], welcomeDismissed: false });
  });
});

describe("running a tour", () => {
  it("starts, steps and records completion", () => {
    const tour = TOURS[1];
    s().start(tour.id);
    expect(s().activeTourId).toBe(tour.id);
    expect(s().welcomeOpen).toBe(false);
    s().prev();
    expect(s().stepIndex).toBe(0);
    for (let i = 0; i < tour.steps.length - 1; i++) s().next();
    expect(s().stepIndex).toBe(tour.steps.length - 1);
    s().next();
    expect(s().activeTourId).toBeNull();
    expect(s().progress.completed).toEqual([tour.id]);
    expect(JSON.parse(localStorage.getItem(PROGRESS_KEY)!)).toEqual({
      completed: [tour.id],
      welcomeDismissed: true,
    });
  });

  it("does not record a tour that was left early", () => {
    s().start("control-room");
    s().next();
    s().stop();
    expect(s().activeTourId).toBeNull();
    expect(s().progress.completed).toEqual([]);
    expect(s().progress.welcomeDismissed).toBe(true);
  });

  it("ignores unknown tours and clamps the start step", () => {
    s().start("nope");
    expect(s().activeTourId).toBeNull();
    s().start("control-room", 999);
    expect(s().stepIndex).toBe(TOURS[0].steps.length - 1);
  });

  it("knows the following tour", () => {
    expect(nextTour(TOURS[0].id)?.id).toBe(TOURS[1].id);
    expect(nextTour(TOURS[TOURS.length - 1].id)).toBeUndefined();
  });
});
