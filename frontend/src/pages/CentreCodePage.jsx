import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { Search, Map, Navigation } from "lucide-react";
import Card from "../components/Card";
import CentrePriceCard from "../components/CentrePriceCard";
import CentreScannerTile from "../components/CentreScannerTile";
import { hasCentreLocation, rankCentres } from "../utils/centreDiscovery";
import { useCentreSort } from "../hooks/useCentreSort";
import { centreSortLabel } from "../utils/centreSort";
import CentreSortControl from "../components/CentreSortControl";

// Lazy-load the map modal — only downloaded when user clicks "Map" for the first time.
// This keeps the desktop bundle untouched since DesktopAgentPage never imports this component.
const CentreMapModal = lazy(() => import("../components/CentreMapModal"));

export default function CentreCodePage({
  centreCode,
  setCentreCode,
  handleCentreCode,
  selectCentreByCode,
  centres,
  selectCentreAndUpload,
  lookupLoading,
  lookupError,
  autoStartScanner = false,
  userLocation = null,
  userLocationStatus = "idle",
  requestUserLocation = () => {},
}) {
  const [mapOpen, setMapOpen] = useState(false);

  const handleScan = useCallback(async (code) => {
    setCentreCode(code);
    await selectCentreByCode(code);
  }, [selectCentreByCode, setCentreCode]);

  const [centreSort, setCentreSort] = useCentreSort(userLocation);
  const filteredCentres = useMemo(
    () => rankCentres(centres, { userLocation, query: centreCode, sortBy: centreSort }),
    [centreCode, centres, userLocation, centreSort]
  );

  const mappableCentres = useMemo(
    () => filteredCentres.filter(hasCentreLocation),
    [filteredCentres]
  );

  const [mapCentreToFocus, setMapCentreToFocus] = useState(null);

  function openMapForCentre(centreToFocus = null) {
    if (centreToFocus?.id) {
      setMapCentreToFocus(centreToFocus);
    } else {
      setMapCentreToFocus(null);
    }
    setMapOpen(true);
  }

  const locationLabel = userLocationStatus === "locating"
    ? "Finding..."
    : userLocation
      ? "Location active"
      : userLocationStatus === "denied"
        ? "Location denied"
        : userLocationStatus === "unavailable"
          ? "Location unavailable"
          : userLocationStatus === "timeout"
            ? "Location timed out"
            : userLocationStatus === "error"
              ? "Location error"
              : userLocationStatus === "unsupported"
                ? "Location not supported"
                : "Use my location";

  return (
    <div className="pe-customer-flow space-y-8">
      <Card className="text-center sm:text-left sm:p-8">
        <h2 className="text-3xl font-bold text-slate-900">Find a Printing Centre</h2>

        <div className="mt-6 grid gap-6 md:grid-cols-[45%_1fr]">
          <CentreScannerTile
            onScan={handleScan}
            minHeightClass="min-h-[185px]"
            iconSize={54}
            idleLabel="Scan QR"
            activeLabel="Point at centre QR"
            idleHint="Tap to scan inside this card."
            autoStart={autoStartScanner}
          />

          <div className="flex flex-col gap-4 justify-center">
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={22} />
              <input
                value={centreCode}
                aria-label="Search centres by name, code or area"
                onChange={(e) => setCentreCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCentreCode();
                  }
                }}
                placeholder="Search by name, code, area, or price under 5"
                className="w-full rounded-2xl border bg-slate-50 py-4 pl-14 pr-6 text-lg outline-none focus:bg-white focus:ring-2 focus:ring-slate-300 transition-all"
              />
            </div>
            <div className="flex gap-2">
              <CentreSortControl value={centreSort} onChange={setCentreSort} userLocation={userLocation} className="w-full" />
            </div>
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
              <button
                onClick={handleCentreCode}
                disabled={lookupLoading || !String(centreCode).trim()}
                className="pe-primary-button inline-flex w-full sm:w-auto items-center justify-center gap-2 px-5 py-3 transition disabled:opacity-50"
              >
                Search Online
              </button>
              <button
                type="button"
                onClick={requestUserLocation}
                disabled={userLocationStatus === "locating"}
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 font-semibold text-emerald-700 hover:bg-emerald-100 transition disabled:opacity-60"
              >
                <Navigation size={18} /> {locationLabel}
              </button>
              {mappableCentres.length > 0 ? (
                <button
                  onClick={() => openMapForCentre()}
                  className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 font-semibold text-emerald-700 hover:bg-emerald-100 transition"
                >
                  <Map size={18} /> View centres on map
                </button>
              ) : (
                <div className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 font-semibold text-slate-500">
                  <Map size={18} /> No centres have shared location yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {lookupError && <p className="mt-4 text-sm font-medium text-red-600">{lookupError}</p>}
        {lookupLoading && <p className="mt-4 text-sm text-slate-500">Checking centre code online...</p>}
      </Card>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold">Centre List With Prices</h3>
            <p role="status" className="text-sm text-slate-600">{filteredCentres.length} centres · {centreSortLabel(centreSort)}</p>
          </div>
          {mappableCentres.length > 0 ? (
            <button
              onClick={() => openMapForCentre()}
              className="hidden sm:flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition"
            >
              <Map size={15} />
              {mappableCentres.length} centre{mappableCentres.length !== 1 ? "s" : ""} on map
            </button>
          ) : (
            <span className="hidden sm:inline-flex text-sm text-slate-500">
              No centres have shared location yet.
            </span>
          )}
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredCentres.map((centre) => (
            <CentrePriceCard
              key={centre.id}
              centre={centre}
              onUpload={() => selectCentreAndUpload(centre)}
              onOpenMap={openMapForCentre}
            />
          ))}
        </div>
        {filteredCentres.length === 0 && (
          <div className="mt-6 rounded-3xl border border-dashed bg-slate-50 p-12 text-center">
            <Search className="mx-auto text-slate-400 mb-3" size={40} />
            <p className="text-lg font-medium text-slate-700">No centre matches locally</p>
            <p className="text-sm text-slate-500 mt-1">If you have an exact code, click "Search Online".</p>
          </div>
        )}
      </div>

      {/* Lazy-loaded map modal — only rendered when opened */}
      {mapOpen && (
        <Suspense fallback={null}>
          <CentreMapModal
            centres={filteredCentres.length > 0 ? filteredCentres : centres}
            onClose={() => {
              setMapOpen(false);
              setMapCentreToFocus(null);
            }}
            onSelectCentre={(centre) => selectCentreAndUpload(centre)}
            focusCentre={mapCentreToFocus}
            initialUserLocation={userLocation}
          />
        </Suspense>
      )}
    </div>
  );
}
