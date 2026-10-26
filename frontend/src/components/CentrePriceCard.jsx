import { Upload, MapPin } from "lucide-react";
import Row from "./Row";

function displayRate(value, includeUnit = true) {
  if (value == null || typeof value === "boolean" || String(value).trim() === "") return "Pending";
  const rate = Number(value);
  return Number.isFinite(rate) && rate > 0 ? `₹${rate}${includeUnit ? "/page" : ""}` : "Pending";
}

export default function CentrePriceCard({ centre, onUpload, onOpenMap, compact = false }) {
  const hasLocation = centre.locationEnabled && centre.latitude != null && centre.longitude != null;
  const availability = (
    <span className={`pe-centre-availability rounded-full px-3 py-1 text-xs font-semibold ${centre.printerOnline ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
      {centre.printerOnline ? "Available" : "Unavailable"}
    </span>
  );
  const locationAndUsage = (
    <>
      {hasLocation && (
        <p className="mt-1 text-xs text-slate-500 flex items-center gap-1">
          <MapPin size={11} className="text-emerald-600 flex-shrink-0" />
          <span className={compact ? "min-w-0" : "truncate"}>
            {compact ? (centre.distanceLabel || [centre.city, centre.area].filter(Boolean).join(", ") || "Location shared") : (
              <>{[centre.city, centre.area].filter(Boolean).join(", ") || "Location shared"}{centre.distanceLabel ? ` · ${centre.distanceLabel}` : ""}</>
            )}
          </span>
        </p>
      )}
      {centre.usageCount > 0 && (
        <p className="mt-1 text-xs font-medium text-slate-500">
          Used {centre.usageCount} time{centre.usageCount === 1 ? "" : "s"} from this account
        </p>
      )}
    </>
  );
  const mapAction = (
    <button
      type="button"
      onClick={hasLocation && onOpenMap ? () => onOpenMap(centre) : undefined}
      disabled={!hasLocation || !onOpenMap}
      aria-label={compact ? "View on map" : undefined}
      title={hasLocation && onOpenMap ? "View on map" : "This centre has not shared location."}
      className={`pe-centre-map pe-secondary-button flex items-center justify-center gap-1 border px-3 py-2 text-sm font-semibold transition ${hasLocation && onOpenMap ? "border-teal-200 bg-teal-50 hover:bg-teal-100" : "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"}`}
    >
      <MapPin size={compact ? 18 : 12} aria-hidden="true" />{!compact && "Map"}
    </button>
  );

  return (
    <div className={`pe-centre-card border ${compact ? "pe-centre-card-compact" : ""}`}>
      <div className="pe-centre-heading flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h4 className="break-words text-lg font-bold">
            <span className="pe-centre-name">{centre.name}</span>
            {compact && centre.code && <>{" "}<span className="pe-centre-code-inline"><span className="sr-only">Centre code </span>{centre.code}</span></>}
          </h4>
          {!compact && <p className="text-sm text-slate-600">Centre Code: {centre.code}</p>}
          {!compact && <p className="break-all text-sm text-slate-500">UPI: {centre.upiId}</p>}
          {!compact && centre.upiQrImageUrl && <p className="text-xs text-slate-500">UPI QR available</p>}
          {!compact && locationAndUsage}
        </div>
        {!compact && <div className="pe-centre-tools flex flex-col items-end gap-2">{availability}{mapAction}</div>}
      </div>

      <div className="pe-centre-rates mt-4 space-y-2 text-sm">
        {/* Compact cards share the unit once, but retain all four exact rates.
            Unknown prices remain Pending rather than a guessed/zero amount. */}
        {compact && <p className="text-xs font-semibold text-slate-600">A4 rates / page</p>}
        <Row label={compact ? "B/W single" : "A4 B/W Single Side"} value={displayRate(centre.bwSingle, !compact)} />
        <Row label={compact ? "B/W double" : "A4 B/W Double Side"} value={displayRate(centre.bwDouble, !compact)} />
        <Row label={compact ? "Color single" : "A4 Color Single Side"} value={displayRate(centre.colorSingle, !compact)} />
        <Row label={compact ? "Color double" : "A4 Color Double Side"} value={displayRate(centre.colorDouble, !compact)} />
      </div>

      {compact && <div className="pe-centre-meta">{availability}{locationAndUsage}</div>}
      <div className={compact ? "pe-centre-actions" : "contents"}>
        {compact && mapAction}
        <button
          onClick={onUpload}
          className="pe-primary-button mt-4 flex w-full items-center justify-center gap-2 px-4 py-3"
        >
          {!compact && <Upload size={18} className="shrink-0" />} {compact ? "Upload" : "Upload to this Centre"}
        </button>
      </div>
    </div>
  );
}
