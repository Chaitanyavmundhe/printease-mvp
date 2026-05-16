import { CheckCircle } from "lucide-react";
import Card from "../components/Card";
import Row from "../components/Row";
import { orderStatuses } from "../data/demoData";

export default function TrackPage({ order }) {
  if (!order) return <Card>No active order found.</Card>;
  const activeIndex = Math.max(0, orderStatuses.indexOf(order.status));

  return (
    <Card className="mx-auto max-w-2xl">
      <h2 className="text-2xl font-bold">Order Tracking</h2>
      <div className="mt-4 rounded-2xl bg-slate-50 p-4">
        <Row label="Order ID" value={order.id} />
        <Row label="Centre" value={order.centre} />
        <Row label="Document" value={order.document} />
        <Row label="Amount Paid" value={`₹${order.amount}`} />
        <Row label="Pickup Code" value={order.pickupCode} />
      </div>
      <div className="mt-6 space-y-3">
        {orderStatuses.map((status, index) => (
          <div key={status} className="flex items-center gap-3 rounded-2xl border p-4">
            <CheckCircle className={index <= activeIndex ? "text-green-600" : "text-slate-300"} />
            <span className={index <= activeIndex ? "font-bold text-green-700" : "text-slate-500"}>{status}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
