import { describe, expect, it } from "vitest";
import { normalizeConfigurationFile, calculatePrintPricingLocal, configurationPayload } from "../hubOrderConfiguration";

describe("hub configuration transport", () => {
  const file = {
    id: "order-file-1", documentId: "document-1", fileName: "report.pdf", originalPageCount: 2,
    pageCount: 4, copies: 1, printOptions: {
      colorMode: "black_white", sides: "one_sided", scale: { mode: "fit_to_page" },
      quality: { dpi: 600 }, margins: { mode: "none" }, watermark: { opacity: 0.2 },
      destination: { selectedHubId: "hub-1" },
    },
  };
  it("prefills canonical nested fields and verified page count", () => {
    expect(normalizeConfigurationFile(file)).toMatchObject({ id: file.id, originalPageCount: 4, scaleMode: "fit_to_page", printDpi: 600, marginMode: "none" });
  });
  it("submits values the backend actually reads, preserving non-edited options", () => {
    const edited = { ...normalizeConfigurationFile(file), copies: 2, sideType: "double", duplexBinding: "short-edge", printDpi: 300, scaleMode: "original", marginMode: "minimum", colorMode: "bw", pagesMode: "custom", pagesRange: "1-3", pageOrder: "reverse", backSideRotation: "rotate-180" };
    const payload = configurationPayload([edited], " Customer requested ");
    expect(payload.note).toBe("Customer requested");
    expect(payload.files[0]).toMatchObject({ id: "order-file-1", copies: 2, printOptions: {
      colorMode: "black_white", sides: "two_sided_short_edge", scale: { mode: "original" },
      quality: { dpi: 300 }, margins: { mode: "minimum" }, pages: { mode: "custom", range: "1-3" },
      destination: { selectedHubId: "hub-1" }, pageOrder: "reverse", backSideRotation: "rotate-180",
    } });
  });
  it("does not substitute document IDs for missing order-file IDs", () => {
    expect(() => configurationPayload([normalizeConfigurationFile({ documentId: "document-1" })], "reason")).toThrow(/file details/);
    expect(() => configurationPayload([normalizeConfigurationFile(file)], " ")).toThrow(/reason/);
  });
  it("matches sheet pricing rather than stale per-page estimates", () => {
    const result = calculatePrintPricingLocal({ pricing: { bwDouble: 3 }, originalPageCount: 4, copies: 2, sides: "two_sided", pagesPerSheet: 2 });
    expect(result).toMatchObject({ selectedPageCount: 4, printablePageCount: 8, sheetCount: 4, physicalSheetCount: 2, totalAmountPaise: 600 });
  });
  it("rejects invalid ranges immediately rather than displaying a fabricated total", () => {
    for (const range of ["1-999999999999", "word", "9", "3-1", ""]) {
      expect(calculatePrintPricingLocal({ pricing: { bwSingle: 2 }, originalPageCount: 4, copies: 1, sides: "one_sided", selectedPagesMode: "custom", selectedPagesRange: range })).toMatchObject({ pending: true, reason: "INVALID_RANGE", totalAmount: null });
    }
  });
  it("counts overlapping intervals once and handles pending rate/page count", () => {
    const args = { pricing: { bwSingle: 2 }, originalPageCount: 5, copies: 1, sides: "one_sided", selectedPagesMode: "custom", selectedPagesRange: "1-3,2-4" };
    expect(calculatePrintPricingLocal(args).selectedPageCount).toBe(4);
    expect(calculatePrintPricingLocal({ ...args, pricing: {} }).reason).toBe("PRICE_RATE_PENDING");
    expect(calculatePrintPricingLocal({ ...args, originalPageCount: null }).reason).toBe("PAGE_COUNT_PENDING");
    expect(calculatePrintPricingLocal({ ...args, copies: "" }).reason).toBe("INVALID_COPIES");
  });
});

