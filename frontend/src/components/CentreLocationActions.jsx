import { Map, Navigation } from "lucide-react";

export default function CentreLocationActions({ userLocation, status, onLocate, onOpenMap, hasMap }) {
  const labels = { locating: "Finding...", denied: "Location denied", unavailable: "Location unavailable", timeout: "Location timed out", error: "Location error", unsupported: "Not supported" };
  const label = userLocation ? "Location active" : labels[status] || "Use my location";
  return (
    <div className="pe-location-actions">
      <button type="button" onClick={onLocate} disabled={status === "locating"}>
        <Navigation size={18} aria-hidden="true" /><span>{label}</span>
      </button>
      <button type="button" onClick={onOpenMap} disabled={!hasMap} title={hasMap ? "View centres on map" : "No centre has shared its location yet"}>
        <Map size={18} aria-hidden="true" /><span>View centres on map</span>
      </button>
    </div>
  );
}
