import { useEffect, useMemo, useState } from "react";
import { Link2, Printer, RefreshCw, Send, Wifi, X } from "lucide-react";
import Card from "../components/Card";
import {
  checkBackendHealth,
  confirmPairing,
  getAgentStatus,
  getDesktopStatus,
  isDesktop,
  listPrinters,
  pollPrintJobs,
  sendHeartbeat,
  startJobPolling,
  startPairing,
  stopJobPolling,
  stopPrinting,
  syncPrinters as syncDesktopPrinters,
  testPrint,
} from "../utils/desktopBridge";

function normalizePrinterResult(result) {
  if (Array.isArray(result)) {
    return {
      printers: result,
      error: "",
      detail: "",
      helpCommands: [],
    };
  }

  if (result?.success === false) {
    return {
      printers: [],
      error: result.error || result.message || "Could not load printers.",
      detail: result.detail || "",
      helpCommands: Array.isArray(result.helpCommands) ? result.helpCommands : [],
    };
  }

  return {
    printers: Array.isArray(result?.printers) ? result.printers : [],
    error: "",
    detail: "",
    helpCommands: [],
  };
}

export default function DesktopAgentPage() {
  const [desktopAvailable, setDesktopAvailable] = useState(() => isDesktop());
  const [status, setStatus] = useState(null);
  const [printers, setPrinters] = useState([]);
  const [selectedPrinterName, setSelectedPrinterName] = useState("");
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [errorDetail, setErrorDetail] = useState("");
  const [helpCommands, setHelpCommands] = useState([]);
  const [agentSession, setAgentSession] = useState(null);
  const [agentBusy, setAgentBusy] = useState(false);
  const [agentMessage, setAgentMessage] = useState("");
  const [backendHealth, setBackendHealth] = useState(null);

  const defaultPrinter = useMemo(() => printers.find((printer) => printer.isDefault) || printers[0] || null, [printers]);

  useEffect(() => {
    setDesktopAvailable(isDesktop());
  }, []);

  useEffect(() => {
    if (!desktopAvailable) return;

    getDesktopStatus().then((nextStatus) => {
      if (nextStatus?.success === false) {
        setError(nextStatus.error || "Could not load desktop status.");
        return;
      }

      setStatus(nextStatus);
    });

    getAgentStatus().then((nextSession) => {
      if (nextSession?.success) setAgentSession(nextSession);
    });
  }, [desktopAvailable]);

  useEffect(() => {
    if (defaultPrinter && !selectedPrinterName) {
      setSelectedPrinterName(defaultPrinter.printerName);
    }
  }, [defaultPrinter, selectedPrinterName]);

  async function refreshPrinters() {
    setLoadingPrinters(true);
    setError("");
    setErrorDetail("");
    setHelpCommands([]);
    setMessage("");

    const result = await listPrinters();
    const normalized = normalizePrinterResult(result);

    setPrinters(normalized.printers);
    setSelectedPrinterName(normalized.printers.find((printer) => printer.isDefault)?.printerName || normalized.printers[0]?.printerName || "");
    setError(normalized.error);
    setErrorDetail(normalized.detail);
    setHelpCommands(normalized.helpCommands);
    setLoadingPrinters(false);
  }

  async function sendTestPrint() {
    setError("");
    setErrorDetail("");
    setHelpCommands([]);
    setMessage("");

    if (!selectedPrinterName) {
      setError("Select a printer before sending a test print.");
      return;
    }

    const result = await testPrint({ printerName: selectedPrinterName });

    if (result?.success === false) {
      setError(result.error || result.message || "Could not send test print.");
      return;
    }

    setMessage(result?.message || "Test print sent.");
  }

  async function stopLocalPrinting() {
    setError("");
    setErrorDetail("");
    setHelpCommands([]);
    setMessage("");

    const result = await stopPrinting();

    if (result?.success === false) {
      setError(result.error || result.message || "Could not stop printing.");
      return;
    }

    setMessage(result?.message || "Printing stopped locally.");
  }

  async function runAgentAction(action) {
    setAgentBusy(true);
    setAgentMessage("");
    setError("");
    setErrorDetail("");
    setHelpCommands([]);

    const result = await action();

    if (result?.session) setAgentSession(result.session);

    if (result?.success === false) {
      setError(result.error || result.message || "Desktop agent action failed.");
    } else {
      setAgentMessage(result?.message || (result?.paired === false ? "Pairing is still pending." : "Desktop agent action completed."));
    }

    setAgentBusy(false);
    return result;
  }

  async function checkHealth() {
    const result = await checkBackendHealth();
    setBackendHealth(result);

    if (result?.success === false) {
      setError(result.error || result.message || "Render backend health check failed.");
      return;
    }

    setMessage("Render backend health check passed.");
  }

  if (!desktopAvailable) {
    return (
      <Card>
        <div className="flex items-center gap-3">
          <Printer size={22} />
          <div>
            <h2 className="text-2xl font-bold">Desktop Agent</h2>
            <p className="mt-1 text-slate-600">Open PrintEase Desktop to use printer controls.</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <Wifi size={24} />
            <div>
              <h2 className="text-3xl font-bold">Desktop Agent</h2>
              <p className="mt-1 font-semibold text-emerald-700">Desktop mode detected</p>
              <p className="mt-2 text-sm text-slate-600">Platform: {status?.platform || window.printeaseDesktop?.platform || "unknown"}</p>
              <p className="text-sm text-slate-600">Backend: {status?.backendUrl || "https://printease-backend-byex.onrender.com"}</p>
              {backendHealth && (
                <p className={`mt-1 text-sm font-semibold ${backendHealth.success ? "text-emerald-700" : "text-rose-700"}`}>
                  Backend health: {backendHealth.success ? "online" : "unreachable"}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={checkHealth}
              className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 font-semibold"
            >
              <Wifi size={16} /> Check Backend
            </button>
            <button
              type="button"
              onClick={refreshPrinters}
              disabled={loadingPrinters}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white disabled:opacity-60"
            >
              <RefreshCw size={16} /> {loadingPrinters ? "Refreshing" : "Refresh Printers"}
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Link2 size={20} />
              <h3 className="text-xl font-bold">Backend Agent</h3>
            </div>
            <div className="mt-3 grid gap-2 text-sm text-slate-600">
              <p>Device: {agentSession?.deviceName || "PrintEase Desktop"}</p>
              <p>Paired: {agentSession?.paired ? "Yes" : "No"}</p>
              {agentSession?.agentId && <p className="break-all">Agent ID: {agentSession.agentId}</p>}
              {agentSession?.pairingCode && (
                <p className="text-lg font-bold text-slate-900">Pairing code: {agentSession.pairingCode}</p>
              )}
              {agentSession?.expiresAt && <p>Expires: {new Date(agentSession.expiresAt).toLocaleString()}</p>}
              <p>Polling: {agentSession?.polling ? "Running" : "Stopped"}</p>
              {agentSession?.lastHeartbeatAt && <p>Last heartbeat: {new Date(agentSession.lastHeartbeatAt).toLocaleString()}</p>}
            </div>
          </div>

          <div className="grid gap-2 sm:min-w-[300px]">
            <button
              type="button"
              disabled={agentBusy}
              onClick={() => runAgentAction(() => startPairing({ deviceName: agentSession?.deviceName || "PrintEase Desktop" }))}
              className="rounded-xl border px-4 py-2 font-semibold"
            >
              Start Pairing
            </button>
            <button
              type="button"
              disabled={agentBusy || !agentSession?.pairingSessionId}
              onClick={() => runAgentAction(confirmPairing)}
              className="rounded-xl border px-4 py-2 font-semibold disabled:opacity-50"
            >
              Confirm Pairing
            </button>
            <button
              type="button"
              disabled={agentBusy || !agentSession?.paired}
              onClick={() => runAgentAction(sendHeartbeat)}
              className="rounded-xl border px-4 py-2 font-semibold disabled:opacity-50"
            >
              Send Heartbeat
            </button>
            <button
              type="button"
              disabled={agentBusy || !agentSession?.paired}
              onClick={() => runAgentAction(syncDesktopPrinters)}
              className="rounded-xl border px-4 py-2 font-semibold disabled:opacity-50"
            >
              Sync Printers
            </button>
            <button
              type="button"
              disabled={agentBusy || !agentSession?.paired || !selectedPrinterName}
              onClick={() => runAgentAction(() => pollPrintJobs({ printerName: selectedPrinterName }))}
              className="rounded-xl border px-4 py-2 font-semibold disabled:opacity-50"
            >
              Poll Once
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={agentBusy || !agentSession?.paired || !selectedPrinterName}
                onClick={() => runAgentAction(() => startJobPolling({ printerName: selectedPrinterName }))}
                className="flex-1 rounded-xl bg-emerald-700 px-4 py-2 font-semibold text-white disabled:bg-slate-300"
              >
                Start Polling
              </button>
              <button
                type="button"
                disabled={agentBusy}
                onClick={() => runAgentAction(stopJobPolling)}
                className="flex-1 rounded-xl border px-4 py-2 font-semibold"
              >
                Stop
              </button>
            </div>
          </div>
        </div>

        {agentMessage && (
          <p className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
            {agentMessage}
          </p>
        )}
      </Card>

      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1">
            <h3 className="text-xl font-bold">Local Printers</h3>
            {printers.length === 0 ? (
              <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                No printers loaded yet. Refresh printers to detect CUPS printers such as PDF.
              </p>
            ) : (
              <div className="mt-4 grid gap-3">
                {printers.map((printer) => (
                  <label key={printer.systemPrinterId || printer.printerName} className="flex cursor-pointer items-start gap-3 rounded-2xl border p-4">
                    <input
                      type="radio"
                      name="desktopPrinter"
                      value={printer.printerName}
                      checked={selectedPrinterName === printer.printerName}
                      onChange={(event) => setSelectedPrinterName(event.target.value)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block font-semibold">
                        {printer.displayName || printer.printerName}
                        {printer.isDefault ? " · Default" : ""}
                      </span>
                      <span className="block text-sm text-slate-600">{printer.status || "unknown"} · {printer.platform}</span>
                      {printer.rawStatus && <span className="mt-1 block text-xs text-slate-500">{printer.rawStatus}</span>}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:min-w-[260px]">
            <button
              type="button"
              onClick={sendTestPrint}
              disabled={!selectedPrinterName}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white disabled:bg-slate-300"
            >
              <Send size={16} /> Test Print
            </button>
            <button
              type="button"
              onClick={stopLocalPrinting}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 px-4 py-3 font-semibold text-rose-700 hover:bg-rose-50"
            >
              <X size={16} /> STOP Printing
            </button>
          </div>
        </div>

        {(message || error) && (
          <div className={`mt-5 rounded-2xl p-4 text-sm ${error ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
            <p className="font-semibold">{error || message}</p>
            {errorDetail && <p className="mt-2 text-xs">{errorDetail}</p>}
            {helpCommands.length > 0 && (
              <div className="mt-3 grid gap-2">
                {helpCommands.map((command) => (
                  <code key={command} className="block rounded-xl bg-white/70 px-3 py-2 text-xs text-slate-800">
                    {command}
                  </code>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
