const DESKTOP_ONLY_RESPONSE = {
  success: false,
  error: "Desktop features are only available in PrintEase Desktop.",
};

function getBridge() {
  if (typeof window === "undefined") return null;
  return window.printeaseDesktop || null;
}

function desktopFallback() {
  return { ...DESKTOP_ONLY_RESPONSE };
}

export function isDesktop() {
  return Boolean(getBridge()?.isDesktop);
}

export async function listPrinters() {
  const bridge = getBridge();
  if (!bridge?.listPrinters) return desktopFallback();

  try {
    return await bridge.listPrinters();
  } catch (error) {
    return {
      success: false,
      error: error.message || DESKTOP_ONLY_RESPONSE.error,
    };
  }
}

export async function testPrint(payload = {}) {
  const bridge = getBridge();
  if (!bridge?.testPrint) return desktopFallback();

  try {
    return await bridge.testPrint(payload);
  } catch (error) {
    return {
      success: false,
      error: error.message || "Could not send test print.",
    };
  }
}

export async function stopPrinting() {
  const bridge = getBridge();
  if (!bridge?.stopPrinting) return desktopFallback();

  try {
    return await bridge.stopPrinting();
  } catch (error) {
    return {
      success: false,
      error: error.message || "Could not stop printing.",
    };
  }
}

export async function getDesktopStatus() {
  const bridge = getBridge();
  if (!bridge?.getDesktopStatus) return desktopFallback();

  try {
    return await bridge.getDesktopStatus();
  } catch (error) {
    return {
      success: false,
      error: error.message || "Could not load desktop status.",
    };
  }
}
