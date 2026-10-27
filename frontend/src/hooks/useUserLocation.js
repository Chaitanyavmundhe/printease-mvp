import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentLocation, locationStatus } from "../utils/location";

export function useUserLocation() {
  const [userLocation, setUserLocation] = useState(null);
  const [userLocationStatus, setStatus] = useState("idle");
  const active = useRef(null);

  const requestUserLocation = useCallback(async (options = {}) => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    const cancel = () => controller.abort();
    options.signal?.addEventListener("abort", cancel, { once: true });
    if (options.signal?.aborted) controller.abort();
    setStatus("locating");
    try {
      const location = await getCurrentLocation({
        automatic: options.automatic === true,
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        setUserLocation(location);
        setStatus("ready");
        return location;
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setUserLocation(null);
        setStatus(locationStatus(error));
      }
      if (options.throwOnError) throw error;
    } finally {
      options.signal?.removeEventListener("abort", cancel);
      if (active.current === controller) {
        active.current = null;
        if (controller.signal.aborted) setStatus("idle");
      }
    }
    return null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    let cleanupPermission = null;
    Promise.resolve().then(() => navigator.permissions?.query?.({ name: "geolocation" })).then((status) => {
      if (cancelled || !status) return;
      const changed = () => {
        if (status.state === "granted" && !active.current) requestUserLocation({ automatic: true });
        if (status.state === "denied") {
          const pending = active.current;
          active.current = null;
          pending?.abort();
          setUserLocation(null);
          setStatus("denied");
        }
      };
      changed();
      status.addEventListener?.("change", changed);
      cleanupPermission = () => status.removeEventListener?.("change", changed);
    }).catch(() => {});
    return () => {
      cancelled = true;
      cleanupPermission?.();
      const pending = active.current;
      active.current = null;
      pending?.abort();
    };
  }, [requestUserLocation]);

  return { userLocation, userLocationStatus, requestUserLocation };
}
