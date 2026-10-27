// Configuration editor boundary: translate visible controls to the backend's
// canonical nested print options. Flat UI aliases must never silently lose edits.
export function normalizeConfigurationFile(file) {
  const options = file.printOptions || {};
  const watermark = options.watermark || {};
  const sides = options.sides || "";
  const mode = options.scale?.mode || options.scaleMode || "original";
  return {
    id: String(file.id || file.orderFileId || ""),
    fileName: file.fileName || "Document",
    originalPageCount: file.preparedPageCount ?? file.pageCount ?? file.originalPageCount ?? null,
    sourceOptions: options,
    copies: file.copies ?? options.copies ?? 1,
    colorMode: options.colorMode === "color" ? "color" : "bw",
    sideType: sides ? (sides.startsWith("two") ? "double" : "single") : options.sideType || "single",
    duplexBinding: options.duplexBinding || (sides.includes("short") ? "short-edge" : sides.includes("long") ? "long-edge" : "auto"),
    orientation: options.orientation || "auto",
    backSideRotation: options.backSideRotation || "auto",
    pageOrder: options.pageOrder || "normal",
    scaleMode: ({ "fit-to-page": "fit_to_page", "actual-size": "original", "shrink-to-fit": "fit_to_page_width" })[mode] || mode,
    paperSize: options.paperSize || "A4",
    pagesPerSheet: Number(options.pagesPerSheet) || 1,
    printDpi: Number(options.quality?.dpi ?? options.printDpi ?? options.dpi) || 300,
    marginMode: options.margins?.mode || options.marginMode || "default",
    pagesMode: options.pages?.mode || (file.selectedPages && file.selectedPages !== "all" ? "custom" : "all"),
    pagesRange: options.pages?.range || (file.selectedPages === "all" ? "" : file.selectedPages) || "",
    watermarkEnabled: Boolean(watermark.enabled),
    watermarkType: watermark.type || "order_code",
    watermarkPosition: watermark.position || "bottom_right",
    watermarkOpacity: Number(watermark.opacity ?? 0.18),
    watermarkFontSize: Number(watermark.fontSize ?? 18),
    watermarkRotation: Number(watermark.rotation ?? 0),
    watermarkText: watermark.text || "",
  };
}

// Merge intervals instead of enumerating arbitrary ranges on every keystroke.
function countRange(range, total) {
  if (!range.trim() || range.length > 100) throw new Error("Enter a page range, for example 1-3,5 (up to 100 characters).");
  const intervals = range.split(",").filter(part => part.trim()).map(part => {
    const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part.trim());
    if (!match) throw new Error("Use a page range such as 1-3,5.");
    const start = Number(match[1]), end = Number(match[2] || match[1]);
    if (start < 1 || end < start || end > total) throw new Error(`Page range must stay between 1 and ${total}.`);
    return [start, end];
  }).sort((a, b) => a[0] - b[0]);
  if (!intervals.length) throw new Error("Select at least one page.");
  let count = 0, end = 0;
  for (const [start, stop] of intervals) {
    if (stop > end) count += stop - Math.max(start, end + 1) + 1;
    end = Math.max(end, stop);
  }
  return count;
}

export function calculatePrintPricingLocal({
  pricing = {}, originalPageCount, selectedPagesMode, selectedPagesRange = "",
  copies, colorMode, sides, pagesPerSheet = 1, watermarkEnabled = false,
}) {
  const pending = (reason, error) => ({ pending: true, reason, error, totalAmount: null, totalAmountPaise: null });
  const pages = Number(originalPageCount), copyCount = Number(copies);
  if (!Number.isInteger(pages) || pages <= 0) return pending("PAGE_COUNT_PENDING");
  if (!Number.isInteger(copyCount) || copyCount < 1 || copyCount > 99) return pending("INVALID_COPIES", "Copies must be a whole number from 1 to 99.");
  let selectedPageCount;
  try { selectedPageCount = selectedPagesMode === "custom" ? countRange(String(selectedPagesRange), pages) : pages; }
  catch (error) { return pending("INVALID_RANGE", error.message); }
  const pps = [1, 2, 4, 6, 9, 16].includes(Number(pagesPerSheet)) ? Number(pagesPerSheet) : 1;
  const printablePageCount = selectedPageCount * copyCount;
  const sheetCount = Math.ceil(printablePageCount / pps);
  const double = String(sides).startsWith("two_sided");
  const physicalSheetCount = double ? Math.ceil(sheetCount / 2) : sheetCount;
  const rates = pricing.pricing || pricing;
  const rate = Number(rates[colorMode === "color" ? (double ? "colorDouble" : "colorSingle") : (double ? "bwDouble" : "bwSingle")]);
  if (!Number.isFinite(rate) || rate <= 0) return pending("PRICE_RATE_PENDING");
  const watermarkCharge = watermarkEnabled ? Number(rates.watermarkCharge ?? 0) : 0;
  if (!Number.isFinite(watermarkCharge) || watermarkCharge < 0) return pending("PRICE_RATE_PENDING");
  // Match the backend's sheet-based estimate. The backend remains authoritative.
  const totalAmount = physicalSheetCount * rate + watermarkCharge;
  return { selectedPageCount, printablePageCount, sheetCount, physicalSheetCount, pricePerPage: rate, watermarkCharge, totalAmount, totalAmountPaise: Math.round(totalAmount * 100) };
}

export function configurationPayload(files, note) {
  if (!note.trim()) throw new Error("Add a reason for the configuration change.");
  if (!files.length || files.some(file => !file.id)) throw new Error("Order file details are missing. Close this dialog and reopen Configure.");
  if (files.some(file => file.watermarkEnabled && (!Number.isInteger(Number(file.watermarkFontSize)) || Number(file.watermarkFontSize) < 8 || Number(file.watermarkFontSize) > 72))) {
    throw new Error("Watermark font size must be a whole number from 8 to 72.");
  }
  return {
    note: note.trim(),
    files: files.map(file => {
      const original = file.sourceOptions || {};
      return {
        id: file.id,
        copies: Number(file.copies),
        printOptions: {
          ...original,
          copies: Number(file.copies),
          colorMode: file.colorMode === "color" ? "color" : "black_white",
          orientation: file.orientation,
          sides: file.sideType === "single" ? "one_sided" : file.duplexBinding === "short-edge" ? "two_sided_short_edge" : "two_sided_long_edge",
          duplexBinding: file.duplexBinding,
          backSideRotation: file.backSideRotation,
          pageOrder: file.pageOrder,
          scale: { ...original.scale, mode: file.scaleMode },
          paperSize: file.paperSize,
          pagesPerSheet: Number(file.pagesPerSheet),
          quality: { ...original.quality, dpi: Number(file.printDpi) },
          margins: { ...original.margins, mode: file.marginMode },
          pages: { mode: file.pagesMode, range: file.pagesMode === "custom" ? file.pagesRange.trim() : "" },
          watermark: {
            ...original.watermark, enabled: file.watermarkEnabled, type: file.watermarkType,
            position: file.watermarkPosition, opacity: Number(file.watermarkOpacity),
            fontSize: Number(file.watermarkFontSize), rotation: Number(file.watermarkRotation),
            text: file.watermarkType === "custom_text" ? file.watermarkText : "",
          },
        },
      };
    }),
  };
}

