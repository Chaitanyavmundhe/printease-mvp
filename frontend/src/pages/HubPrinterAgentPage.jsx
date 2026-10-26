import { useEffect, useMemo, useState } from "react";
import { Activity, Link2, Pause, Play, Printer, RefreshCw, RotateCcw, ShieldX, Wifi } from "lucide-react";
import Card from "../components/Card";
import Metric from "../components/Metric";
import StatusBadge from "../components/StatusBadge";
import {
  apiRequest,
  checkBackendHealth,
  getHubAgentSummary,
  pairAgent,
  pauseHubAgent,
  resumeHubAgent,
  revokeHubAgent,
} from "../services/api";
import { isDesktop, listPrinters as listLocalPrinters, onPrintersUpdated } from "../utils/desktopBridge";
import HubPrinterTestWizard from "../components/HubPrinterTestWizard";

const EMPTY_ANALYTICS = {
  totalAgents: 0,
  onlineAgents: 0,
  offlineAgents: 0,
  pausedAgents: 0,
  revokedAgents: 0,
  totalPrinters: 0,
  availablePrinters: 0,
  offlinePrinters: 0,
  pausedPrinters: 0,
  queuedJobs: 0,
  printingJobs: 0,
  completedJobsToday: 0,
  failedJobsToday: 0,
};

function shortId(value) {
  if (!value) return "N/A";
  return String(value).slice(0, 8);
}

