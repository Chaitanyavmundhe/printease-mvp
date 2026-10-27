import { afterEach, describe, expect, it, vi } from "vitest";
import { getCurrentLocation, locationErrorMessage, validCoordinates } from "../location";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete window.printeaseDesktop;
});

function native(mock) {
  vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: mock } });
}
const position = { coords: { latitude: 19.8, longitude: 75.3, accuracy: 15 } };

describe("private location requests", () => {
  it("tries network positioning before high accuracy", async () => {
    const mock = vi.fn((success, failure, options) => {
      if (!options.enableHighAccuracy) failure({ code: 2 });
      else success(position);
    });
    native(mock);
    await expect(getCurrentLocation()).resolves.toEqual(position.coords);
    expect(mock).toHaveBeenCalledTimes(2);
    expect(mock.mock.calls[0][2].enableHighAccuracy).toBe(false);
    expect(mock.mock.calls[1][2].enableHighAccuracy).toBe(true);
  });
  it("does not retry permission denial or mislabel unavailable as denied", async () => {
    const mock = vi.fn((_success, failure) => failure({ code: 1 }));
    native(mock);
    await expect(getCurrentLocation()).rejects.toMatchObject({ code: "denied" });
    expect(mock).toHaveBeenCalledTimes(1);
    expect(locationErrorMessage({ code: 2 })).toContain("could not determine");
    expect(locationErrorMessage({ code: 2 })).not.toContain("blocked");
  });
  it("finishes even when the provider never calls back", async () => {
    vi.useFakeTimers();
    const mock = vi.fn();
    native(mock);
    const assertion = expect(getCurrentLocation()).rejects.toMatchObject({ code: "timeout" });
    await vi.advanceTimersByTimeAsync(21000);
    await assertion;
    expect(mock).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("cancels without retrying and ignores late success", async () => {
    let success;
    native(vi.fn((callback) => { success = callback; }));
    const controller = new AbortController();
    const pending = getCurrentLocation({ signal: controller.signal });
    controller.abort();
    success(position);
    await expect(pending).rejects.toMatchObject({ code: "cancelled" });
  });
  it("accepts real zero coordinates and rejects missing/out-of-range values", () => {
    expect(validCoordinates(0, 0)).toBe(true);
    for (const pair of [[null, 0], [0, undefined], [91, 0], [0, 181], [NaN, 0], ["19", 75]]) {
      expect(validCoordinates(...pair)).toBe(false);
    }
  });
  it("requires a supported secure context", async () => {
    vi.stubGlobal("navigator", {});
    await expect(getCurrentLocation()).rejects.toMatchObject({ code: "unsupported" });
  });
  it("uses desktop handoff only for an explicit action", async () => {
    native(vi.fn(success => success(position)));
    window.printeaseDesktop = {
      isDesktop: true,
      requestBrowserLocation: vi.fn().mockResolvedValue({ success: true, location: position.coords }),
    };
    await expect(getCurrentLocation({ automatic: true })).resolves.toEqual(position.coords);
    expect(window.printeaseDesktop.requestBrowserLocation).not.toHaveBeenCalled();
    await expect(getCurrentLocation()).resolves.toEqual(position.coords);
    expect(window.printeaseDesktop.requestBrowserLocation).toHaveBeenCalledOnce();
  });
  it("cancels desktop sharing and does not accept a late IPC result", async () => {
    let complete;
    window.printeaseDesktop = {
      isDesktop: true,
      requestBrowserLocation: vi.fn(() => new Promise(resolve => { complete = resolve; })),
      cancelBrowserLocation: vi.fn(),
    };
    const controller = new AbortController();
    const request = getCurrentLocation({ signal: controller.signal });
    await Promise.resolve();
    controller.abort();
    complete({ success: true, location: position.coords });
    await expect(request).rejects.toMatchObject({ code: "cancelled" });
    expect(window.printeaseDesktop.cancelBrowserLocation).toHaveBeenCalledOnce();
  });
});

