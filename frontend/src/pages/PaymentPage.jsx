import { useEffect, useMemo, useRef, useState } from "react";
import { Clock, CircleX } from "lucide-react";
import Card from "../components/Card";
import CheckoutSummary from "../components/payment/CheckoutSummary";
import { buildPaymentPriceFromOrder } from "../utils/paymentOrderPricing";
import { useBottomBarInset } from "../hooks/useBottomBarInset";

function formatCurrency(value) {
  const num = Number(value);
  if (isNaN(num) || num <= 0) return "Pending";
  return `₹${num.toFixed(2)}`;
}

function normalizeStatus(value) {
  return String(value || "").toLowerCase().replace(/[\s-]+/g, "_");
}

function hasPendingPricing(price, order) {
  const rawStatus = normalizeStatus(order?.rawStatus || order?.status);
  if (rawStatus === "cancelled") return false;
  if (rawStatus === "bill_confirmed") return false;

  const billStatus = normalizeStatus(order?.billStatus || order?.bill_status);
  const snapshot = order?.priceSnapshot || order?.price_snapshot || {};
  const files = Array.isArray(price?.files)
    ? price.files
    : Array.isArray(snapshot?.breakdown)
      ? snapshot.breakdown
      : [];

  return Boolean(
    price?.pricingPending ||
    order?.pricingPending ||
    snapshot?.pricingPending ||
    rawStatus === "awaiting_hub_bill_confirmation" ||
    billStatus === "awaiting_hub_confirmation" ||
    files.some((file) => file?.pricingPending || file?.reasonCode === "DESKTOP_PREPARATION_PENDING")
  );
}

