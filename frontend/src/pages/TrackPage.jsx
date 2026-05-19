import { CheckCircle, CreditCard } from "lucide-react";
import Card from "../components/Card";
import Row from "../components/Row";

const orderStatuses = [
  "Payment Pending",
  "Payment Verified",
  "Accepted by Centre",
  "Queued for Printing",
  "Sent to Agent",
  "Printing",
  "Ready for Pickup",
  "Collected",
];

const statusMap = {
  payment_pending: "Payment Pending",
  pending: "Payment Pending",
  payment_verified: "Payment Verified",
  verified: "Payment Verified",
  accepted: "Accepted by Centre",
  accepted_by_centre: "Accepted by Centre",
  queued_for_printing: "Queued for Printing",
  sent_to_agent: "Sent to Agent",
  printing: "Printing",
  printing_failed: "Printing Failed",
  ready: "Ready for Pickup",
  ready_for_pickup: "Ready for Pickup",
  collected: "Collected",
};

function normalizeStatus(status) {
  if (!status) return "";

  const key = String(status).trim().toLowerCase().replace(/\s+/g, "_");
  return statusMap[key] || status;
}

function isPaymentPending(order) {
  const value = String(order?.paymentStatus || "").toLowerCase();
  return value === "pending" || value === "unpaid" || !value;
}

export default function TrackPage({ order, lastUpdatedAt, pendingPayment, onSimulateVerifiedPayment, paymentLoading, paymentError }) {
  if (!order) return <Card>No active order found.</Card>;

  const currentStatus = normalizeStatus(order.status);
  const activeIndex = orderStatuses.indexOf(currentStatus);
  const paymentPending = isPaymentPending(order);

  return (
    <Card className="mx-auto max-w-2xl">
      <h2 className="text-2xl font-bold">Order Tracking</h2>
      {lastUpdatedAt && <p className="mt-1 text-xs text-slate-500">Last updated: {new Date(lastUpdatedAt).toLocaleTimeString()}</p>}
      <div className="mt-4 rounded-2xl bg-slate-50 p-4">
        <Row label="Order ID" value={order.id} />
        <Row label="Centre" value={order.centre} />
        <Row label="Document" value={order.document} />
        <Row label={paymentPending ? "Amount Due" : "Amount Paid"} value={"₹" + order.amount} />
        <Row label="Payment" value={order.paymentStatus || "Pending"} />
        <Row label="Pickup Code" value={order.pickupCode} />
        {activeIndex === -1 && <Row label="Current Status" value={order.status || "Unknown"} />}
      </div>

      {paymentPending && (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Document stored securely. Printer agent will receive it only after payment is collected or verified.</p>
          {pendingPayment?.id && (
            <button
              type="button"
              onClick={onSimulateVerifiedPayment}
              disabled={paymentLoading}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
            >
              <CreditCard size={16} /> {paymentLoading ? "Verifying..." : "Simulate Verified Payment"}
            </button>
          )}
          {paymentError && <p className="mt-3 font-semibold text-rose-700">{paymentError}</p>}
        </div>
      )}

      {!paymentPending && (
        <p className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
          Payment completed. Print job queued/sent to desktop agent when an online printer is available.
        </p>
      )}

      <div className="mt-6 space-y-3">
        {orderStatuses.map((status, index) => (
          <div key={status} className="flex items-center gap-3 rounded-2xl border p-4">
            <CheckCircle className={activeIndex >= 0 && index <= activeIndex ? "text-green-600" : "text-slate-300"} />
            <span className={activeIndex >= 0 && index <= activeIndex ? "font-bold text-green-700" : "text-slate-500"}>{status}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
