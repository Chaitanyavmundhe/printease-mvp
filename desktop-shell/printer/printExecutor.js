const linuxCups = require("./linuxCups.js");
const windowsPrinter = require("./windowsPrinter.js");

let printingPaused = false;
const activeJobs = new Map();

function unsupportedPlatform() {
  return {
    success: false,
    error: `Printer support is not implemented for ${process.platform}.`,
  };
}

function getPrinterModule() {
  if (process.platform === "linux") return linuxCups;
  if (process.platform === "win32") return windowsPrinter;
  return null;
}

async function listPrinters() {
  const printerModule = getPrinterModule();
  if (!printerModule) return unsupportedPlatform();

  return printerModule.listPrinters();
}

async function testPrint(printerName) {
  if (printingPaused) {
    return {
      success: false,
      error: "Printing is paused locally. Resume support will be added in a later phase.",
    };
  }

  const printerModule = getPrinterModule();
  if (!printerModule) return unsupportedPlatform();

  const result = await printerModule.testPrint(printerName);
  if (result?.success && result.jobId) {
    activeJobs.set(result.jobId, {
      platform: process.platform,
      printerName,
      createdAt: new Date().toISOString(),
    });
  }

  return result;
}

async function printFile({ printerName, filePath, copies = 1 } = {}) {
  if (printingPaused) {
    return {
      success: false,
      error: "Printing is paused locally. Restart the desktop shell to resume printing in this phase.",
    };
  }

  const printerModule = getPrinterModule();
  if (!printerModule?.printFile) return unsupportedPlatform();

  const result = await printerModule.printFile({ printerName, filePath, copies });
  if (result?.success && result.jobId) {
    activeJobs.set(result.jobId, {
      platform: process.platform,
      printerName,
      filePath,
      createdAt: new Date().toISOString(),
    });
  }

  return result;
}

async function stopPrinting() {
  printingPaused = true;
  const printerModule = getPrinterModule();
  const cancelResults = [];

  if (printerModule?.cancelJob) {
    for (const jobId of activeJobs.keys()) {
      const result = await printerModule.cancelJob(jobId);
      cancelResults.push(result);
      if (result?.success) activeJobs.delete(jobId);
    }
  }

  return {
    success: true,
    message: cancelResults.length
      ? "Printing paused locally. Active tracked jobs were sent for cancellation."
      : "Printing paused locally. No active tracked OS jobs were available to cancel.",
    cancelledJobs: cancelResults,
  };
}

module.exports = {
  listPrinters,
  printFile,
  testPrint,
  stopPrinting,
};
