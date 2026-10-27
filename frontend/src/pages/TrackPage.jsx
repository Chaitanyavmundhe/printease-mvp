import { CheckCircle, Clock, XCircle } from "lucide-react";
import Card from "../components/Card";
import Row from "../components/Row";

const orderStatuses = [
  "Preparing Bill",
  "Bill Ready",
  "Payment Requested",
  "Payment Collected",
  "Queued for Printing",
  "Printing",
  "Completed",
];

const statusMap = {
  draft_uploaded: "Draft Uploaded",
  awaiting_hub_bill_confirmation: "Preparing Bill",
  bill_confirmed: "Bill Ready",
  payment_requested: "Payment Requested",
  payment_collected: "Payment Collected",
  queued_for_print: "Queued for Printing",
  printing: "Printing",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

function normalizeStatus(status) {
  if (!status) return "";

  const key = String(status).trim().toLowerCase().replace(/\s+/g, "_");
  return statusMap[key] || status;
}

function isPaymentPending(order) {
  return !["verified", "collected", "paid"].includes(String(order?.paymentStatus || "").toLowerCase());
}



export default function TrackPage({
  order,
  lastUpdatedAt,
  pendingPayment,
  centreUpiId,
  centreUpiQrImageUrl,
  onRequestPayment,
  paymentError,
}) {
  if (!order) return <Card>No active order found.</Card>;

  const currentStatus = normalizeStatus(order.status);
  const activeIndex = orderStatuses.indexOf(currentStatus);
  const paymentPending = isPaymentPending(order);
  const isCancelled = String(order.status).toLowerCase() === "cancelled";
  const centreQrImageUrl = centreUpiQrImageUrl;

  return (
    <Card className="mx-auto max-w-2xl p-4 sm:p-6">
      <h2 className="text-2xl font-bold min-w-0">Order Tracking</h2>
      {lastUpdatedAt && <p className="mt-1 text-xs text-slate-500">Last updated: {new Date(lastUpdatedAt).toLocaleTimeString()}</p>}
      <div className="mt-4 rounded-2xl bg-slate-50 p-4">
        <Row label="Order ID" value={order.id} />
        <Row label="Centre" value={order.centre} />
        <Row label="Document" value={order.document} />
        <Row label="Copies" value={order.copies || order.printConfigSnapshot?.copies || 1} />
        <Row label="Color" value={String(order.printConfigSnapshot?.colorMode || order.colorType).toLowerCase() === 'color' ? 'Color' : 'Black & White'} />
        <Row label="Sides" value={String(order.printConfigSnapshot?.sides || order.sideType).toLowerCase().includes('double') || String(order.printConfigSnapshot?.sides || order.sideType).toLowerCase().includes('two') ? 'Double-sided' : 'Single-sided'} />
        <Row label={paymentPending ? "Amount Due" : "Amount Paid"} value={"₹" + order.amount} />
        <Row label="Payment" value={order.paymentStatus || "Pending"} />
        <Row label="Pickup Code" value={order.pickupCode} />
        {activeIndex === -1 && <Row label="Current Status" value={order.status || "Unknown"} />}
      </div>

      {isCancelled && (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 text-rose-600" size={20} />
            <div>
              <p className="font-semibold text-rose-700">Order Cancelled</p>
              <p className="mt-1">{order?.priceSnapshot?.message || order?.price_snapshot?.message || "This order was cancelled. Please check with the printing centre for details or register a new print job."}</p>
            </div>
          </div>
        </div>
      )}



      {paymentPending && !isCancelled && (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5" size={20} />
            <div>
              <p className="font-semibold">{String(order.paymentStatus).toLowerCase() === "requested" ? "Payment request pending" : "Payment not yet collected"}</p>
              <p className="mt-1">Pay cash or use the centre UPI. Only the print centre can confirm receipt; creating a request does not mark payment collected.</p>
              {pendingPayment?.createdAt && <p className="mt-2 text-xs">Request opened: {new Date(pendingPayment.createdAt).toLocaleString()}</p>}
            </div>
          </div>

          {onRequestPayment && String(order.paymentStatus).toLowerCase() !== "requested" && (
            <button type="button" onClick={onRequestPayment}
              className="mt-4 rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white">
              Request Payment
            </button>
          )}

          <div className="mt-4 rounded-2xl border bg-white p-4">
            <p className="font-semibold">Centre UPI</p>
            <p className="mt-1 break-all text-slate-700">{centreUpiId || "UPI ID not added by this centre."}</p>
            {centreQrImageUrl && (
              <div className="mt-4 text-center">
                <img src={centreQrImageUrl} alt="Centre UPI QR" className="mx-auto h-48 w-48 object-contain" />
                <p className="mt-2 text-xs text-slate-500">Scan and pay, then ask the hub to confirm payment collected.</p>
              </div>
            )}
          </div>

          {paymentError && <p className="mt-3 font-semibold text-rose-700">{paymentError}</p>}
        </div>
      )}

      {!paymentPending && !isCancelled && (
        <p className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
          Payment completed. Print job queued/sent to desktop agent when an online printer is available.
        </p>
      )}

      <div className="mt-6 space-y-4">
        {orderStatuses.map((status, index) => (
          <div key={status} className="flex items-center gap-4 rounded-2xl border p-4 sm:p-5 shadow-sm transition-shadow hover:shadow-md">
            <CheckCircle className={activeIndex >= 0 && index <= activeIndex ? "text-green-600" : "text-slate-300"} />
            <span className={activeIndex >= 0 && index <= activeIndex ? "font-bold text-green-700" : "text-slate-500"}>{status}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
