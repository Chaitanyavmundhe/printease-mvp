import { Map, Navigation } from "lucide-react";
import { locationErrorMessage } from "../utils/location";

export default function CentreLocationActions({ userLocation, status, onLocate, onOpenMap, hasMap }) {
  const labels = { locating: "Finding...", denied: "Location denied", unavailable: "Location unavailable", timeout: "Location timed out", error: "Location error", unsupported: "Not supported" };
  const label = userLocation ? "Location active" : labels[status] || "Use my location";
  return (
    <div className="pe-location-actions">
      <button type="button" onClick={onLocate} disabled={status === "locating"} title={labels[status] && status !== "locating" ? locationErrorMessage({ code: status }) : undefined}>
        <Navigation size={18} aria-hidden="true" /><span>{label}</span>
      </button>
      {labels[status] && status !== "locating" && !userLocation && (
        <p role="status" className="col-span-full text-sm text-slate-600">{locationErrorMessage({ code: status })}</p>
      )}
      <button type="button" onClick={onOpenMap} disabled={!hasMap} title={hasMap ? "View centres on map" : "No centre has shared its location yet"}>
        <Map size={18} aria-hidden="true" /><span>View centres on map</span>
      </button>
    </div>
  );
}
