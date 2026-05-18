const { execFile } = require("node:child_process");
const { mkdtemp, rm, unlink, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

const POWERSHELL_ARGS = ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass"];

async function runPowerShell(script, args = []) {
  const commandArgs = [...POWERSHELL_ARGS, "-Command", script, ...args];

  try {
    return await execFileAsync("powershell.exe", commandArgs, {
      shell: false,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });
  } catch (error) {
    if (error.code === "ENOENT") {
      return execFileAsync("pwsh.exe", commandArgs, {
        shell: false,
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      });
    }

    throw error;
  }
}

function normalizePowerShellError(error, fallback) {
  return {
    success: false,
    error: String(error.stderr || error.message || fallback || "Windows printer command failed.").trim(),
  };
}

function normalizePrinterStatus(printer) {
  if (printer.WorkOffline) return "offline";

  const statuses = {
    1: "other",
    2: "unknown",
    3: "idle",
    4: "printing",
    5: "warmup",
    6: "stopped",
    7: "offline",
  };

  return statuses[Number(printer.PrinterStatus)] || "unknown";
}

function toPrinterObject(printer) {
  const printerName = printer.Name || printer.DeviceID || "";

  return {
    printerName,
    displayName: printerName,
    systemPrinterId: printer.DeviceID || printerName,
    status: normalizePrinterStatus(printer),
    isDefault: Boolean(printer.Default),
    rawStatus: JSON.stringify({
      printerStatus: printer.PrinterStatus,
      workOffline: printer.WorkOffline,
      shared: printer.Shared,
    }),
    platform: "win32",
  };
}

function parsePrinterJson(output) {
  const trimmed = String(output || "").trim();
  if (!trimmed) return [];

  const parsed = JSON.parse(trimmed);
  const printers = Array.isArray(parsed) ? parsed : [parsed];

  return printers.map(toPrinterObject).filter((printer) => printer.printerName);
}

function createWindowsJobId(printerName) {
  return `win32:${Buffer.from(printerName, "utf8").toString("base64url")}:${Date.now()}`;
}

function parseWindowsJobId(jobId) {
  const [, encodedPrinterName] = String(jobId || "").split(":");
  if (!encodedPrinterName) return "";

  try {
    return Buffer.from(encodedPrinterName, "base64url").toString("utf8");
  } catch {
    return "";
  }
}

async function listPrinters() {
  const script = `
$printers = Get-CimInstance Win32_Printer |
  Select-Object Name, DeviceID, PrinterStatus, WorkOffline, Default, Shared
$printers | ConvertTo-Json -Depth 3
`;

  try {
    const { stdout } = await runPowerShell(script);
    return parsePrinterJson(stdout);
  } catch (error) {
    return normalizePowerShellError(error, "Could not list Windows printers.");
  }
}

async function validatePrinter(printerName) {
  if (!printerName || typeof printerName !== "string") {
    return {
      success: false,
      error: "Select a printer before printing.",
    };
  }

  const printers = await listPrinters();
  if (!Array.isArray(printers)) return printers;

  const selectedPrinter = printers.find((printer) => printer.printerName === printerName);
  if (!selectedPrinter) {
    return {
      success: false,
      error: "Selected printer was not found in the current Windows printer list.",
    };
  }

  return {
    success: true,
    printer: selectedPrinter,
  };
}

async function printFile({ printerName, filePath, copies = 1 } = {}) {
  const validation = await validatePrinter(printerName);
  if (!validation.success) return validation;

  if (!filePath || typeof filePath !== "string") {
    return {
      success: false,
      error: "A file path is required before printing.",
    };
  }

  const safeCopies = Math.max(1, Math.min(Number(copies) || 1, 99));
  const script = `
$FilePath = $args[0]
$PrinterName = $args[1]
$Copies = [int]$args[2]
if (-not (Test-Path -LiteralPath $FilePath)) {
  throw "Print file was not found."
}
for ($i = 0; $i -lt $Copies; $i++) {
  Get-Content -LiteralPath $FilePath | Out-Printer -Name $PrinterName
}
Write-Output "Print job submitted"
`;

  try {
    const { stdout, stderr } = await runPowerShell(script, [
      filePath,
      validation.printer.printerName,
      String(safeCopies),
    ]);

    return {
      success: true,
      message: "Print job sent to Windows printer.",
      printerName: validation.printer.printerName,
      jobId: createWindowsJobId(validation.printer.printerName),
      stdout: stdout?.trim() || "",
      stderr: stderr?.trim() || "",
    };
  } catch (error) {
    return normalizePowerShellError(error, "Could not send Windows print job.");
  }
}

async function testPrint(printerName) {
  const validation = await validatePrinter(printerName);
  if (!validation.success) return validation;

  let tempDir = "";
  let tempFile = "";

  try {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "printease-test-"));
    tempFile = path.join(tempDir, "test-print.txt");

    await writeFile(
      tempFile,
      [
        "PrintEase Desktop test print",
        `Printer: ${validation.printer.printerName}`,
        `Platform: ${process.platform}`,
        `Time: ${new Date().toISOString()}`,
        "",
      ].join("\n"),
      "utf8"
    );

    const result = await printFile({
      printerName: validation.printer.printerName,
      filePath: tempFile,
      copies: 1,
    });

    return result.success
      ? {
          ...result,
          message: "Test print job sent to Windows printer.",
        }
      : result;
  } catch (error) {
    return normalizePowerShellError(error, "Could not send Windows test print.");
  } finally {
    if (tempFile) {
      await unlink(tempFile).catch(() => {});
    }
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

async function cancelJob(jobId) {
  const printerName = parseWindowsJobId(jobId);

  if (!printerName) {
    return {
      success: false,
      error: "Windows printer job id is invalid.",
    };
  }

  const validation = await validatePrinter(printerName);
  if (!validation.success) return validation;

  const script = `
$PrinterName = $args[0]
$jobs = Get-PrintJob -PrinterName $PrinterName -ErrorAction Stop
foreach ($job in $jobs) {
  Remove-PrintJob -PrinterName $PrinterName -ID $job.ID -ErrorAction Stop
}
Write-Output "Cancelled $($jobs.Count) print job(s)"
`;

  try {
    const { stdout, stderr } = await runPowerShell(script, [validation.printer.printerName]);

    return {
      success: true,
      message: `Cancelled Windows print jobs for ${validation.printer.printerName}.`,
      jobId,
      printerName: validation.printer.printerName,
      stdout: stdout?.trim() || "",
      stderr: stderr?.trim() || "",
    };
  } catch (error) {
    return normalizePowerShellError(error, "Could not cancel Windows print jobs.");
  }
}

module.exports = {
  cancelJob,
  listPrinters,
  printFile,
  testPrint,
};
