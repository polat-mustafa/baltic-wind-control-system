/**
 * Live blade-field geometry: one coloured clone of the blade shared by all
 * three blades, recoloured in place when the operating point changes
 * (≈ 7 k vertices, < 2 ms). The latest field summary is published to a tiny
 * store so the HTML legend outside the Canvas can show the numbers.
 */

import { useEffect, useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { create } from "zustand";

import {
  evaluateBladeField,
  type BladeFieldMode,
  type BladeOperatingPoint,
  type FieldSummary,
} from "../model/bladeField";

interface BladeFieldSummaryState {
  summary: FieldSummary | null;
  set: (s: FieldSummary | null) => void;
}

export const useBladeFieldSummary = create<BladeFieldSummaryState>((set) => ({
  summary: null,
  set: (summary) => set({ summary }),
}));

const q = (v: number, step: number) => Math.round(v / step) * step;

export function useBladeFieldGeometry(
  mode: BladeFieldMode,
  base: THREE.BufferGeometry,
  op: BladeOperatingPoint,
): THREE.BufferGeometry | null {
  const geom = useMemo(() => {
    if (mode === "off") return null;
    const g = base.clone();
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3), 3));
    return g;
  }, [mode, base]);

  // Quantised inputs: the slider moves in 0.5 m/s steps; pitch/rpm ramps
  // should not recolour every frame.
  const wind = q(op.windMs, 0.1);
  const rpm = q(op.rpm, 0.05);
  const pitch = q(op.pitchDeg, 0.25);

  // Layout effect: colours are in place before the first frame is drawn.
  useLayoutEffect(() => {
    if (!geom || mode === "off") return;
    const color = geom.attributes.color as THREE.BufferAttribute;
    const summary = evaluateBladeField(
      geom,
      mode,
      { windMs: wind, rpm, pitchDeg: pitch },
      color.array as Float32Array,
    );
    color.needsUpdate = true;
    useBladeFieldSummary.getState().set(summary);
  }, [geom, mode, wind, rpm, pitch]);

  useEffect(() => {
    if (mode === "off") useBladeFieldSummary.getState().set(null);
  }, [mode]);

  useEffect(() => () => geom?.dispose(), [geom]);

  return geom;
}