function label(value) {
  return String(value || "-")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDateTime(value) {
  if (!value) return "Not seen yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function agentLabel(agent) {
  return agent?.agentName || agent?.deviceName || agent?.deviceId || shortId(agent?.id);
}

export default function HubPrinterAgentPage({ navigate }) {
  const [desktopAvailable, setDesktopAvailable] = useState(() => isDesktop());
  const [localPrinters, setLocalPrinters] = useState([]);
  const [localPrinterError, setLocalPrinterError] = useState("");
  const [agents, setAgents] = useState([]);
  const [printers, setPrinters] = useState([]);
  const [printJobs, setPrintJobs] = useState([]);
  const [analytics, setAnalytics] = useState(EMPTY_ANALYTICS);
  const [backendHealth, setBackendHealth] = useState(null);
  const [pairingCode, setPairingCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardPrinter, setWizardPrinter] = useState(null);

  const handleSaveProfile = async (platform, printerName, profile) => {
    const data = await apiRequest("/api/printers/profiles", {
      method: "PUT",
      body: JSON.stringify({ platform, printerName, profile }),
    });
    if (!data.success) throw new Error(data.message || "Failed to save profile.");
    setMessage(`Correction profile saved for ${printerName}.`);
  };

  const agentsById = useMemo(() => new Map(agents.map((agent) => [agent.id, agent])), [agents]);
  const localPrinterNames = localPrinters.map((printer) => printer.displayName || printer.printerName).filter(Boolean).join(", ");
  const printersByAgent = useMemo(() => {
    const grouped = new Map();
    for (const printer of printers) {
      const next = grouped.get(printer.agentId) || [];
      next.push(printer);
      grouped.set(printer.agentId, next);
    }
    return grouped;
  }, [printers]);

  async function refreshAll() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const [summary, health] = await Promise.all([
        getHubAgentSummary(),
        checkBackendHealth().catch((healthError) => ({ success: false, message: healthError.message })),
      ]);

      setAgents(Array.isArray(summary.agents) ? summary.agents : []);
      setPrinters(Array.isArray(summary.printers) ? summary.printers : []);
      setPrintJobs(Array.isArray(summary.printJobs) ? summary.printJobs : []);
      setAnalytics(summary.analytics || EMPTY_ANALYTICS);
      setBackendHealth(health);
      setLastUpdatedAt(new Date().toISOString());

      const desktopNow = isDesktop();
      setDesktopAvailable(desktopNow);

      if (desktopNow) {
        const localPrinterResult = await listLocalPrinters();
        setLocalPrinters(Array.isArray(localPrinterResult?.printers) ? localPrinterResult.printers : []);
        setLocalPrinterError(localPrinterResult?.success === false ? localPrinterResult.error || localPrinterResult.message || "Could not load local printers." : "");
      } else {
        setLocalPrinters([]);
        setLocalPrinterError("");
      }
    } catch (loadError) {
      setError(loadError.message || "Could not load printer agent dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    return onPrintersUpdated((result) => {
      setDesktopAvailable(true);
      setLocalPrinters(Array.isArray(result?.printers) ? result.printers : []);
      setLocalPrinterError(result?.success === false ? result.error || result.message || "Could not load local printers." : "");
    });
  }, []);

  useEffect(() => {
    refreshAll();
    const interval = setInterval(refreshAll, 7000);
    return () => clearInterval(interval);
  }, []);

  async function submitPairingCode() {
    const code = pairingCode.trim();
    setError("");
    setMessage("");

    if (!code) {
      setError("Enter the pairing code shown in PrintEase Desktop.");
      return;
    }

    setLoading(true);

    try {
      const data = await pairAgent(code);
      setPairingCode("");
      setMessage(data.message || "Device paired. Confirm pairing in PrintEase Desktop.");
      await refreshAll();
    } catch (pairError) {
      setError(pairError.message || "Could not pair desktop device.");
    } finally {
      setLoading(false);
    }
  }

  async function runAgentAction(agentId, action, fallbackMessage) {
    setActionId(agentId);
    setError("");
    setMessage("");

    try {
      const data = await action(agentId);
      setMessage(data.message || "Device updated.");
      await refreshAll();
    } catch (actionError) {
      setError(actionError.message || fallbackMessage);
    } finally {
      setActionId("");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">Printer & Desktop Agents</h2>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${backendHealth?.success ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${backendHealth?.success ? "bg-emerald-500" : "bg-amber-500"}`} />
              Backend {backendHealth?.success ? "Online" : "Offline"}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Monitor shop PC background agents, CUPS/spooler connections, and printer queues.
            {desktopAvailable && localPrinters.length > 0 && ` (Local: ${localPrinterNames})`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("hubDashboard")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition"
          >
            <RotateCcw size={14} /> Back to Hub
          </button>
          <button
            onClick={refreshAll}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60 shadow-sm transition"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {(message || error) && (
        <div className={`rounded-xl px-4 py-2.5 text-xs font-semibold flex items-center justify-between ${error ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>
          <span>{error || message}</span>
          <button onClick={() => { setError(""); setMessage(""); }} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>
      )}

      <div className="grid gap-3.5 grid-cols-2 sm:grid-cols-4">
        <Metric title="Online Agents" value={analytics.onlineAgents} icon={<Wifi size={16} />} />
        <Metric title="Available Printers" value={analytics.availablePrinters} icon={<Printer size={16} />} />
        <Metric title="Queued Jobs" value={analytics.queuedJobs} icon={<Activity size={16} />} />
        <Metric title="Failed Today" value={analytics.failedJobsToday} icon={<ShieldX size={16} />} />
      </div>

      <Card>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Pair New Shop PC</h3>
            <p className="mt-0.5 text-xs text-slate-500">Open PrintEase Desktop on the counter computer, generate a pairing code, and enter it below.</p>
          </div>
          <div className="flex gap-2 lg:w-[320px]">
            <input
              value={pairingCode}
              onChange={(event) => setPairingCode(event.target.value)}
              placeholder="Enter 6-digit code"
              className="min-w-0 flex-1 rounded-xl border border-slate-200/80 bg-slate-50/50 px-3 py-2 text-xs outline-none focus:bg-white focus:border-slate-400 focus:ring-1 focus:ring-slate-300"
            />
            <button
              onClick={submitPairingCode}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60 shadow-sm transition"
            >
              <Link2 size={14} /> Pair
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="text-xl font-bold">Connected Desktop Devices</h3>
        {agents.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            No online desktop devices are available. Open PrintEase Desktop on a shop PC, select a printer, and keep it connected.
          </p>
        ) : (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {agents.map((agent) => {
              const agentPrinters = printersByAgent.get(agent.id) || [];
              const busy = actionId === agent.id;
              return (
                <div key={agent.id} className="rounded-2xl border bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-bold">{agentLabel(agent)}</h4>
                      <p className="mt-1 text-xs text-slate-500">ID {shortId(agent.id)} · {agent.platform || "unknown"} · v{agent.version || "N/A"}</p>
                    </div>
                    <StatusBadge>{label(agent.liveStatus || agent.status)}</StatusBadge>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                    <p>Last seen: {formatDateTime(agent.lastSeenAt)}</p>
                    <p>Printers: {agentPrinters.length}</p>
                    <p>New jobs: {agent.paused ? "Disabled" : "Enabled"}</p>
                    <p>Paired: {formatDateTime(agent.pairedAt)}</p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => runAgentAction(agent.id, pauseHubAgent, "Could not disable new jobs.")}
                      disabled={busy || agent.paused || agent.liveStatus === "revoked"}
                      className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-50"
                    >
                      <Pause size={15} /> Disable New Jobs
                    </button>
                    <button
                      onClick={() => runAgentAction(agent.id, resumeHubAgent, "Could not enable new jobs.")}
                      disabled={busy || !agent.paused || agent.liveStatus === "revoked"}
                      className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-50"
                    >
                      <Play size={15} /> Enable New Jobs
                    </button>
                    <button
                      onClick={() => runAgentAction(agent.id, revokeHubAgent, "Could not revoke device.")}
                      disabled={busy || agent.liveStatus === "revoked"}
                      className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50"
                    >
                      <ShieldX size={15} /> Revoke
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-xl font-bold">Local Desktop Printers</h3>
            <p className="mt-1 text-sm text-slate-600">
              {desktopAvailable ? "Detected in this desktop shell before backend sync." : "Open PrintEase Desktop to detect local printers."}
            </p>
          </div>
          {desktopAvailable && (
            <button onClick={() => navigate("desktopAgent")} className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 font-semibold">
              <Printer size={16} /> Desktop Agent
            </button>
          )}
        </div>
        {localPrinterError ? (
          <p className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">{localPrinterError}</p>
        ) : localPrinters.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            {desktopAvailable ? "No local desktop printers detected in this view." : "Desktop bridge disconnected. Open this page inside the PrintEase Desktop window to see local printers."}
          </p>
        ) : (
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {localPrinters.map((printer) => (
              <div key={printer.systemPrinterId || printer.printerName} className="rounded-2xl border bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-bold">{printer.displayName || printer.printerName}</h4>
                    <p className="mt-1 text-sm text-slate-600">{printer.rawStatus || printer.status || "unknown"}</p>
                  </div>
                  <StatusBadge>{label(printer.isDefault ? "default" : printer.status || "local")}</StatusBadge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h3 className="text-xl font-bold">Synced Printer Status</h3>
        <p className="mt-1 text-sm text-slate-600">These are status reports from desktop devices. The backend does not stop, pause, or command local OS printers.</p>
        {printers.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            No printers synced yet. Open Desktop Agent page and click Refresh Printers.
          </p>
        ) : (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {printers.map((printer) => {
              const agent = agentsById.get(printer.agentId);
              return (
                <div key={printer.id || `${printer.agentId}-${printer.printerName}`} className="rounded-2xl border bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-bold">{printer.printerName}</h4>
                      <p className="mt-1 text-sm text-slate-600">{agentLabel(agent)} · {printer.systemPrinterId || "system printer"}</p>
                    </div>
                    <StatusBadge>{label(printer.condition || printer.status || "unknown")}</StatusBadge>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                    <p>{printer.isDefault ? "Default printer" : "Not default"}</p>
                    <p>Accepting: {printer.accepting === false ? "No" : "Yes"}</p>
                    <p>Last checked: {formatDateTime(printer.lastCheckedAt)}</p>
                    {printer.warningText && <p className="font-semibold text-amber-700 sm:col-span-2">{printer.warningCode}: {printer.warningText}</p>}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button 
                      onClick={() => {
                        setWizardPrinter({ name: printer.printerName, platform: agent?.platform || 'unknown' });
                        setWizardOpen(true);
                      }}
                      className="rounded-xl border px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Run Test Wizard
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {wizardOpen && wizardPrinter && (
        <HubPrinterTestWizard
          isOpen={wizardOpen}
          onClose={() => setWizardOpen(false)}
          printerName={wizardPrinter.name}
          platform={wizardPrinter.platform}
          onSaveProfile={handleSaveProfile}
        />
      )}

      <Card>
        <h3 className="text-xl font-bold">Print Jobs</h3>
        {printJobs.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">No print jobs have been queued yet.</p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="py-3">Job</th>
                  <th>Order</th>
                  <th>Status</th>
                  <th>Printer</th>
                  <th>Device</th>
                  <th>Failure</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {printJobs.map((job) => {
                  const agent = agentsById.get(job.agentId);
                  return (
                    <tr key={job.id} className="border-b">
                      <td className="py-3 font-semibold">{shortId(job.id)}</td>
                      <td>{shortId(job.orderId)}</td>
                      <td><StatusBadge>{label(job.status)}</StatusBadge></td>
                      <td>{job.printerName || "Unassigned"}</td>
                      <td>{agentLabel(agent)}</td>
                      <td className="max-w-[220px] text-rose-700">{job.failureReasonText || "-"}</td>
                      <td>{formatDateTime(job.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
