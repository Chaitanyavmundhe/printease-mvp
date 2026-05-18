const { execFile } = require("node:child_process");
const { mkdtemp, rm, unlink, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const LPSTAT_NOT_FOUND = "CUPS/lpstat not found. Install cups and cups-client.";
const CUPS_NOT_RUNNING = "CUPS scheduler is not running. Start cups before refreshing printers.";
const CUPS_HELP_COMMANDS = [
  "sudo systemctl enable --now cups",
  "sudo apt install cups cups-client printer-driver-cups-pdf",
];

async function runCommand(command, args) {
  try {
    return await execFileAsync(command, args, {
      shell: false,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });
  } catch (error) {
    if (error.code === "ENOENT") {
      const notFound = new Error(command === "lpstat" ? LPSTAT_NOT_FOUND : `${command} not found.`);
      notFound.code = "ENOENT";
      throw notFound;
    }

    throw error;
  }
}

function parseDefaultPrinter(output) {
  const match = output.match(/system default destination:\s*(.+)$/im);
  return match?.[1]?.trim() || "";
}

function parsePrinterStatus(rawStatus) {
  const match = rawStatus.match(/^printer\s+\S+\s+is\s+([^.\n]+)/i);
  return match?.[1]?.trim() || "unknown";
}

function parsePrinters(printerOutput, defaultPrinter) {
  return printerOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("printer "))
    .map((line) => {
      const [, printerName = ""] = line.match(/^printer\s+(\S+)/i) || [];
      const status = parsePrinterStatus(line);

      return {
        printerName,
        displayName: printerName,
        systemPrinterId: printerName,
        status,
        isDefault: printerName === defaultPrinter,
        rawStatus: line,
        platform: "linux",
      };
    })
    .filter((printer) => printer.printerName);
}

function parseCupsJobId(output) {
  const match = String(output || "").match(/request id is\s+(\S+)/i);
  return match?.[1] || "";
}

function normalizeCupsError(error, fallback) {
  const message = String(error.stderr || error.message || fallback || "").trim();

  if (/scheduler is not running/i.test(message)) {
    return {
      success: false,
      error: CUPS_NOT_RUNNING,
      detail: message,
      helpCommands: CUPS_HELP_COMMANDS,
    };
  }

  if (error.code === "ENOENT") {
    return {
      success: false,
      error: LPSTAT_NOT_FOUND,
      helpCommands: CUPS_HELP_COMMANDS,
    };
  }

  return {
    success: false,
    error: message || fallback || "CUPS command failed.",
  };
}

async function listPrinters() {
  try {
    const [{ stdout: printerOutput }, defaultResult] = await Promise.all([
      runCommand("lpstat", ["-p"]),
      runCommand("lpstat", ["-d"]).catch((error) => ({ stdout: "", stderr: error.stderr || error.message })),
    ]);

    const defaultPrinter = parseDefaultPrinter(defaultResult.stdout || "");
    return parsePrinters(printerOutput || "", defaultPrinter);
  } catch (error) {
    return normalizeCupsError(error, "Could not list CUPS printers.");
  }
}

async function validatePrinter(printerName) {
  if (!printerName || typeof printerName !== "string") {
    return {
      success: false,
      error: "Select a printer before sending a test print.",
    };
  }

  const printers = await listPrinters();
  if (!Array.isArray(printers)) return printers;

  const selectedPrinter = printers.find((printer) => printer.printerName === printerName);
  if (!selectedPrinter) {
    return {
      success: false,
      error: "Selected printer was not found in the current CUPS printer list.",
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

  try {
    const { stdout, stderr } = await runCommand("lp", [
      "-d",
      validation.printer.printerName,
      "-n",
      String(safeCopies),
      filePath,
    ]);

    return {
      success: true,
      message: "Print job sent to CUPS.",
      printerName: validation.printer.printerName,
      jobId: parseCupsJobId(stdout),
      stdout: stdout?.trim() || "",
      stderr: stderr?.trim() || "",
    };
  } catch (error) {
    return normalizeCupsError(error, "Could not send print job.");
  }
}

async function testPrint(printerName) {
  const validation = await validatePrinter(printerName);
  if (!validation.success) return validation;

  let tempFile = "";
  let tempDir = "";

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
          message: "Test print job sent to CUPS.",
        }
      : result;
  } catch (error) {
    return normalizeCupsError(error, "Could not send test print job.");
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
  if (!jobId || typeof jobId !== "string") {
    return {
      success: false,
      error: "CUPS job id is required before cancelling.",
    };
  }

  try {
    const { stdout, stderr } = await runCommand("cancel", [jobId]);

    return {
      success: true,
      message: `Cancelled CUPS job ${jobId}.`,
      jobId,
      stdout: stdout?.trim() || "",
      stderr: stderr?.trim() || "",
    };
  } catch (error) {
    return normalizeCupsError(error, `Could not cancel CUPS job ${jobId}.`);
  }
}

module.exports = {
  cancelJob,
  listPrinters,
  printFile,
  testPrint,
};
