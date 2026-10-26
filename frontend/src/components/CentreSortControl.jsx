import { CENTRE_SORT_OPTIONS } from "../utils/centreSort";

export default function CentreSortControl({ value, onChange, userLocation, className = "" }) {
  return <select aria-label="Sort printing centres" value={value} onChange={event => onChange(event.target.value)} className={`min-w-0 rounded-lg border bg-white px-3 py-3 text-sm font-semibold text-slate-700 ${className}`}>
    {CENTRE_SORT_OPTIONS.map(option => <option key={option.value} value={option.value} disabled={option.value === "nearest" && !userLocation}>
      {option.label}{option.value === "nearest" && !userLocation ? " (enable location)" : ""}
    </option>)}
  </select>;
}