export default function PaymentPage({
  currentUser,
  startLogin,
  selectedCentre,
  documentName,
  pages,
  copies,
  backendPrice,
  order,
  refreshActivePaymentOrder,
  handlePayment,
  paymentLoading,
  paymentError,
}) {
  const [liveOrder, setLiveOrder] = useState(order);
  const [livePrice, setLivePrice] = useState(backendPrice);
  const [refreshError, setRefreshError] = useState("");
  const [refreshingBill, setRefreshingBill] = useState(false);

  useEffect(() => {
    setLiveOrder(order);
  }, [order]);

  useEffect(() => {
    setLivePrice(backendPrice);
  }, [backendPrice]);

  const effectiveOrder = liveOrder || order;
  const effectivePrice = useMemo(
    () => buildPaymentPriceFromOrder(effectiveOrder, livePrice || backendPrice),
    [backendPrice, effectiveOrder, livePrice]
  );
  const isPricingPending = hasPendingPricing(effectivePrice, effectiveOrder);
  const amount = isPricingPending ? null : (effectivePrice?.totalAmount ?? effectiveOrder?.amount ?? null);
  const selectedPageCount = Number(effectivePrice?.selectedPageCount || effectiveOrder?.selectedPageCount || pages || 0);
  const centreUpi = selectedCentre?.upiId || "";
  const upiQrUrl = selectedCentre?.upiQrImageUrl || "";
  const isCancelled = normalizeStatus(effectiveOrder?.rawStatus || effectiveOrder?.status) === "cancelled";
  const { contentRef, barRef } = useBottomBarInset(!isCancelled);
  const cancellationReason = effectiveOrder?.priceSnapshot?.message || effectiveOrder?.price_snapshot?.message || null;
  const failedDocument = Array.isArray(effectiveOrder?.documents) ? effectiveOrder.documents.find((document) => (
    document?.preparationStatus === "failed" || document?.preparation_status === "failed"
  )) : null;
  const conversionFailed = Boolean(failedDocument);
  const conversionFailedMessage =
    failedDocument?.preparationErrorMessage ||
    failedDocument?.preparation_error_message ||
    "This document could not be prepared. Save it as a PDF and upload it again.";
  const displayValue = (value) => (isPricingPending ? "Pending" : (value || value === 0 ? value : "Pending"));
  const displayMoney = (value) => (isPricingPending ? "Pending" : formatCurrency(value));

  const refreshFnRef = useRef(refreshActivePaymentOrder);
  useEffect(() => {
    refreshFnRef.current = refreshActivePaymentOrder;
  }, [refreshActivePaymentOrder]);

  useEffect(() => {
    if (!effectiveOrder?.backendId || !isPricingPending || conversionFailed) return;

    let cancelled = false;

    async function refreshBill() {
      setRefreshingBill(true);
      try {
        const refreshed = await refreshFnRef.current(effectiveOrder.backendId);
        if (cancelled || !refreshed) return;
        if (refreshed.order) setLiveOrder(refreshed.order);
        if (refreshed.price) setLivePrice(refreshed.price);
        setRefreshError("");
      } catch (error) {
        if (!cancelled) setRefreshError(error.message || "Could not refresh the converted bill yet.");
      } finally {
        if (!cancelled) setRefreshingBill(false);
      }
    }

    refreshBill();
    const interval = window.setInterval(refreshBill, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [conversionFailed, effectiveOrder?.backendId, isPricingPending]);

  const handlePaymentClick = () => {
    const printablePages = effectivePrice?.printablePageCount || (selectedPageCount * (copies || 1));
    if (!currentUser && printablePages > 5) {
      startLogin("user");
      return;
    }
    handlePayment();
  };

  const buttonLabel = isPricingPending
    ? "Preparing verified bill..."
    : `Request Payment · ${formatCurrency(amount)}`;
  const loadingLabel = "Creating request...";

  const isDisabled = paymentLoading || isPricingPending || !amount || amount <= 0 || isCancelled;

  if (isCancelled) {
    return (
      <div className="mx-auto max-w-2xl pb-6 sm:pb-8">
        <Card className="p-6 border-red-200 bg-red-50 text-center">
          <div className="mx-auto w-12 h-12 flex items-center justify-center rounded-full bg-red-100 text-red-600 mb-4">
            <CircleX size={24} />
          </div>
          <h2 className="text-xl font-bold text-red-900">Order Cancelled</h2>
          <p className="mt-2 text-red-700 max-w-md mx-auto">
            {cancellationReason || "This order was cancelled by the printing hub."}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div ref={contentRef} className="pe-customer-flow pe-payment mx-auto">
      <Card className="p-4 sm:p-6">
        <h2 className="text-xl sm:text-2xl font-bold min-w-0">Payment</h2>
        <CheckoutSummary centreName={selectedCentre?.name} documentName={documentName} pages={pages} copies={copies} price={effectivePrice} amount={amount} displayMoney={displayMoney} displayValue={displayValue} />

        <div className="mt-5 border-b pb-3">
          <p className="font-semibold">Cash or centre UPI</p>
          <p className="mt-1 text-sm text-slate-600">Request payment, then pay the centre directly.</p>
        </div>

        {(centreUpi || upiQrUrl) && <div className="mt-4 border-t pt-4">
          {centreUpi && <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
            <div className="min-w-0">
              <p className="font-semibold">UPI ID</p>
              <p className="mt-1 break-words text-sm text-slate-600">{centreUpi}</p>
            </div>
          </div>}

          {upiQrUrl && (
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-center">
              <img src={upiQrUrl} alt="Centre UPI QR" className="mx-auto h-48 w-48 object-contain" />
              <p className="mt-2 text-sm text-slate-500">Centre payment QR</p>
            </div>
          )}
        </div>}

        {/* Warning notice */}
        <p className="pe-manual-payment-notice mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Your request stays pending until the centre confirms payment.
        </p>

        {/* Validation: zero amount */}
        {conversionFailed && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            <p className="font-bold">Conversion Failed</p>
            <p className="mt-1">{conversionFailedMessage}</p>
          </div>
        )}

        {isPricingPending && !conversionFailed && !paymentLoading && (
          <p role="status" className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
            {refreshingBill
              ? "Preparing your documents and final price..."
              : "Your final price will update automatically when document preparation finishes."}
          </p>
        )}

        {refreshError && isPricingPending && !conversionFailed && (
          <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            {refreshError}
          </p>
        )}

        {amount <= 0 && !isPricingPending && !paymentLoading && (
          <p className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-700">
            The order price is unavailable. Please check your print settings and try again.
          </p>
        )}

        {/* Error display */}
        {paymentError && (
          <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {paymentError}
          </p>
        )}
      </Card>

      {/* Floating Action Bar */}
      <div ref={barRef} className="pe-payment-actions fixed inset-x-0 z-40 border-t bg-white md:static md:z-auto md:mt-6 md:block md:border-0 md:bg-transparent md:p-0">
        <button
          disabled={isDisabled || conversionFailed}
          onClick={handlePaymentClick}
          className="pe-primary-button flex w-full items-center justify-center gap-2 px-3 py-3 transition disabled:cursor-not-allowed sm:px-4"
        >
          <Clock size={18} className="shrink-0" /> <span className="break-words">{paymentLoading ? loadingLabel : buttonLabel}</span>
        </button>
      </div>
    </div>
  );
}
