import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useUserLocation } from "../useUserLocation";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); delete window.printeaseDesktop; });
describe("location lifecycle", () => {
  it("does not request location automatically without an existing grant", async () => {
    const native = vi.fn();
    const permission = new EventTarget();
    permission.state = "prompt";
    vi.stubGlobal("navigator", { permissions: { query: vi.fn().mockResolvedValue(permission) }, geolocation: { getCurrentPosition: native } });
    const { result } = renderHook(() => useUserLocation());
    await act(async () => {});
    expect(native).not.toHaveBeenCalled();
    expect(result.current.userLocationStatus).toBe("idle");
  });
  it("updates shared location for ranking and clears it on revocation", async () => {
    const permission = new EventTarget();
    permission.state = "granted";
    vi.stubGlobal("navigator", { permissions: { query: vi.fn().mockResolvedValue(permission) }, geolocation: { getCurrentPosition: success => success({ coords: { latitude: 20, longitude: 75, accuracy: 5 } }) } });
    const { result } = renderHook(() => useUserLocation());
    await waitFor(() => expect(result.current.userLocationStatus).toBe("ready"));
    expect(result.current.userLocation.latitude).toBe(20);
    act(() => { permission.state = "denied"; permission.dispatchEvent(new Event("change")); });
    expect(result.current.userLocation).toBeNull();
    expect(result.current.userLocationStatus).toBe("denied");
  });
  it("does not let late results override denied permission", async () => {
    const permission = new EventTarget();
    permission.state = "granted";
    let success;
    vi.stubGlobal("navigator", { permissions: { query: vi.fn().mockResolvedValue(permission) }, geolocation: { getCurrentPosition: callback => { success = callback; } } });
    const { result } = renderHook(() => useUserLocation());
    await waitFor(() => expect(result.current.userLocationStatus).toBe("locating"));
    await act(async () => {
      permission.state = "denied"; permission.dispatchEvent(new Event("change"));
      success({ coords: { latitude: 20, longitude: 75 } });
    });
    expect(result.current.userLocationStatus).toBe("denied");
    expect(result.current.userLocation).toBeNull();
  });
  it("updates customer location from explicit desktop browser sharing", async () => {
    vi.stubGlobal("navigator", {});
    window.printeaseDesktop = {
      isDesktop: true,
      requestBrowserLocation: vi.fn().mockResolvedValue({ success: true, location: { latitude: 20, longitude: 75 } }),
    };
    const { result } = renderHook(() => useUserLocation());
    await act(async () => { await result.current.requestUserLocation(); });
    expect(result.current.userLocationStatus).toBe("ready");
    expect(result.current.userLocation.latitude).toBe(20);
  });
});
