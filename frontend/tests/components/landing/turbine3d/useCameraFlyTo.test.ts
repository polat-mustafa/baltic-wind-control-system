/**
 * Tests for useCameraFlyTo hook.
 *
 * Mocks @react-three/fiber's useThree and useFrame to avoid needing
 * a real Canvas/WebGL context.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { Vector3 } from "three";

// Collect frame callbacks registered by useFrame
const frameCallbacks: Array<(state: unknown, delta: number) => void> = [];

const mockCamera = {
  position: new Vector3(180, 160, 180),
  lookAt: vi.fn(),
};

const mockTarget = new Vector3(0, 80, 0);
const mockControls = {
  target: mockTarget,
  update: vi.fn(),
};

vi.mock("@react-three/fiber", () => ({
  useThree: () => ({ camera: mockCamera, controls: mockControls }),
  useFrame: (cb: (state: unknown, delta: number) => void) => {
    frameCallbacks.push(cb);
  },
}));

// Must import AFTER vi.mock
import { useCameraFlyTo } from "../../../../src/components/landing/turbine3d/hooks/useCameraFlyTo";
import {
  PART_CAMERA_TARGETS,
  DEFAULT_CAMERA_TARGET,
} from "../../../../src/components/landing/turbine3d/registry/partMeshRegistry";

beforeEach(() => {
  frameCallbacks.length = 0;
  mockCamera.position.set(180, 160, 180);
  mockTarget.set(0, 80, 0);
  mockControls.update.mockClear();
});

function tickFrames(n: number, delta = 1 / 60) {
  for (let i = 0; i < n; i++) {
    for (const cb of frameCallbacks) {
      cb({}, delta);
    }
  }
}

describe("useCameraFlyTo", () => {
  it("returns a stable trigger function", () => {
    const { result } = renderHook(() => useCameraFlyTo());
    expect(typeof result.current).toBe("function");
  });

  it("triggering with a partId starts animation toward that part", () => {
    const { result } = renderHook(() => useCameraFlyTo());
    const trigger = result.current;

    act(() => { trigger("gearbox"); });

    const target = PART_CAMERA_TARGETS.gearbox;

    // Tick a few frames — camera should move toward the target position
    tickFrames(5);

    // Camera should have moved closer to the gearbox target
    const distBefore = new Vector3(180, 160, 180).distanceTo(
      new Vector3(...target.position),
    );
    const distAfter = mockCamera.position.distanceTo(
      new Vector3(...target.position),
    );
    expect(distAfter).toBeLessThan(distBefore);
  });

  it("triggering with null targets DEFAULT_CAMERA_TARGET", () => {
    const { result } = renderHook(() => useCameraFlyTo());
    const trigger = result.current;

    // First move somewhere
    act(() => { trigger("gearbox"); });
    tickFrames(100); // run to completion

    // Now reset
    mockCamera.position.set(5, 153, 15);
    act(() => { trigger(null); });
    tickFrames(5);

    // Camera should move toward default position
    const dist = mockCamera.position.distanceTo(
      new Vector3(...DEFAULT_CAMERA_TARGET.position),
    );
    const distFromStart = new Vector3(5, 153, 15).distanceTo(
      new Vector3(...DEFAULT_CAMERA_TARGET.position),
    );
    expect(dist).toBeLessThan(distFromStart);
  });

  it("controls.target is lerped alongside camera.position", () => {
    const { result } = renderHook(() => useCameraFlyTo());
    const trigger = result.current;

    const initialTarget = mockTarget.clone();
    act(() => { trigger("tower"); });
    tickFrames(10);

    // controls.target should have moved toward tower lookAt
    const towerLookAt = new Vector3(...PART_CAMERA_TARGETS.tower.lookAt);
    const distAfter = mockTarget.distanceTo(towerLookAt);
    const distBefore = initialTarget.distanceTo(towerLookAt);
    expect(distAfter).toBeLessThan(distBefore);
    expect(mockControls.update).toHaveBeenCalled();
  });

  it("animation stops once camera reaches target", () => {
    const { result } = renderHook(() => useCameraFlyTo());
    const trigger = result.current;

    act(() => { trigger("hub"); });

    // Run many frames to converge
    tickFrames(500);

    const hubPos = new Vector3(...PART_CAMERA_TARGETS.hub.position);
    const dist = mockCamera.position.distanceTo(hubPos);
    expect(dist).toBeLessThan(0.5);
  });
});
