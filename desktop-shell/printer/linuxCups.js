import { execFile } from "node:child_process";
import { mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const LPSTAT_NOT_FOUND = "CUPS/lpstat not found. Install cups and cups-client.";
const HELP_COMMANDS = [
  "sudo apt update",
  "sudo apt install cups cups-client printer-driver-cups-pdf",
  "sudo systemctl enable cups",
  "sudo systemctl start cups",
  "lpstat -p",
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
  const match = String(output || "").match(/system default destination:\s*(.+)$/im);
  return match?.[1]?.trim() || "";
}

function parsePrinterStatus(rawStatus) {
  const match = rawStatus.match(/^printer\s+\S+\s+is\s+([^.\n]+)/i);
  return match?.[1]?.trim() || "unknown";
}

function parsePrinters(printerOutput, defaultPrinter) {
  return String(printerOutput || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("printer "))
    .map((line) => {
      const [, printerName = ""] = line.match(/^printer\s+(\S+)/i) || [];

      return {
        printerName,
        displayName: printerName,
        systemPrinterId: printerName,
        status: parsePrinterStatus(line),
        isDefault: printerName === defaultPrinter,
        rawStatus: line,
        platform: "linux",
      };
    })
    .filter((printer) => printer.printerName);
}

function cupsFailure(error, fallbackMessage) {
  const message = String(error.stderr || error.message || fallbackMessage || "").trim();

  if (error.code === "ENOENT") {
    return {
      success: false,
      printers: [],
      error: LPSTAT_NOT_FOUND,
      helpCommands: HELP_COMMANDS,
    };
  }

  return {
    success: false,
    printers: [],
    error: message || fallbackMessage || "CUPS command failed.",
    helpCommands: HELP_COMMANDS,
  };
}

export async function listPrinters() {
  try {
    const [{ stdout: printerOutput }, defaultResult] = await Promise.all([
      runCommand("lpstat", ["-p"]),
      runCommand("lpstat", ["-d"]).catch((error) => ({ stdout: "", stderr: error.stderr || error.message })),
    ]);

    const defaultPrinter = parseDefaultPrinter(defaultResult.stdout || "");

    return {
      success: true,
      printers: parsePrinters(printerOutput, defaultPrinter),
      defaultPrinter,
    };
  } catch (error) {
    return cupsFailure(error, "Could not list CUPS printers.");
  }
}

async function validatePrinter(printerName) {
  if (!printerName || typeof printerName !== "string") {
    return {
      success: false,
      error: "Select a printer before sending a test print.",
    };
  }

  const result = await listPrinters();
  if (!result.success) return result;

  const printer = result.printers.find((item) => item.printerName === printerName);
  if (!printer) {
    return {
      success: false,
      error: "Selected printer was not found in the detected local printers.",
    };
  }

  return {
    success: true,
    printer,
  };
}

export async function testPrint(printerName) {
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

    const { stdout, stderr } = await runCommand("lp", ["-d", validation.printer.printerName, tempFile]);

    return {
      success: true,
      message: "Test print job sent to CUPS.",
      printerName: validation.printer.printerName,
      stdout: stdout?.trim() || "",
      stderr: stderr?.trim() || "",
    };
  } catch (error) {
    return cupsFailure(error, "Could not send test print job.");
  } finally {
    if (tempFile) {
      await unlink(tempFile).catch(() => {});
    }
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
