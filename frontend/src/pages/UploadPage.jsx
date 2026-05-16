import { FileText, Upload, IndianRupee } from "lucide-react";
import Card from "../components/Card";
import Row from "../components/Row";

export default function UploadPage({
  selectedCentre,
  documentFile,
  setDocumentFile,
  documentName,
  setDocumentName,
  pages,
  setPages,
  copies,
  setCopies,
  colorType,
  setColorType,
  sideType,
  setSideType,
  watermark,
  setWatermark,
  totalAmount,
  paymentError,
  navigate,
}) {
  function handleFileChange(event) {
    const file = event.target.files?.[0] || null;
    setDocumentFile(file);
    if (file) setDocumentName(file.name);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <h2 className="text-2xl font-bold">Upload Document</h2>
        <p className="mt-2 text-slate-600">Selected Centre: <b>{selectedCentre?.name || "Not selected yet"}</b></p>

        {!selectedCentre && (
          <div className="mt-4 rounded-2xl bg-orange-50 p-4 text-sm text-orange-700">
            Direct upload started. Please select a centre before payment.
          </div>
        )}

        {paymentError && (
          <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {paymentError}
          </p>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="cursor-pointer rounded-2xl border border-dashed bg-slate-50 p-6 text-center hover:bg-slate-100 md:col-span-2">
            <input type="file" accept="application/pdf,image/png,image/jpeg" onChange={handleFileChange} className="hidden" />
            {documentFile ? <FileText className="mx-auto mb-3" size={36} /> : <Upload className="mx-auto mb-3" size={36} />}
            <p className="font-semibold">{documentFile ? documentFile.name : "Choose PDF, PNG, or JPG"}</p>
            <p className="text-sm text-slate-500">{documentFile ? `${Math.ceil(documentFile.size / 1024)} KB selected` : "Maximum file size 10 MB"}</p>
          </label>

          <input value={documentName} onChange={(e) => setDocumentName(e.target.value)} placeholder="Document name e.g. Assignment.pdf" className="rounded-2xl border px-4 py-3 outline-none focus:ring-2 focus:ring-slate-300 md:col-span-2" />
          <input type="number" min="1" value={pages} onChange={(e) => setPages(Number(e.target.value))} placeholder="Pages" className="rounded-2xl border px-4 py-3 outline-none focus:ring-2 focus:ring-slate-300" />
          <input type="number" min="1" value={copies} onChange={(e) => setCopies(Number(e.target.value))} placeholder="Copies" className="rounded-2xl border px-4 py-3 outline-none focus:ring-2 focus:ring-slate-300" />
          <select value={colorType} onChange={(e) => setColorType(e.target.value)} className="rounded-2xl border px-4 py-3">
            <option value="bw">Black & White</option>
            <option value="color">Color</option>
          </select>
          <select value={sideType} onChange={(e) => setSideType(e.target.value)} className="rounded-2xl border px-4 py-3">
            <option value="single">Single Side</option>
            <option value="double">Double Side</option>
          </select>
          <label className="flex items-center gap-3 rounded-2xl border px-4 py-3 md:col-span-2">
            <input type="checkbox" checked={watermark} onChange={(e) => setWatermark(e.target.checked)} />
            Add small order ID watermark on first and last page
          </label>
        </div>
      </Card>

      <Card>
        <h3 className="text-xl font-bold">Price Summary</h3>
        <div className="mt-4 space-y-3 text-sm">
          <Row label="Pages" value={pages} />
          <Row label="Copies" value={copies} />
          <Row label="Print Type" value={colorType === "bw" ? "B/W" : "Color"} />
          <Row label="Side" value={sideType} />
          <Row label="Watermark" value={watermark ? "Yes" : "No"} />
          <hr />
          <div className="flex items-center justify-between text-lg font-bold">
            <span>Total</span>
            <span className="flex items-center"><IndianRupee size={18} />{totalAmount}</span>
          </div>
        </div>

        {!selectedCentre && (
          <button onClick={() => navigate("centre")} className="mt-6 w-full rounded-2xl border bg-white px-4 py-3 font-semibold hover:bg-slate-50">
            Select Centre First
          </button>
        )}

        <button onClick={() => navigate("payment")} disabled={!selectedCentre || !documentFile} className="mt-3 w-full rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white disabled:opacity-40">
          Continue to Payment
        </button>
      </Card>
    </div>
  );
}
