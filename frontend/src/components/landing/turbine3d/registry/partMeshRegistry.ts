/**
 * Maps each TurbinePartId to a camera target for the fly-to transition.
 *
 * position: where the camera moves to (eye point)
 * lookAt: what the camera focuses on
 *
 * Scene units = metres, Y is up.
 * Hub at y=150, nacelle centre ~y=151.
 * Monopile top at sea level y=0, base at y=-40.
 */

import type { TurbinePartId } from "../../../../constants/turbinePartEducation";

export interface CameraTarget {
  position: [number, number, number];
  lookAt: [number, number, number];
}

export const PART_CAMERA_TARGETS: Record<TurbinePartId, CameraTarget> = {
  blades:       { position: [ 80, 200,  80], lookAt: [  0, 150,   0] },
  hub:          { position: [ 30, 165,  50], lookAt: [  0, 150,   0] },
  shaft:        { position: [ 15, 153,  20], lookAt: [  0, 151,   0] },
  bearing:      { position: [ 10, 152,  20], lookAt: [ -1, 151,   0] },
  brake:        { position: [  8, 152,  20], lookAt: [  1, 151,   0] },
  gearbox:      { position: [  5, 153,  15], lookAt: [  0, 151,  -2] },
  generator:    { position: [  8, 154,  15], lookAt: [  4, 152,  -2] },
  converter:    { position: [ 10, 152,  15], lookAt: [  5, 151,   0] },
  cooler:       { position: [ 10, 162,  20], lookAt: [  0, 156,   0] },
  anemometer:   { position: [ 10, 162,  15], lookAt: [  0, 157,   0] },
  yaw:          { position: [ 25, 148,  25], lookAt: [  0, 148,   0] },
  tower:        { position: [ 60,  60,  60], lookAt: [  0,  75,   0] },
  foundation:   { position: [ 40, -15,  40], lookAt: [  0, -20,   0] },
  nacelle:      { position: [ 40, 160,  40], lookAt: [  0, 151,   0] },
  wind:         { position: [  0, 155, 200], lookAt: [  0, 150,   0] },
  power_output: { position: [ 25, 155,  25], lookAt: [  4, 152,   0] },
};

/** Default overview camera (full turbine visible). */
export const DEFAULT_CAMERA_TARGET: CameraTarget = {
  position: [180, 160, 180],
  lookAt:   [  0,  80,   0],
};
