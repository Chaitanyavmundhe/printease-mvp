import { FileText, Printer, BarChart3, IndianRupee } from "lucide-react";
import Card from "../components/Card";
import Metric from "../components/Metric";
import StatusBadge from "../components/StatusBadge";
import { hubStatusOptions } from "../data/demoData";

export default function HubDashboard({ currentHub, hubOrders, updateOrderStatus, navigate }) {
  if (!currentHub) return <Card>Please login as print hub.</Card>;

  const totalPages = hubOrders.reduce((sum, item) => sum + item.pages * item.copies, 0);
  const totalRevenue = hubOrders.reduce((sum, item) => sum + item.amount, 0);
  const pendingOrders = hubOrders.filter((item) => item.status !== "Collected").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold">Print Hub Dashboard</h2>
          <p className="text-slate-600">{currentHub.name} · Code {currentHub.code}</p>
        </div>
        <button onClick={() => navigate("hubPricing")} className="rounded-2xl bg-slate-900 px-5 py-3 font-semibold text-white">
          Manage Pricing
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Metric title="Total Orders" value={hubOrders.length} icon={<FileText />} />
        <Metric title="Pending" value={pendingOrders} icon={<Printer />} />
        <Metric title="Pages Printed" value={totalPages} icon={<BarChart3 />} />
        <Metric title="Money Collected" value={`₹${totalRevenue}`} icon={<IndianRupee />} />
      </div>

      <Card>
        <h3 className="text-xl font-bold">Incoming / Active Orders</h3>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead>
              <tr className="border-b text-slate-500">
                <th className="py-3">Order ID</th>
                <th>Document</th>
                <th>Pages</th>
                <th>Amount</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Update</th>
              </tr>
            </thead>
            <tbody>
              {hubOrders.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="py-3 font-semibold">{item.id}</td>
                  <td>{item.document}</td>
                  <td>{item.pages} × {item.copies}</td>
                  <td>₹{item.amount}</td>
                  <td><StatusBadge color="green">{item.paymentStatus}</StatusBadge></td>
                  <td><StatusBadge>{item.status}</StatusBadge></td>
                  <td>
                    <select value={item.status} onChange={(e) => updateOrderStatus(item.id, e.target.value)} className="rounded-xl border px-3 py-2">
                      {hubStatusOptions.map((status) => <option key={status}>{status}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
