import React, { useState, useEffect, useMemo, useId, useRef } from "react";
import { X, FileText, Settings2, ShieldAlert, Sparkles, Loader2 } from "lucide-react";
import ModalPortal from "./ModalPortal";
import { calculatePrintPricingLocal, normalizeConfigurationFile, configurationPayload } from "../utils/hubOrderConfiguration";
export { calculatePrintPricingLocal } from "../utils/hubOrderConfiguration";
const EMPTY_FILES = [];

export default function HubOrderConfigModal({
  isOpen,
  onClose,
  order,
  files = EMPTY_FILES,
  pricing = {},
  onSave,
  isLoading = false
}) {
  const [formFiles, setFormFiles] = useState([]);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const titleId = useId();
  const noteId = useId();
  const scrollBody = useRef(null);
  useEffect(() => { if (errorMsg && scrollBody.current) scrollBody.current.scrollTop = 0; }, [errorMsg]);

  useEffect(() => {
    if (!isOpen) return;
    setFormFiles(files.map(normalizeConfigurationFile));
    setNote("");
    setErrorMsg("");
  }, [isOpen, files]);

  // Handler to update attributes of a single file in the form state
  const handleUpdateFile = (fileId, key, value) => {
    setFormFiles(prev =>
      prev.map(f => (f.id === fileId ? { ...f, [key]: value } : f))
    );
  };

  // Compile calculations for each file in the state
  const calculatedFiles = useMemo(() => formFiles.map(file => {
    const calc = calculatePrintPricingLocal({
      pricing,
      originalPageCount: file.originalPageCount,
      selectedPagesMode: file.pagesMode,
      selectedPagesRange: file.pagesRange,
      copies: file.copies,
      colorMode: file.colorMode === "bw" ? "black_white" : file.colorMode,
      sides: file.sideType === 'double' ? 'two_sided' : 'one_sided',
      pagesPerSheet: file.pagesPerSheet || 1,
      watermarkEnabled: file.watermarkEnabled
    });
    return { ...file, calc };
  }), [formFiles, pricing]);

  const hasPendingCalculation = isLoading || calculatedFiles.length === 0 || calculatedFiles.some((file) => file.calc?.pending);
  const totalCalculatedAmount = hasPendingCalculation
    ? null
    : calculatedFiles.reduce((sum, f) => sum + f.calc.totalAmount, 0);
  const totalPreviousAmount = order?.totalAmountPaise != null ? Number(order.totalAmountPaise) / 100 : order?.amount != null ? Number(order.amount) : null;
  const isPriceDifferent = !hasPendingCalculation && totalPreviousAmount !== null && Number.isFinite(totalPreviousAmount) && Math.abs(totalCalculatedAmount - totalPreviousAmount) > 0.01;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg("");


    if (hasPendingCalculation) {
      setErrorMsg(calculatedFiles.find(file => file.calc.pending)?.calc.error || "Verified page count or centre rates are unavailable. Wait for preparation or refresh centre pricing before saving.");
      setSubmitting(false);
      return;
    }

    try {
      await onSave(configurationPayload(calculatedFiles, note));
      onClose();
    } catch (err) {
      setErrorMsg(err.message || "Failed to update configuration.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !order) return null;

  return (
    <ModalPortal onClose={onClose} busy={submitting} labelledBy={titleId} className="flex items-center justify-center bg-slate-950/50 p-2 sm:p-4">
      {/* Modal Container */}
      <form
        noValidate
        onSubmit={handleSubmit}
        className="relative flex h-[94vh] h-[94dvh] min-h-0 w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
              <Settings2 className="h-5 w-5" />
            </div>
            <div>
              <h3 id={titleId} className="text-base font-semibold text-slate-800">
                Override Print Settings
              </h3>
              <p className="text-xs text-slate-400">
                Order {order.orderCode || order.id}
              </p>
            </div>
          </div>
          
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close configuration"
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div ref={scrollBody} data-testid="configuration-scroll" className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white p-4" style={{ WebkitOverflowScrolling: "touch" }}>
          {errorMsg && (
            <div role="alert" className="mb-4 flex items-center gap-3 rounded-md bg-rose-50 p-3 text-sm font-medium text-rose-700">
              <ShieldAlert className="h-5 w-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mb-3" />
              <p className="text-sm font-medium">Loading order details & documents...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {calculatedFiles.map((file, idx) => (
                <div
                  key={file.id}
                  className="border-b border-slate-200 pb-5 last:border-0"
                >
                  <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
                    <FileText className="h-5 w-5 text-indigo-500 shrink-0" />
                    <span className="truncate font-semibold text-slate-800">
                      File {idx + 1}: {file.fileName}
                    </span>
                    <span className="ml-auto text-xs font-semibold text-slate-400">
                      ({file.originalPageCount} pages original)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {/* Copies */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-normal mb-1.5">
                        Copies
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="99"
                        aria-label={`Copies for ${file.fileName}`} value={file.copies}
                        onChange={(e) => handleUpdateFile(file.id, "copies", e.target.value)}
                        className="w-full rounded-md border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500"
                        required
                      />
                    </div>

                    {/* Color Mode */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-normal mb-1.5">
                        Color mode
                      </label>
                      <select
                        aria-label={`Colour for ${file.fileName}`} value={file.colorMode}
                        onChange={(e) => handleUpdateFile(file.id, "colorMode", e.target.value)}
                        className="w-full rounded-md border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500"
                      >
                        <option value="bw">Black & White</option>
                        <option value="color">Color</option>
                      </select>
                    </div>

                    {/* Side Type */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-normal mb-1.5">
                        Sides
                      </label>
                      <select
                        aria-label={`Sides for ${file.fileName}`} value={file.sideType}
                        onChange={(e) => handleUpdateFile(file.id, "sideType", e.target.value)}
                        className="w-full rounded-md border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500"
                      >
                        <option value="single">Single side</option>
                        <option value="double">Double side</option>
                      </select>
                    </div>

                    {/* Paper Size */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-normal mb-1.5">
                        Paper size
                      </label>
                      <select
                        aria-label={`Paper size for ${file.fileName}`} value={file.paperSize}
                        onChange={(e) => handleUpdateFile(file.id, "paperSize", e.target.value)}
                        className="w-full rounded-md border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500"
                      >
                        <option value="A4">A4</option>
                        <option value="A3">A3</option>
                        <option value="Letter">Letter</option>
                        <option value="Legal">Legal</option>
                      </select>
                    </div>

                    {/* Orientation */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-normal mb-1.5">
                        Orientation
                      </label>
                      <select
                        aria-label={`Orientation for ${file.fileName}`} value={file.orientation}
                        onChange={(e) => handleUpdateFile(file.id, "orientation", e.target.value)}
                        className="w-full rounded-md border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500"
                      >
                        <option value="auto">Auto</option>
                        <option value="portrait">Portrait</option>
                        <option value="landscape">Landscape</option>
                      </select>
                    </div>

                    {/* Pages per Sheet */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-normal mb-1.5">
                        Pages per sheet
                      </label>
                      <select
                        aria-label={`Pages per sheet for ${file.fileName}`} value={file.pagesPerSheet}
                        onChange={(e) => handleUpdateFile(file.id, "pagesPerSheet", Number(e.target.value))}
                        className="w-full rounded-md border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500"
                      >
                        <option value={1}>1 page per sheet</option>
                        <option value={2}>2 pages per sheet</option>
                        <option value={4}>4 pages per sheet</option>
                        <option value={6}>6 pages per sheet</option>
                        <option value={9}>9 pages per sheet</option>
                        <option value={16}>16 pages per sheet</option>
                      </select>
                    </div>

                    {/* Print Quality / DPI */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-normal mb-1.5">
                        Print quality
                      </label>
                      <select
                        aria-label={`Print quality for ${file.fileName}`} value={file.printDpi}
                        onChange={(e) => handleUpdateFile(file.id, "printDpi", Number(e.target.value))}
                        className="w-full rounded-md border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500"
                      >
                        <option value={203}>Draft — 203 DPI</option>
                        <option value={300}>Standard — 300 DPI</option>
                        <option value={600}>High — 600 DPI</option>
                      </select>
                    </div>

                    {/* Scale */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-normal mb-1.5">
                        Scale
                      </label>
                      <select
                        aria-label={`Scale for ${file.fileName}`} value={file.scaleMode}
                        onChange={(e) => handleUpdateFile(file.id, "scaleMode", e.target.value)}
                        className="w-full rounded-md border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500"
                      >
                        <option value="original">Original size</option>
                        <option value="fit_to_page">Fit to page</option>
                        <option value="fit_to_page_width">Fit to page width</option>
                      </select>
                    </div>

                    {/* Margins */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-normal mb-1.5">
                        Margins
                      </label>
                      <select
                        aria-label={`Margins for ${file.fileName}`} value={file.marginMode}
                        onChange={(e) => handleUpdateFile(file.id, "marginMode", e.target.value)}
                        className="w-full rounded-md border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500"
                      >
                        <option value="default">Default</option>
                        <option value="minimum">Minimum</option>
                        <option value="none">None</option>
                      </select>
                    </div>

                    {/* Page Selection */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-normal mb-1.5">
                        Page selection
                      </label>
                      <select
                        aria-label={`Page selection for ${file.fileName}`} value={file.pagesMode}
                        onChange={(e) => handleUpdateFile(file.id, "pagesMode", e.target.value)}
                        className="w-full rounded-md border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500"
                      >
                        <option value="all">All Pages</option>
                        <option value="custom">Custom Range</option>
                      </select>
                    </div>

                    {/* Custom Page Range Input */}
                    {file.pagesMode === "custom" && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-normal mb-1.5">
                          Page range (e.g. 1-3,5)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 1-3, 5"
                          aria-label={`Page range for ${file.fileName}`} value={file.pagesRange}
                          onChange={(e) => handleUpdateFile(file.id, "pagesRange", e.target.value)}
                          className="w-full rounded-md border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500"
                          required
                        />
                      </div>
                    )}

                    {/* Page Order — hub-only advanced */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-normal mb-1.5 flex items-center gap-1 text-amber-600">
                        <Settings2 className="h-3 w-3"/> Page order
                      </label>
                      <select
                        aria-label={`Page order for ${file.fileName}`} value={file.pageOrder}
                        onChange={(e) => handleUpdateFile(file.id, "pageOrder", e.target.value)}
                        className="w-full rounded-md border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500"
                      >
                        <option value="normal">Normal (1 to N)</option>
                        <option value="reverse">Reverse (N to 1)</option>
                      </select>
                    </div>

                    {/* Advanced Controls (Only if Double Sided) */}
                    {file.sideType === 'double' && (
                      <>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-normal mb-1.5 flex items-center gap-1 text-amber-600">
                            <Settings2 className="h-3 w-3"/> Duplex binding
                          </label>
                          <select
                            aria-label={`Duplex binding for ${file.fileName}`} value={file.duplexBinding}
                            onChange={(e) => handleUpdateFile(file.id, "duplexBinding", e.target.value)}
                            className="w-full rounded-md border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500"
                          >
                            <option value="auto">Auto (Profile default)</option>
                            <option value="long-edge">Long Edge (Book)</option>
                            <option value="short-edge">Short Edge (Calendar)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-normal mb-1.5 flex items-center gap-1 text-amber-600">
                            <Settings2 className="h-3 w-3"/> Back-side rotation
                          </label>
                          <select
                            aria-label={`Back-side rotation for ${file.fileName}`} value={file.backSideRotation}
                            onChange={(e) => handleUpdateFile(file.id, "backSideRotation", e.target.value)}
                            className="w-full rounded-md border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500"
                          >
                            <option value="auto">Auto</option>
                            <option value="normal">Normal</option>
                            <option value="rotate-180">Rotate 180°</option>
                          </select>
                        </div>
                      </>
                    )}

                    {/* Watermark toggle */}
                    <div className="flex items-center gap-2 col-span-full mt-1">
                      <input
                        type="checkbox"
                        id={`watermark-${file.id}`}
                        checked={file.watermarkEnabled}
                        onChange={(e) => handleUpdateFile(file.id, "watermarkEnabled", e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <label
                        htmlFor={`watermark-${file.id}`}
                        className="text-sm font-semibold text-slate-700 cursor-pointer"
                      >
                        Add watermark to printable PDF
                      </label>
                    </div>

                    {/* Expanded watermark options */}
                    {file.watermarkEnabled && (
                      <div className="col-span-full grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 rounded-md border border-slate-200 bg-slate-50 p-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-normal mb-1.5">Type</label>
                          <select
                            aria-label={`Watermark type for ${file.fileName}`} value={file.watermarkType}
                            onChange={(e) => handleUpdateFile(file.id, "watermarkType", e.target.value)}
                            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                          >
                            <option value="order_code">Order code</option>
                            <option value="pickup_code">Pickup code</option>
                            <option value="date_time">Date/time</option>
                            <option value="custom_text">Custom text</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-normal mb-1.5">Position</label>
                          <select
                            aria-label={`Watermark position for ${file.fileName}`} value={file.watermarkPosition}
                            onChange={(e) => handleUpdateFile(file.id, "watermarkPosition", e.target.value)}
                            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                          >
                            <option value="bottom_right">Bottom right</option>
                            <option value="bottom_center">Bottom center</option>
                            <option value="bottom_left">Bottom left</option>
                            <option value="center">Center</option>
                            <option value="top_left">Top left</option>
                            <option value="top_center">Top center</option>
                            <option value="top_right">Top right</option>
                          </select>
                        </div>
                        {file.watermarkType === "custom_text" && (
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-normal mb-1.5">Custom text</label>
                            <input
                              aria-label={`Watermark text for ${file.fileName}`} value={file.watermarkText}
                              onChange={(e) => handleUpdateFile(file.id, "watermarkText", e.target.value)}
                              placeholder="Watermark text"
                              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                            />
                          </div>
                        )}
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-normal mb-1.5">Opacity — {Math.round(file.watermarkOpacity * 100)}%</label>
                          <input type="range" min="0.05" max="0.6" step="0.01" aria-label={`Watermark opacity for ${file.fileName}`} value={file.watermarkOpacity} onChange={(e) => handleUpdateFile(file.id, "watermarkOpacity", Number(e.target.value))} className="w-full accent-indigo-600" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-normal mb-1.5">Rotation — {file.watermarkRotation}°</label>
                          <input type="range" min="-90" max="90" step="5" aria-label={`Watermark rotation for ${file.fileName}`} value={file.watermarkRotation} onChange={(e) => handleUpdateFile(file.id, "watermarkRotation", Number(e.target.value))} className="w-full accent-indigo-600" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-normal mb-1.5">Font size</label>
                          <input type="number" min="8" max="72" aria-label={`Watermark font size for ${file.fileName}`} value={file.watermarkFontSize} onChange={(e) => handleUpdateFile(file.id, "watermarkFontSize", e.target.value === "" ? "" : Number(e.target.value))} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* File Pricing Summary */}
                  <div className="mt-4 rounded-md bg-slate-50 p-3 text-xs font-medium text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
                    <span>Selected: <strong>{file.calc.pending ? "Pending" : file.calc.selectedPageCount}</strong> pgs</span>
                    <span>Printable: <strong>{file.calc.pending ? "Pending" : file.calc.printablePageCount}</strong> pgs</span>
                    <span>Sheets: <strong>{file.calc.pending ? "Pending" : file.calc.physicalSheetCount}</strong> sheets</span>
                    <span className="ml-auto text-indigo-600">
                      File total: <strong>{file.calc.pending ? "Pending" : `₹${file.calc.totalAmount.toFixed(2)}`}</strong>
                    </span>
                  </div>
                </div>
              ))}

              {/* Note/Audit Reason */}
              <div>
                <label htmlFor={noteId} className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Note / Reason for configuration override (Required)
                </label>
                <textarea
                  id={noteId}
                  maxLength={500}
                  placeholder="For example: Customer requested two copies."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full h-20 rounded-md border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 resize-none"
                  required
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 p-3 sm:px-4">
          <div className="text-left">
            <span className="text-xs text-slate-400 font-medium block">Total Price Summary</span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-slate-800">
                {hasPendingCalculation ? "Pending" : `₹${totalCalculatedAmount.toFixed(2)}`}
              </span>
              {isPriceDifferent && (
                <span className="text-xs font-semibold text-indigo-600 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Was ₹{totalPreviousAmount.toFixed(2)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 rounded-md bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              disabled={submitting || isLoading || formFiles.length === 0}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving Changes
                </>
              ) : (
                "Save Configuration"
              )}
            </button>
          </div>
        </div>
      </form>
    </ModalPortal>
  );
}
