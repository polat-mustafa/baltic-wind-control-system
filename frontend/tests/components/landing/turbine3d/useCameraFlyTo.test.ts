/**
 * Tests for useCameraFlyTo hook.
 *
 * Mocks @react-three/fiber's useThree and useFrame to avoid needing
 * a real Canvas/WebGL context. The registry now computes camera targets
 * from mesh bounds at runtime — our fake scene has no meshes, so the hook
 * falls back to DEFAULT_CAMERA_TARGET for AutoFocus entries and uses the
 * literal position for FixedFocus entries.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { Vector3 } from "three";

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

const mockScene = {
  getObjectByName: () => null,
  traverse: () => {},
};

let _simTime = 0;
const mockClock = { getElapsedTime: () => _simTime };

vi.mock("@react-three/fiber", () => ({
  useThree: () => ({
    camera: mockCamera,
    controls: mockControls,
    scene: mockScene,
    clock: mockClock,
  }),
  useFrame: (cb: (state: unknown, delta: number) => void) => {
    frameCallbacks.push(cb);
  },
}));

import { useCameraFlyTo } from "../../../../src/components/landing/turbine3d/hooks/useCameraFlyTo";
import { DEFAULT_CAMERA_TARGET } from "../../../../src/components/landing/turbine3d/registry/partMeshRegistry";

beforeEach(() => {
  frameCallbacks.length = 0;
  _simTime = 0;
  mockCamera.position.set(180, 160, 180);
  mockTarget.set(0, 80, 0);
  mockControls.update.mockClear();
});

function tickFrames(n: number, delta = 1 / 60) {
  for (let i = 0; i < n; i++) {
    _simTime += delta;
    for (const cb of frameCallbacks) {
      cb({}, delta);
    }
  }
}

/** Flush one rAF — the hook defers target resolution by one frame. */
async function flushRaf() {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

describe("useCameraFlyTo", () => {
  it("returns a stable trigger function", () => {
    const { result } = renderHook(() => useCameraFlyTo());
    expect(typeof result.current).toBe("function");
  });

  it("triggering with null eases toward the default camera target", async () => {
    const { result } = renderHook(() => useCameraFlyTo());
    const trigger = result.current;

    mockCamera.position.set(5, 153, 15);
    act(() => { trigger(null); });
    await flushRaf();
    tickFrames(30);

    const dist = mockCamera.position.distanceTo(
      new Vector3(...DEFAULT_CAMERA_TARGET.position),
    );
    const distFromStart = new Vector3(5, 153, 15).distanceTo(
      new Vector3(...DEFAULT_CAMERA_TARGET.position),
    );
    expect(dist).toBeLessThan(distFromStart);
    expect(mockControls.update).toHaveBeenCalled();
  });

  it("triggering with a part id with no mesh falls back to the default target", async () => {
    const { result } = renderHook(() => useCameraFlyTo());
    const trigger = result.current;

    // Start well away from the default target so the fallback has somewhere to go.
    mockCamera.position.set(5, 10, 5);
    act(() => { trigger("gearbox"); });
    await flushRaf();
    tickFrames(120);

    const dist = mockCamera.position.distanceTo(
      new Vector3(...DEFAULT_CAMERA_TARGET.position),
    );
    const distFromStart = new Vector3(5, 10, 5).distanceTo(
      new Vector3(...DEFAULT_CAMERA_TARGET.position),
    );
    expect(dist).toBeLessThan(distFromStart);
  });

  it("animation stops once the camera reaches its target", async () => {
    const { result } = renderHook(() => useCameraFlyTo());
    const trigger = result.current;

    act(() => { trigger(null); });
    await flushRaf();
    tickFrames(500);

    const dist = mockCamera.position.distanceTo(
      new Vector3(...DEFAULT_CAMERA_TARGET.position),
    );
    expect(dist).toBeLessThan(1);
  });
});
