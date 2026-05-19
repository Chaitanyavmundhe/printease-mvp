import { CreditCard, QrCode } from "lucide-react";
import Card from "../components/Card";
import Row from "../components/Row";

export default function PaymentPage({ selectedCentre, documentName, pages, copies, totalAmount, handlePayment, paymentLoading, paymentError }) {
  return (
    <Card className="mx-auto max-w-xl">
      <h2 className="text-2xl font-bold">Secure Payment</h2>
      <p className="mt-2 text-slate-600">Document stored securely. Printer agent will receive it only after payment is collected or verified.</p>
      <div className="mt-6 space-y-3 rounded-2xl bg-slate-50 p-4">
        <Row label="Centre" value={selectedCentre?.name || "N/A"} />
        <Row label="Document" value={documentName || "Uploaded Document"} />
        <Row label="Pages" value={pages} />
        <Row label="Copies" value={copies} />
        <Row label="Amount" value={`₹${totalAmount}`} />
        <Row label="Centre UPI" value={selectedCentre?.upiId || "N/A"} />
      </div>
      <div className="mt-6 rounded-2xl border p-4 text-center">
        <QrCode className="mx-auto" size={80} />
        <p className="mt-3 font-semibold">Demo UPI QR</p>
        <p className="text-sm text-slate-500">In real project, use Razorpay payment order and webhook verification.</p>
      </div>
      {paymentError && (
        <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {paymentError}
        </p>
      )}
      <button disabled={paymentLoading} onClick={handlePayment} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400">
        <CreditCard size={18} /> {paymentLoading ? "Processing..." : "Simulate Verified Payment"}
      </button>
    </Card>
  );
}
