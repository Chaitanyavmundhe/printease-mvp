import { Upload, MapPin } from "lucide-react";
import Row from "./Row";

function displayRate(value) {
  if (value == null || typeof value === "boolean" || String(value).trim() === "") return "Pending";
  const rate = Number(value);
  return Number.isFinite(rate) && rate > 0 ? `₹${rate}/page` : "Pending";
}

export default function CentrePriceCard({ centre, onUpload, onOpenMap }) {
  const hasLocation = centre.locationEnabled && centre.latitude != null && centre.longitude != null;

  return (
    <div className="pe-centre-card border">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h4 className="break-words text-lg font-bold">{centre.name}</h4>
          <p className="text-sm text-slate-600">Centre Code: {centre.code}</p>
          <p className="break-all text-sm text-slate-500">UPI: {centre.upiId}</p>
          {centre.upiQrImageUrl && <p className="text-xs text-slate-500">UPI QR available</p>}
          {hasLocation && (
            <p className="mt-1 text-xs text-slate-500 flex items-center gap-1">
              <MapPin size={11} className="text-emerald-600 flex-shrink-0" />
              <span className="truncate">
                {[centre.city, centre.area].filter(Boolean).join(", ") || "Location shared"}
                {centre.distanceLabel ? ` · ${centre.distanceLabel}` : ""}
              </span>
            </p>
          )}
          {centre.usageCount > 0 && (
            <p className="mt-1 text-xs font-medium text-slate-500">
              Used {centre.usageCount} time{centre.usageCount === 1 ? "" : "s"} from this account
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${centre.printerOnline ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
            {centre.printerOnline ? "Available" : "Unavailable"}
          </span>
          {hasLocation && onOpenMap ? (
            <button
              onClick={() => onOpenMap(centre)}
              title="View on map"
              className="pe-secondary-button flex items-center gap-1 border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-semibold hover:bg-teal-100 transition"
            >
              <MapPin size={12} /> Map
            </button>
          ) : (
            <button
              disabled
              title="This centre has not shared location."
              className="flex min-h-11 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-400 cursor-not-allowed"
            >
              <MapPin size={12} /> Map
            </button>
          )}
        </div>
      </div>

      <div className="pe-centre-rates mt-4 space-y-2 text-sm">
        <Row label="A4 B/W Single Side" value={displayRate(centre.bwSingle)} />
        <Row label="A4 B/W Double Side" value={displayRate(centre.bwDouble)} />
        <Row label="A4 Color Single Side" value={displayRate(centre.colorSingle)} />
        <Row label="A4 Color Double Side" value={displayRate(centre.colorDouble)} />
      </div>

      <button
        onClick={onUpload}
        className="pe-primary-button mt-4 flex w-full items-center justify-center gap-2 px-4 py-3"
      >
        <Upload size={18} /> Upload to this Centre
      </button>
    </div>
  );
}
