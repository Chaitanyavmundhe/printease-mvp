import Row from "../Row";

// Presentation only: all prices/counts come from the existing verified bill.
// Do not calculate a second total or treat the first file as a multi-file total.
export default function CheckoutSummary({ centreName, documentName, pages, copies, price, amount, displayMoney, displayValue }) {
  const files = (Array.isArray(price?.files) ? price.files : []).filter(Boolean);
  const multi = files.length > 1;
  const facts = [
    ["Original pages", price?.originalPageCount || pages],
    ["Printed pages", price?.printablePageCount],
    ["Sheets", price?.sheetCount],
    ["Rate", price?.pricePerPage],
  ].filter(([, value]) => Number.isFinite(Number(value)) && Number(value) > 0);
  return (
    <section aria-label="Order summary" className="pe-payment-summary mt-5 space-y-3 p-4">
      <Row label="Centre" value={centreName || "Not selected"} />
      <Row label={multi ? "Documents" : "Document"} value={multi ? `${files.length} files` : documentName || "Uploaded document"} />
      {!multi && <>
        <Row label="Pages to print" value={displayValue(price?.selectedPageCount || pages)} />
        <Row label="Copies" value={files[0]?.copies ?? copies} />
      </>}
      {multi && <ul aria-label="Files in this order" className="space-y-3 border-t pt-3">
        {files.map((file, index) => <li key={file.documentId || index} className="space-y-1">
          <div className="flex items-start justify-between gap-3">
            <span className="min-w-0 break-words text-sm font-semibold">{file.fileName || `Document ${index + 1}`}</span>
            <span className="shrink-0 text-sm font-semibold">{file.pricingPending ? "Pending" : displayMoney(file.totalAmount)}</span>
          </div>
          <p className="text-sm text-slate-600">{file.pricingPending ? "Pending" : displayValue(file.selectedPageCount)} pages · {file.copies ?? "Pending"} {Number(file.copies) === 1 ? "copy" : "copies"}</p>
          {!file.pricingPending && file.pricePerPage != null && <Row label="Rate" value={displayMoney(file.pricePerPage)} />}
        </li>)}
      </ul>}
      {!multi && facts.length > 0 && <details className="pe-payment-details border-t pt-2">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-slate-600">Print details</summary>
        <div className="space-y-2 pb-2">
          {facts.map(([label, value]) => <Row key={label} label={label} value={label === "Rate" ? displayMoney(value) : displayValue(value)} />)}
        </div>
      </details>}
      <div className="pe-summary-row border-t pt-3 font-bold">
        <span>Total amount</span><span className="text-lg text-teal-800">{displayMoney(amount)}</span>
      </div>
    </section>
  );
}
