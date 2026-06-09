export const ORIENTATION = {
  AUTO: 'auto',
  PORTRAIT: 'portrait',
  LANDSCAPE: 'landscape'
};

export const COLOR_MODE = {
  BW: 'bw',
  COLOR: 'color'
};

export const SIDE_TYPE = {
  SINGLE: 'single',
  DOUBLE: 'double'
};

export const DUPLEX_BINDING = {
  AUTO: 'auto',
  LONG_EDGE: 'long-edge',
  SHORT_EDGE: 'short-edge'
};

export const BACK_SIDE_ROTATION = {
  AUTO: 'auto',
  NORMAL: 'normal',
  ROTATE_180: 'rotate-180'
};

export const SCALE_MODE = {
  FIT_TO_PAGE: 'fit-to-page',
  ACTUAL_SIZE: 'actual-size',
  SHRINK_TO_FIT: 'shrink-to-fit'
};

export const PAGE_ORDER = {
  NORMAL: 'normal',
  REVERSE: 'reverse'
};

/**
 * Normalizes raw print options from the frontend/API.
 */
export function normalizePrintOptions(rawOptions = {}) {
  if (!rawOptions || typeof rawOptions !== 'object') {
    rawOptions = {};
  }

  // Handle nested pages/selectedPages
  let selectedPages = 'all';
  if (rawOptions.selectedPages) {
    selectedPages = String(rawOptions.selectedPages);
  } else if (rawOptions.pages && rawOptions.pages.range) {
    selectedPages = String(rawOptions.pages.range);
  }

  return {
    paperSize: rawOptions.paperSize || 'A4',
    orientation: Object.values(ORIENTATION).includes(rawOptions.orientation) 
      ? rawOptions.orientation 
      : ORIENTATION.AUTO,
    colorMode: Object.values(COLOR_MODE).includes(rawOptions.colorMode) 
      ? rawOptions.colorMode 
      : (rawOptions.colorType === 'color' ? COLOR_MODE.COLOR : COLOR_MODE.BW),
    sideType: Object.values(SIDE_TYPE).includes(rawOptions.sideType) 
      ? rawOptions.sideType 
      : SIDE_TYPE.SINGLE,
    duplexBinding: Object.values(DUPLEX_BINDING).includes(rawOptions.duplexBinding) 
      ? rawOptions.duplexBinding 
      : DUPLEX_BINDING.AUTO,
    backSideRotation: Object.values(BACK_SIDE_ROTATION).includes(rawOptions.backSideRotation) 
      ? rawOptions.backSideRotation 
      : BACK_SIDE_ROTATION.AUTO,
    copies: Math.max(1, parseInt(rawOptions.copies, 10) || 1),
    selectedPages: selectedPages || 'all',
    scaleMode: Object.values(SCALE_MODE).includes(rawOptions.scaleMode) 
      ? rawOptions.scaleMode 
      : SCALE_MODE.FIT_TO_PAGE,
    pageOrder: Object.values(PAGE_ORDER).includes(rawOptions.pageOrder) 
      ? rawOptions.pageOrder 
      : PAGE_ORDER.NORMAL,
    collate: rawOptions.collate !== undefined ? Boolean(rawOptions.collate) : true
  };
}
