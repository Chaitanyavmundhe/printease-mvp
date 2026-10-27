import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { Search } from "lucide-react";
import Card from "../components/Card";
import CentrePriceCard from "../components/CentrePriceCard";
import CentreScannerTile from "../components/CentreScannerTile";
import { hasCentreLocation, rankCentres } from "../utils/centreDiscovery";
import { useCentreSort } from "../hooks/useCentreSort";
import { centreSortLabel } from "../utils/centreSort";
import CentreSortControl from "../components/CentreSortControl";
import CentreSearchField from "../components/CentreSearchField";
import CentreLocationActions from "../components/CentreLocationActions";

// Lazy-load the map modal — only downloaded when user clicks "Map" for the first time.
// This keeps the desktop bundle untouched since DesktopAgentPage never imports this component.
const CentreMapModal = lazy(() => import("../components/CentreMapModal"));

export default function CentreCodePage({
  centreCode,
  setCentreCode,
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
            <CentreSearchField value={centreCode} onChange={setCentreCode} label="Search centres by name, code or area" placeholder="Name, code, area, or price under 5" resultsId="scan-centre-results" />
            <div className="flex gap-2">
              <CentreSortControl value={centreSort} onChange={setCentreSort} userLocation={userLocation} className="w-full" />
            </div>
            <CentreLocationActions userLocation={userLocation} status={userLocationStatus} onLocate={requestUserLocation} onOpenMap={() => openMapForCentre()} hasMap={mappableCentres.length > 0} />
          </div>
        </div>

        {lookupError && <p className="mt-4 text-sm font-medium text-red-600">{lookupError}</p>}
        {lookupLoading && <p className="mt-4 text-sm text-slate-500">Checking centre code online...</p>}
      </Card>

      <div>
        <div className="mb-4">
          <div>
            <h3 className="text-xl font-bold">Centre List With Prices</h3>
            <p role="status" className="text-sm text-slate-600">{filteredCentres.length} centres · {centreSortLabel(centreSort)}{filteredCentres.some(centre => centre.searchScore > 0) ? " · Similar names included" : ""}</p>
          </div>
        </div>
        <div id="scan-centre-results" className="pe-scan-centre-grid">
          {filteredCentres.map((centre) => (
            <CentrePriceCard
              key={centre.id}
              centre={centre}
              compact
              onUpload={() => selectCentreAndUpload(centre)}
              onOpenMap={openMapForCentre}
            />
          ))}
        </div>
        {filteredCentres.length === 0 && (
          <div className="mt-6 rounded-3xl border border-dashed bg-slate-50 p-12 text-center">
            <Search className="mx-auto text-slate-400 mb-3" size={40} />
            <p className="text-lg font-medium text-slate-700">No matching centres</p>
            <p className="text-sm text-slate-500 mt-1">Try a shorter name, another area, or clear the search.</p>
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
            requestUserLocation={requestUserLocation}
          />
        </Suspense>
      )}
    </div>
  );
}
