export const DEFAULT_PRINT_OPTIONS = Object.freeze({
  destination: {
    selectedHubId: null,
    preferredAgentId: null,
    preferredPrinterName: null
  },
  pages: {
    mode: 'all',
    range: ''
  },
  copies: 1,
  orientation: 'auto',
  colorMode: 'black_white',
  paperSize: 'A4',
  sides: 'one_sided',
  scale: {
    mode: 'original',
    percent: null
  },
  pagesPerSheet: 1,
  margins: {
    mode: 'default'
  },
  format: 'original',
  headersFooters: false,
  backgrounds: true,
  quality: {
    dpi: 300
  },
  watermark: {
    enabled: false,
    type: 'order_code',
    text: '',
    position: 'bottom_right',
    opacity: 0.18,
    fontSize: 18,
    rotation: 0
  }
});

const ALLOWED_ORIENTATIONS = new Set(['auto', 'portrait', 'landscape']);
const ALLOWED_COLOR_MODES = new Set(['black_white', 'color', 'grayscale']);
const ALLOWED_PAPER_SIZES = new Set(['A4', 'A3', 'Letter', 'Legal']);
const ALLOWED_SIDES = new Set(['one_sided', 'two_sided_long_edge', 'two_sided_short_edge']);
const ALLOWED_SCALE_MODES = new Set(['original', 'fit_to_page', 'fit_to_page_width', 'custom_percent']);
const ALLOWED_PAGES_PER_SHEET = new Set([1, 2, 4, 6, 9, 16]);
const ALLOWED_MARGIN_MODES = new Set(['default', 'none', 'minimum', 'custom']);
const ALLOWED_FORMATS = new Set(['original', 'simplified']);
const ALLOWED_WATERMARK_TYPES = new Set(['custom_text', 'order_code', 'pickup_code', 'user_id', 'user_name', 'hub_name', 'date_time', 'page_number']);
const ALLOWED_WATERMARK_POSITIONS = new Set([
  'top_left',
  'top_center',
  'top_right',
  'center',
  'bottom_left',
  'bottom_center',
  'bottom_right',
  'custom'
]);

function positiveInt(value, fallback, max = 999) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(Math.floor(parsed), max));
}

function bool(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  return fallback;
}

function pick(value, allowed, fallback) {
  return allowed.has(value) ? value : fallback;
}

function normalizeText(value, maxLength = 120) {
  return String(value || '').trim().slice(0, maxLength);
}

export function parsePageRange(range, totalPages) {
  const total = positiveInt(totalPages, 1, 100000);
  const raw = String(range || '').trim();

  if (!raw) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const selected = new Set();

  for (const part of raw.split(',')) {
    const token = part.trim();
    if (!token) continue;

    if (/^\d+$/.test(token)) {
      const page = Number(token);
      if (page < 1 || page > total) {
        throw new Error(`Page ${page} is outside the document page range 1-${total}.`);
      }
      selected.add(page);
      continue;
    }

    const match = token.match(/^(\d+)\s*-\s*(\d+)$/);
    if (!match) {
      throw new Error(`Invalid page range "${token}". Use format like 1-3,5,8-10.`);
    }

    const start = Number(match[1]);
    const end = Number(match[2]);

    if (start > end) {
      throw new Error(`Invalid page range "${token}". Start page must be before end page.`);
    }

    if (start < 1 || end > total) {
      throw new Error(`Page range "${token}" is outside the document page range 1-${total}.`);
    }

    for (let page = start; page <= end; page += 1) {
      selected.add(page);
    }
  }

  const pages = Array.from(selected).sort((a, b) => a - b);
  if (!pages.length) {
    throw new Error('Select at least one printable page.');
  }

  return pages;
}

