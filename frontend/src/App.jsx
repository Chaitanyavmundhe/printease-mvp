import { useEffect, useMemo, useState } from "react";
import Navbar from "./components/Navbar";
import BackendStatus from "./components/BackendStatus";
import HomePage from "./pages/HomePage";
import AuthPage from "./pages/AuthPage";
import UserDashboard from "./pages/UserDashboard";
import HubDashboard from "./pages/HubDashboard";
import HubPricingPage from "./pages/HubPricingPage";
import CentreCodePage from "./pages/CentreCodePage";
import UploadPage from "./pages/UploadPage";
import PaymentPage from "./pages/PaymentPage";
import TrackPage from "./pages/TrackPage";
import HistoryPage from "./pages/HistoryPage";
import { initialCentres, initialOrders } from "./data/demoData";
import { calculateTotalAmount, getPricePerPage } from "./utils/price";
import { apiRequest } from "./services/api";

function formatStatus(status) {
  if (!status) return "Available";
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

function normalizeCentre(centre) {
  const pricing = centre.pricing || {};

  return {
    id: centre.id,
    ownerId: centre.ownerId,
    code: centre.centreCode || centre.code,
    name: centre.name || centre.hubName,
    owner: centre.owner || "Hub Owner",
    mobile: centre.mobile || "",
    status: formatStatus(centre.status),
    upiId: centre.upiId || "",
    bwSingle: pricing.bwSingle ?? centre.bwSingle ?? 1,
    bwDouble: pricing.bwDouble ?? centre.bwDouble ?? 1.5,
    colorSingle: pricing.colorSingle ?? centre.colorSingle ?? 2,
    colorDouble: pricing.colorDouble ?? centre.colorDouble ?? 3,
    watermarkCharge: pricing.watermarkCharge ?? centre.watermarkCharge ?? 2,
  };
}

function upsertCentre(centreList, centre) {
  if (!centre) return centreList;

  const nextCentre = normalizeCentre(centre);
  const existingIndex = centreList.findIndex((item) => item.id === nextCentre.id || item.code === nextCentre.code);

  if (existingIndex === -1) return [...centreList, nextCentre];

  return centreList.map((item, index) => (index === existingIndex ? nextCentre : item));
}

function toFrontendRole(role) {
  return role === "centre" ? "hub" : role;
}

function findCentreForUser(user, centreList, responseCentre) {
  if (responseCentre) return normalizeCentre(responseCentre);

  return centreList.find((centre) => centre.id === user.centreId || centre.ownerId === user.id);
}

function toCurrentUser(user, centre) {
  const role = toFrontendRole(user.role);
  const hubId = user.hubId || user.centreId || centre?.id || null;

  return {
    id: user.id,
    role,
    name: user.name,
    mobile: user.mobile,
    centreId: hubId,
    hubId,
    hubName: user.hubName || centre?.name || null,
    centreCode: user.centreCode || centre?.code || null,
    hubCode: role === "hub" ? user.centreCode || centre?.code : undefined,
  };
}

function toDisplayLabel(value) {
  if (!value) return "";
  return String(value)
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function formatOrderDate(value) {
  if (!value || value === "Today") return value || "Today";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function normalizeOrder(order, centreList = []) {
  const centreId = order.centreId || order.centre_id;
  const centreCodeFromOrder = order.centreCode || order.centre_code;
  const centre = centreList.find((item) => item.id === centreId || item.code === centreCodeFromOrder);
  const orderCode = order.orderCode || order.order_code || order.id;

  return {
    id: orderCode,
    backendId: order.backendId || order.id,
    centreId: centreId || centre?.id,
    centreCode: centreCodeFromOrder || centre?.code || "",
    centre: order.centre || centre?.name || "Selected centre",
    document: order.documentName || order.document_name || order.document || "Uploaded Document",
    pages: Number(order.pages || 1),
    copies: Number(order.copies || 1),
    amount: Number(order.amount || 0),
    status: toDisplayLabel(order.status || "Payment Pending"),
    date: formatOrderDate(order.createdAt || order.created_at || order.date),
    paymentStatus: toDisplayLabel(order.paymentStatus || order.payment_status || "Pending"),
    pickupCode: order.pickupCode || order.pickup_code || "",
  };
}

function upsertOrder(orderList, nextOrder) {
  const existingIndex = orderList.findIndex((item) => item.id === nextOrder.id || item.backendId === nextOrder.backendId);

  if (existingIndex === -1) return [nextOrder, ...orderList];

  return orderList.map((item, index) => (index === existingIndex ? nextOrder : item));
}

export default function App() {
  const [page, setPage] = useState("home");
  const [profileOpen, setProfileOpen] = useState(false);
  const [authRole, setAuthRole] = useState("user");
  const [authMode, setAuthMode] = useState("login");
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem("printease_user");

    if (!savedUser) return null;

    try {
      return JSON.parse(savedUser);
    } catch (error) {
      localStorage.removeItem("printease_user");
      localStorage.removeItem("printease_token");
      return null;
    }
  });
  const [postAuthRedirect, setPostAuthRedirect] = useState(null);
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [hubName, setHubName] = useState("");
  const [hubCode, setHubCode] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [centreCode, setCentreCode] = useState("");
  const [centreLookupLoading, setCentreLookupLoading] = useState(false);
  const [centreLookupError, setCentreLookupError] = useState("");
  const [selectedCentre, setSelectedCentre] = useState(null);
  const [documentFile, setDocumentFile] = useState(null);
  const [documentName, setDocumentName] = useState("");
  const [pages, setPages] = useState(1);
  const [copies, setCopies] = useState(1);
  const [colorType, setColorType] = useState("bw");
  const [sideType, setSideType] = useState("single");
  const [watermark, setWatermark] = useState(false);
  const [order, setOrder] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  const [centres, setCentres] = useState(initialCentres);
  const [orders, setOrders] = useState(initialOrders);

  useEffect(() => {
    let ignore = false;

    apiRequest("/api/centres")
      .then((data) => {
        if (!ignore && Array.isArray(data.centres)) {
          setCentres(data.centres.map(normalizeCentre));
        }
      })
      .catch(() => {
        // Keep demo centres visible if the production API is temporarily unavailable.
      });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    async function restoreSession() {
      const token = localStorage.getItem("printease_token");

      if (!token) return;

      try {
        const data = await apiRequest("/api/auth/me");

        if (!data || !data.user) throw new Error("Invalid session response");

        const signedInRole = toFrontendRole(data.user.role);
        let signedInCentre = findCentreForUser(data.user, centres, data.centre);

        if (signedInRole === "hub" && !signedInCentre) {
          const freshCentres = await refreshCentres();
          signedInCentre = findCentreForUser(data.user, freshCentres);
        }

        if (signedInRole === "hub" && !signedInCentre) {
          localStorage.removeItem("printease_token");
          localStorage.removeItem("printease_user");
          setCurrentUser(null);
          return;
        }

        const nextUser = toCurrentUser(data.user, signedInCentre);
        const nextCentres = signedInCentre ? upsertCentre(centres, signedInCentre) : centres;

        if (signedInCentre) setCentres((prev) => upsertCentre(prev, signedInCentre));

        localStorage.setItem("printease_user", JSON.stringify(nextUser));
        setCurrentUser(nextUser);
        await loadOrdersForSession(nextUser, nextCentres);
      } catch (error) {
        console.error("Session restore failed:", error?.message || error);

        localStorage.removeItem("printease_token");
        localStorage.removeItem("printease_user");
        setCurrentUser(null);
      }
    }

    restoreSession();
  }, []);

  const pricePerPage = useMemo(
    () => getPricePerPage(selectedCentre, colorType, sideType),
    [selectedCentre, colorType, sideType]
  );

  const totalAmount = useMemo(
    () =>
      calculateTotalAmount({
        pages,
        copies,
        pricePerPage,
        watermark,
        watermarkCharge: selectedCentre?.watermarkCharge,
      }),
    [pages, copies, pricePerPage, watermark, selectedCentre?.watermarkCharge]
  );

  const currentHub = useMemo(() => {
    if (!currentUser || currentUser.role !== "hub") return null;
    return (
      centres.find(
        (centre) =>
          centre.id === currentUser.hubId ||
          centre.id === currentUser.centreId ||
          centre.code === currentUser.hubCode ||
          centre.code === currentUser.centreCode
      ) || null
    );
  }, [currentUser, centres]);

  const hubOrders = useMemo(() => {
    if (!currentHub) return [];
    return orders.filter((item) => item.centreCode === currentHub.code || item.centreId === currentHub.id);
  }, [orders, currentHub]);

  function navigate(nextPage) {
    setPage(nextPage);
    setProfileOpen(false);
  }

  function startLogin(role) {
    if (page !== "payment") setPostAuthRedirect(null);
    setAuthRole(role);
    setAuthMode("login");
    setAuthError("");
    navigate("auth");
  }

  function startRegister(role) {
    setPostAuthRedirect(null);
    setAuthRole(role);
    setAuthMode("register");
    setAuthError("");
    navigate("auth");
  }

  function changeAuthRole(role) {
    setAuthRole(role);
    setAuthError("");
  }

  function changeAuthMode(mode) {
    setAuthMode(mode);
    setAuthError("");
  }

  async function refreshCentres() {
    const data = await apiRequest("/api/centres");
    const nextCentres = Array.isArray(data.centres) ? data.centres.map(normalizeCentre) : [];
    setCentres(nextCentres);
    return nextCentres;
  }

  async function loadOrdersForSession(user = currentUser, centreList = centres) {
    if (!user) return [];

    try {
      const data = await apiRequest(user.role === "hub" ? "/api/orders/centre/mine" : "/api/orders/mine");
      const nextOrders = Array.isArray(data.orders) ? data.orders.map((item) => normalizeOrder(item, centreList)) : [];
      setOrders(nextOrders);
      return nextOrders;
    } catch (error) {
      return [];
    }
  }

  async function handleAuthSubmit() {
    const trimmedMobile = mobile.trim();
    const trimmedName = name.trim();
    const trimmedHubName = hubName.trim();
    const trimmedHubCode = hubCode.trim();

    setAuthError("");

    if (!/^\d{10}$/.test(trimmedMobile)) {
      setAuthError("Enter a valid 10 digit mobile number.");
      return;
    }

    if (!password) {
      setAuthError("Enter your password.");
      return;
    }

    if (authMode === "register" && !trimmedName) {
      setAuthError("Enter your name.");
      return;
    }

    setAuthLoading(true);

    try {
      if (authMode === "register" && authRole === "user") {
        const data = await apiRequest("/api/auth/register-user", {
          method: "POST",
          body: JSON.stringify({ name: trimmedName, mobile: trimmedMobile, password }),
        });

        const nextUser = toCurrentUser(data.user);
        localStorage.setItem("printease_token", data.token);
        localStorage.setItem("printease_user", JSON.stringify(nextUser));
        setCurrentUser(nextUser);
        await loadOrdersForSession(nextUser);
        navigate("userDashboard");
        return;
      }

      if (authMode === "register") {
        if (!trimmedHubName) {
          setAuthError("Enter print hub name.");
          return;
        }

        if (!trimmedHubCode) {
          setAuthError("Enter centre code.");
          return;
        }

        const data = await apiRequest("/api/auth/register-hub", {
          method: "POST",
          body: JSON.stringify({
            ownerName: trimmedName,
            mobile: trimmedMobile,
            password,
            hubName: trimmedHubName,
            centreCode: trimmedHubCode,
          }),
        });

        const centre = normalizeCentre(data.centre);
        const nextUser = toCurrentUser(data.user, centre);
        const nextCentres = upsertCentre(centres, centre);
        localStorage.setItem("printease_token", data.token);
        localStorage.setItem("printease_user", JSON.stringify(nextUser));
        setCentres((prev) => upsertCentre(prev, centre));
        setCurrentUser(nextUser);
        await loadOrdersForSession(nextUser, nextCentres);
        navigate("hubDashboard");
        return;
      }

      const data = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ mobile: trimmedMobile, password }),
      });

      const signedInRole = toFrontendRole(data.user.role);
      if (signedInRole !== authRole) {
        setAuthError(`This account is registered as ${signedInRole === "hub" ? "a print hub" : "a user"}. Switch the role and try again.`);
        return;
      }

      let signedInCentre = findCentreForUser(data.user, centres, data.centre);

      if (signedInRole === "hub" && !signedInCentre) {
        const freshCentres = await refreshCentres();
        signedInCentre = findCentreForUser(data.user, freshCentres);
      }

      if (signedInRole === "hub" && !signedInCentre) {
        setAuthError("No print hub is linked to this account.");
        return;
      }

      localStorage.setItem("printease_token", data.token);
      const nextUser = toCurrentUser(data.user, signedInCentre);
      localStorage.setItem("printease_user", JSON.stringify(nextUser));
      const nextCentres = signedInCentre ? upsertCentre(centres, signedInCentre) : centres;
      if (signedInCentre) setCentres((prev) => upsertCentre(prev, signedInCentre));
      setCurrentUser(nextUser);
      await loadOrdersForSession(nextUser, nextCentres);
      const destination = postAuthRedirect || (signedInRole === "hub" ? "hubDashboard" : "userDashboard");
      setPostAuthRedirect(null);
      if (destination === "payment") setPaymentError("");
      navigate(destination);
    } catch (error) {
      setAuthError(error.message || "Authentication failed. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("printease_token");
    localStorage.removeItem("printease_user");
    setCurrentUser(null);
    setPostAuthRedirect(null);
    setDocumentFile(null);
    navigate("home");
  }

  async function handleCentreCode() {
    const code = centreCode.trim();
    setCentreLookupError("");

    if (!code) {
      setCentreLookupError("Enter a centre code.");
      return;
    }

    const localCentre = centres.find((c) => c.code === code);
    if (localCentre) {
      setSelectedCentre(localCentre);
      navigate("upload");
      return;
    }

    setCentreLookupLoading(true);

    try {
      const data = await apiRequest(`/api/centres/${encodeURIComponent(code)}`);
      const centre = normalizeCentre(data.centre);
      setCentres((prev) => upsertCentre(prev, centre));
      setSelectedCentre(centre);
      navigate("upload");
    } catch (error) {
      setCentreLookupError(error.message || "Centre not found.");
    } finally {
      setCentreLookupLoading(false);
    }
  }

  function startDirectUpload() {
    setSelectedCentre(null);
    setPaymentError("");
    navigate("upload");
  }

  function selectCentreAndUpload(centre) {
    setSelectedCentre(centre);
    setPaymentError("");
    navigate("upload");
  }

  async function handlePayment() {
    if (!selectedCentre) {
      setPaymentError("Please select a printing centre first.");
      navigate("centre");
      return;
    }

    if (!documentFile) {
      setPaymentError("Please upload a PDF, PNG, or JPG document first.");
      navigate("upload");
      return;
    }

    if (!currentUser) {
      setPaymentError("Please login before payment.");
      setPostAuthRedirect("payment");
      startLogin("user");
      return;
    }

    setPaymentLoading(true);
    setPaymentError("");

    try {
      const formData = new FormData();
      formData.append("document", documentFile);

      const uploadData = await apiRequest("/api/uploads", {
        method: "POST",
        body: formData,
      });

      const orderData = await apiRequest("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          centreCode: selectedCentre.code,
          documentId: uploadData.document?.id,
          documentName: uploadData.document?.fileName || documentName || documentFile.name,
          pages,
          copies,
          colorType,
          sideType,
          watermarkEnabled: watermark,
        }),
      });

      const paymentData = await apiRequest("/api/payments/create", {
        method: "POST",
        body: JSON.stringify({ orderId: orderData.order.id }),
      });

      const verifiedData = await apiRequest("/api/payments/verify-demo", {
        method: "POST",
        body: JSON.stringify({ paymentId: paymentData.payment.id, demoSuccess: true }),
      });

      const nextOrder = normalizeOrder(verifiedData.order || orderData.order, centres);
      setOrder(nextOrder);
      setOrders((prev) => upsertOrder(prev, nextOrder));
      setDocumentFile(null);
      navigate("track");
    } catch (error) {
      setPaymentError(error.message || "Could not upload document and create order.");
    } finally {
      setPaymentLoading(false);
    }
  }

  async function updateOrderStatus(orderId, nextStatus) {
    const existingOrder = orders.find((item) => item.id === orderId || item.backendId === orderId);

    try {
      if (existingOrder?.backendId) {
        const data = await apiRequest(`/api/orders/${existingOrder.backendId}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: nextStatus }),
        });
        const savedOrder = normalizeOrder(data.order, centres);
        setOrders((prev) => upsertOrder(prev, savedOrder));
        if (order?.id === orderId || order?.backendId === existingOrder.backendId) setOrder(savedOrder);
        return;
      }
    } catch (error) {
      alert(error.message || "Could not update order status.");
      return;
    }

    setOrders((prev) => prev.map((item) => (item.id === orderId ? { ...item, status: nextStatus } : item)));
    if (order?.id === orderId) setOrder((prev) => ({ ...prev, status: nextStatus }));
  }

  async function updateCentrePrice(field, value) {
    if (!currentHub) return;

    try {
      const data = await apiRequest("/api/centres/me/pricing", {
        method: "PATCH",
        body: JSON.stringify({ [field]: Number(value) }),
      });
      const centre = normalizeCentre(data.centre);
      setCentres((prev) => upsertCentre(prev, centre));
    } catch (error) {
      alert(error.message || "Could not update pricing.");
    }
  }

  async function updateCentrePayment(field, value) {
    if (!currentHub) return;

    try {
      const data = await apiRequest("/api/centres/me/payment-method", {
        method: "PATCH",
        body: JSON.stringify({ [field]: value }),
      });
      const centre = normalizeCentre(data.centre);
      setCentres((prev) => upsertCentre(prev, centre));
    } catch (error) {
      alert(error.message || "Could not update payment method.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar
        page={page}
        navigate={navigate}
        profileOpen={profileOpen}
        setProfileOpen={setProfileOpen}
        currentUser={currentUser}
        startLogin={startLogin}
        startRegister={startRegister}
        logout={logout}
      />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <BackendStatus />

        {page === "home" && (
          <HomePage
            navigate={navigate}
            centres={centres}
            startLogin={startLogin}
            startRegister={startRegister}
            startDirectUpload={startDirectUpload}
            selectCentreAndUpload={selectCentreAndUpload}
          />
        )}

        {page === "auth" && (
          <AuthPage
            authRole={authRole}
            setAuthRole={changeAuthRole}
            authMode={authMode}
            setAuthMode={changeAuthMode}
            mobile={mobile}
            setMobile={setMobile}
            password={password}
            setPassword={setPassword}
            name={name}
            setName={setName}
            hubName={hubName}
            setHubName={setHubName}
            hubCode={hubCode}
            setHubCode={setHubCode}
            handleAuthSubmit={handleAuthSubmit}
            authError={authError}
            authLoading={authLoading}
          />
        )}

        {page === "userDashboard" && <UserDashboard currentUser={currentUser} navigate={navigate} orders={orders} />}
        {page === "hubDashboard" && <HubDashboard currentHub={currentHub} hubOrders={hubOrders} updateOrderStatus={updateOrderStatus} navigate={navigate} />}
        {page === "hubPricing" && <HubPricingPage currentHub={currentHub} updateCentrePrice={updateCentrePrice} updateCentrePayment={updateCentrePayment} />}
        {page === "centre" && <CentreCodePage centreCode={centreCode} setCentreCode={setCentreCode} handleCentreCode={handleCentreCode} centres={centres} selectCentreAndUpload={selectCentreAndUpload} lookupLoading={centreLookupLoading} lookupError={centreLookupError} />}
        {page === "upload" && <UploadPage selectedCentre={selectedCentre} documentFile={documentFile} setDocumentFile={setDocumentFile} documentName={documentName} setDocumentName={setDocumentName} pages={pages} setPages={setPages} copies={copies} setCopies={setCopies} colorType={colorType} setColorType={setColorType} sideType={sideType} setSideType={setSideType} watermark={watermark} setWatermark={setWatermark} totalAmount={totalAmount} paymentError={paymentError} navigate={navigate} />}
        {page === "payment" && <PaymentPage selectedCentre={selectedCentre} documentName={documentName} pages={pages} copies={copies} totalAmount={totalAmount} handlePayment={handlePayment} paymentLoading={paymentLoading} paymentError={paymentError} />}
        {page === "track" && <TrackPage order={order} />}
        {page === "history" && <HistoryPage orders={orders} currentUser={currentUser} />}
      </main>
    </div>
  );
}
