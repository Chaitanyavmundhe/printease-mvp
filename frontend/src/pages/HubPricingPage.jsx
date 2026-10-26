import { useState } from "react";
import { Check, CreditCard, Loader2, ShieldCheck, X } from "lucide-react";
import Card from "../components/Card";
import Input from "../components/Input";
import NumberInput from "../components/NumberInput";
import HubAfterOrderSettingsCard from "../components/HubAfterOrderSettingsCard";

function SaveStatus({ status }) {
  if (status === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
        <Loader2 size={14} className="animate-spin" /> Saving…
      </span>
    );
  }

  if (status === "saved") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
        <Check size={14} /> Saved
      </span>
    );
  }

  if (status?.startsWith("error:")) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600">
        <X size={14} /> {status.slice(6)}
      </span>
    );
  }

  return null;
}

export default function HubPricingPage({ currentHub, updateCentrePrice, updateCentrePayment, onAfterOrderSettingsUpdate }) {
  const [pricingStatus, setPricingStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");

  if (!currentHub) return <Card>Please login as print hub.</Card>;

  async function handlePriceChange(field, value) {
    setPricingStatus("saving");
    try {
      await updateCentrePrice(field, value);
      setPricingStatus("saved");
      setTimeout(() => setPricingStatus(""), 2500);
    } catch (error) {
      setPricingStatus(`error:${error.message || "Could not save price"}`);
      setTimeout(() => setPricingStatus(""), 4000);
    }
  }

  async function handlePaymentChange(field, value) {
    setPaymentStatus("saving");
    try {
      await updateCentrePayment(field, value);
      setPaymentStatus("saved");
      setTimeout(() => setPaymentStatus(""), 2500);
    } catch (error) {
      setPaymentStatus(`error:${error.message || "Could not save"}`);
      setTimeout(() => setPaymentStatus(""), 4000);
    }
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200/80 pb-4">
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">Centre Pricing & Payments</h2>
        <p className="mt-1 text-sm text-slate-500">Configure page rates, paper modes, and UPI collection details for your store.</p>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card>
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Printing Rates (₹)</h3>
              <p className="text-xs text-slate-500">Auto-saved when you click away from any input.</p>
            </div>
            <SaveStatus status={pricingStatus} />
          </div>
          <div className="mt-4 space-y-3.5">
            <NumberInput label="A4 B/W Single Side" value={currentHub.bwSingle} onChange={(value) => handlePriceChange("bwSingle", value)} helperText="Most common" />
            <NumberInput label="A4 B/W Double Side" value={currentHub.bwDouble} onChange={(value) => handlePriceChange("bwDouble", value)} />
            <NumberInput label="A4 Color Single Side" value={currentHub.colorSingle} onChange={(value) => handlePriceChange("colorSingle", value)} />
            <NumberInput label="A4 Color Double Side" value={currentHub.colorDouble} onChange={(value) => handlePriceChange("colorDouble", value)} />
            <NumberInput label="Watermark Charge" value={currentHub.watermarkCharge} onChange={(value) => handlePriceChange("watermarkCharge", value)} helperText="Per-order surcharge" />
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Payment Collection</h3>
              <p className="text-xs text-slate-500">Displayed to customers when choosing manual counter UPI transfer.</p>
            </div>
            <SaveStatus status={paymentStatus} />
          </div>
          <div className="mt-4 space-y-3.5">
            <Input label="UPI ID" icon={<CreditCard size={16} />} value={currentHub.upiId} setValue={(value) => handlePaymentChange("upiId", value)} placeholder="e.g. mobile@upi" />
            <Input label="UPI QR Image URL" icon={<CreditCard size={16} />} value={currentHub.upiQrImageUrl || ""} setValue={(value) => handlePaymentChange("upiQrImageUrl", value)} placeholder="https://example.com/qr.png" />
            <div className="rounded-xl border border-slate-200/60 bg-slate-50/70 p-3.5">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 text-emerald-600 shrink-0" size={16} />
                <p className="text-xs text-slate-600 leading-relaxed">
                  Only public URLs should be added here. Never enter private credentials or keys.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <HubAfterOrderSettingsCard currentCentre={currentHub} onSettingsUpdate={onAfterOrderSettingsUpdate} />
    </div>
  );
}
