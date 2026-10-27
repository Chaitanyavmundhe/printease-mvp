// Customer coordinates stay in memory. Hub coordinates are published only by Save.
const MESSAGES = {
  denied: "Location permission is blocked. Allow location for this site in browser settings and enable device location services.",
  unavailable: "Your device could not determine its location. Enable system location services and Wi-Fi, then retry. You can still choose a centre manually.",
  timeout: "Location detection timed out. Check location services and your network, then retry.",
  unsupported: "Location requires a supported browser on HTTPS or localhost.",
  cancelled: "Location request cancelled.",
  error: "Could not determine your location. Please retry or choose a centre manually.",
};

export class LocationError extends Error {
  constructor(code, message = MESSAGES[code] || MESSAGES.error) {
    super(message);
    this.name = "LocationError";
    this.code = code;
  }
}

export function locationStatus(error) {
  if (typeof error?.code === "string" && Object.prototype.hasOwnProperty.call(MESSAGES, error.code)) return error.code;
  return ({ 1: "denied", 2: "unavailable", 3: "timeout" })[error?.code] || "error";
}

export function locationErrorMessage(error) {
  return error instanceof LocationError ? error.message : MESSAGES[locationStatus(error)];
}

export function validCoordinates(latitude, longitude) {
  return typeof latitude === "number" && Number.isFinite(latitude) && Math.abs(latitude) <= 90 &&
    typeof longitude === "number" && Number.isFinite(longitude) && Math.abs(longitude) <= 180;
}

function normalizePosition(coords) {
  if (!validCoordinates(coords?.latitude, coords?.longitude)) throw new LocationError("unavailable");
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy: Number.isFinite(coords.accuracy) && coords.accuracy >= 0 ? coords.accuracy : null,
  };
}

function nativeAttempt(geolocation, options, signal) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error, coords) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      if (error) reject(error);
      else {
        try { resolve(normalizePosition(coords)); }
        catch (invalid) { reject(invalid); }
      }
    };
    const onAbort = () => finish(new LocationError("cancelled"));
    // Some providers never invoke either callback, so enforce our own deadline.
    const timer = setTimeout(() => finish(new LocationError("timeout")), options.timeout + 250);
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) return onAbort();
    try {
      geolocation.getCurrentPosition(
        (position) => finish(null, position.coords),
        (error) => finish(new LocationError(locationStatus(error))),
        options
      );
    } catch (error) {
      finish(new LocationError(error?.name === "SecurityError" ? "denied" : "unavailable"));
    }
  });
}

async function browserHandoff(bridge, signal) {
  if (signal?.aborted) throw new LocationError("cancelled");
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error, coords) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      if (error) reject(error);
      else {
        try { resolve(normalizePosition(coords)); }
        catch (invalid) { reject(invalid); }
      }
    };
    const cancel = () => Promise.resolve().then(() => bridge.cancelBrowserLocation?.()).catch(() => {});
    const onAbort = () => { cancel(); finish(new LocationError("cancelled")); };
    const timer = setTimeout(() => {
      cancel();
      finish(new LocationError("timeout", "Finish sharing location in your browser, or retry Use Current Location."));
    }, 95000);
    signal?.addEventListener("abort", onAbort, { once: true });
    Promise.resolve().then(() => settled ? null : bridge.requestBrowserLocation()).then((result) => {
      if (result?.success) finish(null, result.location);
      else finish(new LocationError(locationStatus(result), result?.message));
    }, () => finish(new LocationError("error", "Could not open browser location sharing. Retry or enter shop coordinates manually.")));
  });
}

export async function getCurrentLocation({ automatic = false, signal } = {}) {
  const bridge = typeof window !== "undefined" ? window.printeaseDesktop : null;
  // Opening an external browser is only allowed after an explicit location action.
  if (!automatic && bridge?.isDesktop && typeof bridge.requestBrowserLocation === "function") {
    return browserHandoff(bridge, signal);
  }
  if (typeof navigator === "undefined" || !navigator.geolocation ||
      (typeof window !== "undefined" && window.isSecureContext === false)) {
    throw new LocationError("unsupported");
  }
  try {
    return await nativeAttempt(navigator.geolocation,
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 120000 }, signal);
  } catch (error) {
    if (!["unavailable", "timeout"].includes(error.code)) throw error;
    // A network fix often works on PCs; GPS/high accuracy is a bounded fallback.
    return nativeAttempt(navigator.geolocation,
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }, signal);
  }
}

