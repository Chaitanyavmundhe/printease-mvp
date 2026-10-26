import { lazy, Suspense, useCallback, useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";

import { User, Upload, Store, Plus, Building2, IndianRupee } from "lucide-react";
import Card from "../components/Card";
import CentrePriceCard from "../components/CentrePriceCard";
import CameraScanLayer from "../components/CameraScanLayer";
import CentreScannerTile from "../components/CentreScannerTile";
import HubActiveOrdersManager from "../components/HubActiveOrdersManager";
import HubDesktopDownload from "../components/HubDesktopDownload";
import CentreSortControl from "../components/CentreSortControl";
import CentreSearchField from "../components/CentreSearchField";
import CentreLocationActions from "../components/CentreLocationActions";
import { centreSortLabel } from "../utils/centreSort";
import { useCentreSort } from "../hooks/useCentreSort";
import { hasCentreLocation, rankCentres } from "../utils/centreDiscovery";

import QRScanner from "../components/QRScanner";

const CentreMapModal = lazy(() => import("../components/CentreMapModal"));

const SCANNER_MODE_KEY = "printease_scanner_mode";
const LATEST_DESKTOP_RELEASE_URL = "https://github.com/adityasomde/printease-desk/releases/latest";
const SCANNER_MODES = new Set(["ready", "transparent", "classic"]);

function getSavedScannerMode() {
  if (typeof window === "undefined") return "ready";

  try {
    const savedMode = window.localStorage.getItem(SCANNER_MODE_KEY);
    return SCANNER_MODES.has(savedMode) ? savedMode : "ready";
  } catch {
    return "ready";
  }
}

export default function HomePage({
  currentUser,
  desktopAvailable = false,
  navigate,
  centres,
  startLogin,
  startRegister,
  startDirectUpload,
  selectCentreAndUpload,
  selectCentreByCode,
  currentHub,
  hubOrders,
  updateOrderStatus,
  refreshOrders,
  onOrderSaved,
  orders,
  userLocation = null,
  userLocationStatus = "idle",
  requestUserLocation = () => {},
}) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [centreSearch, setCentreSearch] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapCentreToFocus, setMapCentreToFocus] = useState(null);
  const [heroScannerActive, setHeroScannerActive] = useState(false);
  const [heroScannerError, setHeroScannerError] = useState("");
  const [scannerMode, setScannerMode] = useState(getSavedScannerMode);
  const startScanner = useCallback(() => setScannerOpen(true), []);
  const stopScanner = useCallback(() => setScannerOpen(false), []);

  const handleScan = useCallback(async (code) => {
    setHeroScannerActive(false);
    stopScanner();
    await selectCentreByCode(code);
  }, [selectCentreByCode, stopScanner]);

  const startHeroScanner = useCallback(() => {
    setHeroScannerError("");
    setHeroScannerActive(true);
  }, []);

  const startSelectedScanner = useCallback(() => {
    if (scannerMode === "classic") {
      setHeroScannerActive(false);
      startScanner();
      return;
    }

    // Both ready and transparent use the inline hero scanner.
    // Ready mode also starts it automatically when the home page loads.
    startHeroScanner();
  }, [scannerMode, startHeroScanner, startScanner]);

  const stopHeroScanner = useCallback(() => {
    setHeroScannerActive(false);
  }, []);

  const handleHeroScannerError = useCallback((error) => {
    setHeroScannerError(error?.message || "Camera is not available. You can still search by centre name or code.");
    setHeroScannerActive(false);
  }, []);

  useEffect(() => {
    if (scannerMode !== "ready") return;
    startHeroScanner();
  }, [scannerMode, startHeroScanner]);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(SCANNER_MODE_KEY, scannerMode);
    } catch {
      // Scanner preference is optional.
    }
  }, [scannerMode]);

  useEffect(() => {
    if (!heroScannerActive) return undefined;

    const timer = window.setTimeout(() => {
      setHeroScannerActive(false);
    }, 30000);

    return () => window.clearTimeout(timer);
  }, [heroScannerActive]);

  const handleDownloadApp = async () => {
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    const isAndroid = /android/i.test(ua);
    if (isAndroid) {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
          setDeferredPrompt(null);
        }
      } else {
        alert("To install the app, please use the 'Add to Home Screen' option in your browser menu.");
      }
    } else {
      window.location.href = LATEST_DESKTOP_RELEASE_URL;
    }
  };

  const isAndroid = typeof navigator !== "undefined" ? /android/i.test(navigator.userAgent || navigator.vendor || window.opera) : false;
  const [centreSort, setCentreSort] = useCentreSort(userLocation);
  const [centrePriceFilter, setCentrePriceFilter] = useState("");
  
  const combinedQuery = (centreSearch + (centrePriceFilter ? ` under ${centrePriceFilter}` : "")).trim();
  const filteredCentres = useMemo(
    () => rankCentres(centres, { orders, userLocation, query: combinedQuery, sortBy: centreSort }),
    [combinedQuery, centres, orders, userLocation, centreSort]
  );

  const mappableCentres = useMemo(
    () => filteredCentres.filter(hasCentreLocation),
    [filteredCentres]
  );

  function openMapForCentre(centreToFocus = null) {
    setMapCentreToFocus(centreToFocus?.id ? centreToFocus : null);
    setMapOpen(true);
  }

  if (currentUser?.role === "hub") {
    return (
      <div className="space-y-6">
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-slate-950">Print Centre Home</h2>
              <p className="mt-1 text-sm text-slate-600">
                Set pricing and manage incoming print orders from one focused screen.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
            <HubDesktopDownload role={currentUser.role} desktopAvailable={desktopAvailable} platform="windows" variant="button" label="Download Windows App" />
            <button
              onClick={() => navigate("hubPricing")}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-4 font-semibold text-white transition hover:bg-slate-800"
            >
              <IndianRupee size={20} />
              Pricing & Payment
            </button>
            </div>
          </div>
        </Card>

        <HubActiveOrdersManager
          currentHub={currentHub}
          hubOrders={hubOrders}
          updateOrderStatus={updateOrderStatus}
          refreshOrders={refreshOrders}
          onOrderSaved={onOrderSaved}
          navigate={navigate}
          compact
        />
      </div>
    );
  }

  return (
    <div className="pe-customer-flow space-y-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)] lg:items-stretch">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className={`pe-home-scan relative isolate flex flex-col justify-between overflow-hidden rounded-lg border p-4 transition sm:p-6 ${
            heroScannerActive ? "border-white/20 bg-transparent text-white" : "bg-white"
          }`}
        >
          <CameraScanLayer active={heroScannerActive} onScan={handleScan} onError={handleHeroScannerError} />
          <div className="pointer-events-none absolute inset-0 z-20 bg-transparent" />
          <div className="relative z-30 space-y-3">
            <h2 className={`font-bold ${heroScannerActive ? "text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]" : "text-slate-950"}`}>
              Print documents securely.
            </h2>
          </div>
          <div className="relative z-30 grid gap-3">
            <button
              onClick={startDirectUpload}
              className={`pe-home-upload flex items-center justify-center gap-3 px-5 py-4 text-lg font-bold transition ${
                heroScannerActive ? "rounded-lg bg-white/90 text-slate-950 hover:bg-white" : "pe-primary-button"
              }`}
            >
              <Upload size={24} className="shrink-0" />
              Upload Documents
            </button>
            <CentreScannerTile
              onScan={handleScan}
              active={(scannerMode === "transparent" || scannerMode === "ready") ? heroScannerActive : false}
              onStart={startSelectedScanner}
              onStop={stopHeroScanner}
              onError={handleHeroScannerError}
              externalCamera
              className="rounded-lg"
              minHeightClass="min-h-[140px]"
              idleLabel={scannerMode === "classic" ? "Classic QR Scanner" : scannerMode === "ready" ? "Ready to Scan" : "Scan / Select Centre"}
              idleHint={heroScannerError || (scannerMode === "classic" ? "Tap to open full scanner." : scannerMode === "ready" ? "Tap to start transparent scanner." : "Tap to show transparent scanner.")}
            />
          <div role="group" aria-label="Scanner mode" className="pe-scanner-modes relative z-40 border border-slate-200 bg-white text-xs font-semibold text-slate-700">
            <button
              type="button"
              aria-pressed={scannerMode === "ready"}
              onClick={() => {
                setScannerMode("ready");
                setHeroScannerActive(false);
              }}
              className={`rounded-full px-3 py-1.5 ${scannerMode === "ready" ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`}
            >
              Ready
            </button>
            <button
              type="button"
              aria-pressed={scannerMode === "transparent"}
              onClick={() => setScannerMode("transparent")}
              className={`rounded-full px-3 py-1.5 ${scannerMode === "transparent" ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`}
            >
              Transparent
            </button>
            <button
              type="button"
              aria-pressed={scannerMode === "classic"}
              onClick={() => {
                setScannerMode("classic");
                setHeroScannerActive(false);
              }}
              className={`rounded-full px-3 py-1.5 ${scannerMode === "classic" ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`}
            >
              Classic
            </button>
          </div>
          </div>
        </motion.section>

        {currentUser ? (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold">Welcome back, {currentUser.name || "PrintEase user"}</h3>
                <p className="mt-1 text-sm text-slate-600">Your recent activity</p>
              </div>
              <button onClick={() => navigate("history")} className="pe-info-link min-h-11 text-sm font-bold hover:underline">
                View All
              </button>
            </div>

            <div className="mt-5 flex gap-4 overflow-x-auto pb-4 pt-2 snap-x hide-scrollbar">
              {(orders || []).length > 0 ? (
                (orders || []).slice(0, 5).map((order) => (
                  <button
                    key={order.id}
                    onClick={() => ["pending", "unpaid"].includes(String(order.status).toLowerCase()) ? navigate("payment") : navigate("track")}
                    className="flex-none snap-start w-[85vw] max-w-[280px] rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-left hover:border-slate-300 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 truncate">{order.document}</p>
                        <p className="mt-1 text-xs text-slate-500">{order.id} · {order.date}</p>
                      </div>
                      <span className={`inline-flex flex-none items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        ["collected", "completed"].includes(String(order.status).toLowerCase())
                          ? "bg-emerald-100 text-emerald-800"
                          : ["cancelled", "failed"].includes(String(order.status).toLowerCase())
                          ? "bg-rose-100 text-rose-800"
                          : "bg-blue-100 text-blue-800"
                      }`}>
                        {(order.status || "Unknown").replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-700">₹{order.amount}</span>
                      <span className="text-slate-500">{order.pages} pages</span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="w-full rounded-2xl border border-dashed bg-slate-50 p-6 text-center text-sm text-slate-500">
                  You don't have any recent print orders.
                </div>
              )}
            </div>
          </Card>
        ) : (
          <Card>
            <h3 className="text-xl font-bold">Login / Register</h3>
            <p className="mt-2 text-sm text-slate-600">Choose your role before login.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button onClick={() => startLogin("user")} className="pe-login-option pe-primary-button p-4 text-left">
                <User className="mb-3" />
                <b>User Login</b>
                <p className="text-sm text-slate-300">For print history and profile.</p>
              </button>
              <button onClick={() => startLogin("hub")} className="pe-login-option pe-primary-button p-4 text-left">
                <Store className="mb-3" />
                <b>Print Centre Login</b>
                <p className="text-sm text-slate-300">For orders, pricing, payment.</p>
              </button>
              <button onClick={() => startRegister("user")} className="pe-login-option border bg-white p-4 text-left hover:bg-slate-50">
                <Plus className="mb-3" />
                <b>Register User</b>
                <p className="text-sm text-slate-500">Username/password account.</p>
              </button>
              <button onClick={() => startRegister("hub")} className="pe-login-option border bg-white p-4 text-left hover:bg-slate-50">
                <Building2 className="mb-3" />
                <b>Register Print Centre</b>
                <p className="text-sm text-slate-500">Create centre code and pricing.</p>
              </button>
            </div>
          </Card>
        )}
      </div>

      <Card className="pe-section">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-2xl font-bold">Available Printing Centres</h3>
            <p className="text-sm text-slate-600">Select a centre directly and upload your document.</p>
          </div>
          <div className="pe-centre-filters lg:flex-1 lg:max-w-2xl">
            <CentreSearchField value={centreSearch} onChange={setCentreSearch} label="Search printing centres" placeholder="Search name, code, area..." resultsId="home-centre-results" />
            <select
              value={centrePriceFilter}
              aria-label="Filter centres by price"
              onChange={(e) => setCentrePriceFilter(e.target.value)}
              className="shrink-0 rounded-2xl border bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-slate-300"
            >
              <option value="">Any Price</option>
              <option value="2">Under ₹2</option>
              <option value="3">Under ₹3</option>
              <option value="5">Under ₹5</option>
            </select>
            <CentreSortControl value={centreSort} onChange={setCentreSort} userLocation={userLocation} />
          </div>
        </div>

        <div className="mt-4 sm:max-w-lg">
          <CentreLocationActions userLocation={userLocation} status={userLocationStatus} onLocate={requestUserLocation} onOpenMap={() => openMapForCentre()} hasMap={mappableCentres.length > 0} />
        </div>
        <p role="status" className="mt-3 text-sm text-slate-600">{filteredCentres.length} centres · {centreSortLabel(centreSort)}{filteredCentres.some(centre => centre.searchScore > 0) ? " · Similar names included" : ""}</p>
        <div id="home-centre-results" className="mt-4 grid gap-4 md:grid-cols-2">
          {filteredCentres.map((centre) => (
            <CentrePriceCard
              key={centre.id}
              centre={centre}
              onUpload={() => selectCentreAndUpload(centre)}
              onOpenMap={openMapForCentre}
            />
          ))}
          {filteredCentres.length === 0 && (
            <div className="rounded-2xl border border-dashed bg-slate-50 p-6 text-center text-sm text-slate-500 md:col-span-2">
              No centre matches this search. Try the centre code or shop name.
            </div>
          )}
        </div>
      </Card>

      {scannerOpen && (
        <QRScanner onScan={handleScan} onClose={stopScanner} />
      )}

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
