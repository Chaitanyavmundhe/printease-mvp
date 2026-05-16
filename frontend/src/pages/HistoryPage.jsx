import Card from "../components/Card";
import StatusBadge from "../components/StatusBadge";

export default function HistoryPage({ orders, currentUser }) {
  return (
    <Card>
      <h2 className="text-2xl font-bold">Usage History</h2>
      <p className="mt-2 text-sm text-slate-600">
        {currentUser ? `Showing records for ${currentUser.name}` : "Demo history. Login to connect this with user profile."}
      </p>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[750px] text-left text-sm">
          <thead>
            <tr className="border-b text-slate-500">
              <th className="py-3">Order ID</th>
              <th>Centre</th>
              <th>Document</th>
              <th>Pages</th>
              <th>Amount</th>
              <th>Payment</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((item) => (
              <tr key={item.id} className="border-b">
                <td className="py-3 font-semibold">{item.id}</td>
                <td>{item.centre}</td>
                <td>{item.document}</td>
                <td>{item.pages} × {item.copies}</td>
                <td>₹{item.amount}</td>
                <td><StatusBadge color="green">{item.paymentStatus}</StatusBadge></td>
                <td><StatusBadge>{item.status}</StatusBadge></td>
                <td>{item.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
