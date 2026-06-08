/**
 * orderPrintOptionsService.js
 * 
 * Extracts print options from user submissions, normalizing legacy formats
 * (e.g. string "all" vs objects) into a standard shape for pricing and printing.
 */

import { mapLegacyFieldsToPrintOptions } from '../utils/printOptions.js';

function legacySelectedPagesToPrintOptionsRange(selectedPages) {
  const value = String(selectedPages || '').trim();
  if (!value || value.toLowerCase() === 'all') {
    return { mode: 'all', range: '' };
  }

  return { mode: 'custom', range: value };
}

export function buildSubmittedPrintOptions(file, fallback) {
  if (file.printOptions && typeof file.printOptions === 'object') {
    return file.printOptions;
  }

  const pages = legacySelectedPagesToPrintOptionsRange(file.selectedPages ?? fallback.selectedPages);

  return {
    ...mapLegacyFieldsToPrintOptions({
      copies: file.copies ?? fallback.copies,
      colorType: file.colorType ?? fallback.colorType,
      sideType: file.sideType ?? fallback.sideType,
      watermarkEnabled: file.watermarkEnabled ?? fallback.watermarkEnabled
    }),
    pages,
    paperSize: file.paperSize ?? fallback.paperSize,
    pagesPerSheet: file.pagesPerSheet ?? fallback.pagesPerSheet,
    orientation: file.orientation ?? fallback.orientation,
    scale: {
      mode: file.scaleMode ?? fallback.scaleMode ?? 'original',
      percent: null
    },
    margins: {
      mode: file.marginMode ?? fallback.marginMode ?? 'default'
    },
    quality: {
      dpi: file.printDpi ?? fallback.printDpi ?? 300
    }
  };
}