export function normalizePrintOptions(input = {}, totalPages = 1) {
  const source = input && typeof input === 'object' ? input : {};
  const defaults = DEFAULT_PRINT_OPTIONS;

  const copies = positiveInt(source.copies, defaults.copies, 99);
  const pageMode = source.pages?.mode === 'custom' ? 'custom' : 'all';
  const pageRange = pageMode === 'custom' ? normalizeText(source.pages?.range, 100) : '';
  const selectedPages = pageMode === 'custom'
    ? parsePageRange(pageRange, totalPages)
    : parsePageRange('', totalPages);

  const scaleMode = pick(source.scale?.mode, ALLOWED_SCALE_MODES, defaults.scale.mode);
  const scalePercent = scaleMode === 'custom_percent'
    ? Math.max(10, Math.min(Number(source.scale?.percent) || 100, 400))
    : null;

  const watermarkEnabled = bool(source.watermark?.enabled, false);

  const normalized = {
    destination: {
      selectedHubId: source.destination?.selectedHubId || null,
      preferredAgentId: source.destination?.preferredAgentId || null,
      preferredPrinterName: normalizeText(source.destination?.preferredPrinterName, 80) || null
    },
    pages: {
      mode: pageMode,
      range: pageRange,
      selected: selectedPages
    },
    copies,
    orientation: pick(source.orientation, ALLOWED_ORIENTATIONS, defaults.orientation),
    colorMode: pick(source.colorMode, ALLOWED_COLOR_MODES, defaults.colorMode),
    paperSize: pick(source.paperSize, ALLOWED_PAPER_SIZES, defaults.paperSize),
    sides: pick(source.sides, ALLOWED_SIDES, defaults.sides),
    scale: {
      mode: scaleMode,
      percent: scalePercent
    },
    pagesPerSheet: pick(Number(source.pagesPerSheet), ALLOWED_PAGES_PER_SHEET, defaults.pagesPerSheet),
    margins: {
      mode: pick(source.margins?.mode, ALLOWED_MARGIN_MODES, defaults.margins.mode)
    },
    format: pick(source.format, ALLOWED_FORMATS, defaults.format),
    headersFooters: bool(source.headersFooters, defaults.headersFooters),
    backgrounds: bool(source.backgrounds, defaults.backgrounds),
    quality: {
      dpi: Math.max(72, Math.min(positiveInt(source.quality?.dpi, defaults.quality.dpi, 2400), 2400))
    },
    watermark: {
      enabled: watermarkEnabled,
      type: pick(source.watermark?.type, ALLOWED_WATERMARK_TYPES, defaults.watermark.type),
      text: normalizeText(source.watermark?.text, 120),
      position: pick(source.watermark?.position, ALLOWED_WATERMARK_POSITIONS, defaults.watermark.position),
      opacity: Math.max(0.05, Math.min(Number(source.watermark?.opacity) || defaults.watermark.opacity, 0.6)),
      fontSize: Math.max(8, Math.min(Number(source.watermark?.fontSize) || defaults.watermark.fontSize, 72)),
      rotation: Math.max(-90, Math.min(Number(source.watermark?.rotation) || defaults.watermark.rotation, 90))
    }
  };

  if (normalized.format === 'simplified') {
    throw new Error('Simplified format is not supported for uploaded PDF documents yet.');
  }

  return normalized;
}

export function mapLegacyFieldsToPrintOptions({
  pages,
  copies,
  colorType,
  sideType,
  watermarkEnabled,
  preferredPrinterName,
  selectedHubId,
  preferredAgentId
} = {}) {
  return {
    destination: {
      selectedHubId: selectedHubId || null,
      preferredAgentId: preferredAgentId || null,
      preferredPrinterName: preferredPrinterName || null
    },
    pages: {
      mode: 'all',
      range: ''
    },
    copies: positiveInt(copies, 1, 99),
    orientation: 'auto',
    colorMode: colorType === 'color' ? 'color' : 'black_white',
    paperSize: 'A4',
    sides: sideType === 'double' ? 'two_sided_long_edge' : 'one_sided',
    scale: {
      mode: 'original',
      percent: null
    },
    pagesPerSheet: 1,
    margins: {
      mode: 'default'
    },
    format: 'original',
    headersFooters: false,
    backgrounds: true,
    watermark: {
      enabled: Boolean(watermarkEnabled),
      type: 'order_code',
      text: '',
      position: 'bottom_right',
      opacity: 0.18,
      fontSize: 18,
      rotation: 0
    }
  };
}

export function getPrintCounts(printOptions, totalPages) {
  const options = normalizePrintOptions(printOptions, totalPages);
  const selectedPageCount = options.pages.selected.length;
  const printablePageCount = selectedPageCount * options.copies;
  const imposedPageGroups = Math.ceil(printablePageCount / options.pagesPerSheet);
  const sheetCount = options.sides === 'one_sided'
    ? imposedPageGroups
    : Math.ceil(imposedPageGroups / 2);

  return {
    selectedPageCount,
    printablePageCount,
    sheetCount,
    options
  };
}

export function toLegacyColorType(colorMode) {
  return colorMode === 'color' ? 'color' : 'bw';
}

export function toLegacySideType(sides) {
  return sides === 'one_sided' ? 'single' : 'double';
}
