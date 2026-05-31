export async function listPrinters() {
  return {
    success: false,
    printers: [],
    message: "Windows printer detection will be implemented later.",
  };
}

export async function testPrint() {
  return {
    success: false,
    message: "Windows print execution will be implemented later.",
  };
}

export async function printFile({ printOptions = {} } = {}) {
  return {
    success: false,
    reasonCode: "WINDOWS_PRINT_OPTIONS_NOT_IMPLEMENTED",
    message: "Windows print option mapping is not implemented yet.",
    printOptions,
  };
}
