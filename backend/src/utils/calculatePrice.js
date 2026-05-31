function positiveInteger(value, fallback = 1) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) return fallback;
  return number;
}

function normalizePagesPerSheet(value) {
  const pagesPerSheet = positiveInteger(value, 1);
  return [1, 2, 4, 6, 9, 16].includes(pagesPerSheet) ? pagesPerSheet : 1;
}

export function countSelectedPages(selectedPages, originalPageCount) {
  const totalPages = positiveInteger(originalPageCount, 0);
  const value = String(selectedPages || '').trim().toLowerCase();

  if (!totalPages) {
    throw new Error('Original PDF page count is required');
  }

  if (!value || value === 'all') return totalPages;

  const selected = new Set();
  const parts = value.split(',').map((part) => part.trim()).filter(Boolean);

  if (!parts.length) return totalPages;

  for (const part of parts) {
    const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);
    const singleMatch = part.match(/^\d+$/);

    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);

      if (start > end || start < 1 || end > totalPages) {
        throw new Error(`Selected page range "${part}" is outside this PDF's ${totalPages} pages`);
      }

      for (let page = start; page <= end; page += 1) {
        selected.add(page);
      }
      continue;
    }

    if (singleMatch) {
      const page = Number(part);
      if (page < 1 || page > totalPages) {
        throw new Error(`Selected page "${part}" is outside this PDF's ${totalPages} pages`);
      }
      selected.add(page);
      continue;
    }

    throw new Error('Page range must use values like "all", "1", or "1,3-4"');
  }

  if (!selected.size) {
    throw new Error('Select at least one printable page');
  }

  return selected.size;
}

export function calculatePrintPricing({
  centre,
  originalPageCount,
  selectedPages,
  copies,
  colorType,
  sideType,
  pagesPerSheet = 1,
  paperSize = 'A4',
  watermarkEnabled = false,
  chargeBy = 'page'
}) {
  if (!centre) throw new Error('Centre not found');

  const copyCount = positiveInteger(copies, 0);
  if (!copyCount) throw new Error('Copies must be a positive number');

  const normalizedColorType = colorType === 'color' ? 'color' : 'bw';
  const normalizedSideType = sideType === 'double' || sideType === 'duplex' ? 'double' : 'single';
  const normalizedPagesPerSheet = normalizePagesPerSheet(pagesPerSheet);
  const selectedPageCount = countSelectedPages(selectedPages, originalPageCount);
  const printablePageCount = selectedPageCount * copyCount;
  const sheetCount = Math.ceil(printablePageCount / normalizedPagesPerSheet);
  const physicalSheetCount = normalizedSideType === 'double' ? Math.ceil(sheetCount / 2) : sheetCount;

  let pricePerPage;

  if (normalizedColorType === 'bw' && normalizedSideType === 'single') pricePerPage = centre.pricing.bwSingle;
  else if (normalizedColorType === 'bw' && normalizedSideType === 'double') pricePerPage = centre.pricing.bwDouble;
  else if (normalizedColorType === 'color' && normalizedSideType === 'single') pricePerPage = centre.pricing.colorSingle;
  else pricePerPage = centre.pricing.colorDouble;

  const rate = Number(pricePerPage);
  const chargeUnit = chargeBy === 'sheet' ? physicalSheetCount : printablePageCount;
  const base = chargeUnit * rate;
  const watermarkCharge = watermarkEnabled ? Number(centre.pricing.watermarkCharge || 0) : 0;
  const totalAmount = base + watermarkCharge;

  return {
    originalPageCount: Number(originalPageCount),
    selectedPages: String(selectedPages || '').trim() || 'all',
    selectedPageCount,
    printablePageCount,
    sheetCount,
    physicalSheetCount,
    copies: copyCount,
    colorMode: normalizedColorType,
    paperSize,
    sides: normalizedSideType,
    pagesPerSheet: normalizedPagesPerSheet,
    chargeBy,
    pricePerPage: rate,
    pricePerSheet: chargeBy === 'sheet' ? rate : null,
    watermarkCharge,
    serviceFee: 0,
    totalAmount,
    totalAmountPaise: Math.round(totalAmount * 100)
  };
}

export function calculatePrice({ centre, pages, copies, colorType, sideType, watermarkEnabled }) {
  return calculatePrintPricing({
    centre,
    originalPageCount: pages,
    selectedPages: 'all',
    copies,
    colorType,
    sideType,
    pagesPerSheet: 1,
    watermarkEnabled
  });
}
