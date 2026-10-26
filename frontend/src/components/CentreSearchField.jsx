import { Search, X } from "lucide-react";

// Both discovery screens filter on change. Enter dismisses the mobile keyboard
// without selecting a centre, navigating, or firing a second server lookup.
export default function CentreSearchField({ value, onChange, label, placeholder, resultsId }) {
  return (
    <form role="search" className="pe-centre-search" onSubmit={event => {
      event.preventDefault();
      event.currentTarget.querySelector("input")?.blur();
    }}>
      <Search size={18} aria-hidden="true" className="pe-search-icon" />
      <input type="search" value={value} onChange={event => onChange(event.target.value)}
        aria-label={label} aria-controls={resultsId} placeholder={placeholder}
        enterKeyHint="search" autoComplete="off" maxLength={160} />
      {value && <button type="button" onClick={() => onChange("")} aria-label="Clear centre search" title="Clear search"><X size={18} /></button>}
    </form>
  );
}
