import { useEffect, useMemo, useState } from "react";
import { BarChart3, FileText, IndianRupee, Link2, Printer, RefreshCw, Send, Wifi } from "lucide-react";
import Card from "../components/Card";
import Metric from "../components/Metric";
import StatusBadge from "../components/StatusBadge";
import { hubStatusOptions } from "../data/demoData";
import { getHubAgents, pairAgent, sendOrderToAgent } from "../services/api";

function normalizeStatus(status) {
  return String(status || "").toLowerCase().replace(/\s+/g, "_");
}

function isPaymentVerified(order) {
  const value = String(order?.paymentStatus || order?.payment_status || "").toLowerCase();
  return value === "verified" || value === "paid" || value.includes("verif");
}

const CLOSED_STATUSES = new Set(["collected", "refund_requested", "printing_failed", "cancelled"]);
const AGENT_LOCKED_STATUSES = new Set(["sent_to_agent", "queued_for_printing", "printing", "ready_for_pickup", "collected", "printing_failed"]);

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

function canSendToAgent(order) {
  return isPaymentVerified(order) && !AGENT_LOCKED_STATUSES.has(normalizeStatus(order.status));
}

export default function HubDashboard({ currentHub, hubOrders, updateOrderStatus, refreshOrders, navigate }) {
  const [agents, setAgents] = useState([]);
  const [agentPrinters, setAgentPrinters] = useState([]);
  const [printJobs, setPrintJobs] = useState([]);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentError, setAgentError] = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const [pairingMessage, setPairingMessage] = useState("");
  const [sendingOrderId, setSendingOrderId] = useState("");
  const ordersForHub = hubOrders || [];

  const totalPages = ordersForHub.reduce((sum, item) => sum + item.pages * item.copies, 0);
  const totalRevenue = ordersForHub.filter(isPaymentVerified).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const pendingOrders = ordersForHub.filter((item) => !CLOSED_STATUSES.has(normalizeStatus(item.status))).length;
  const primaryAgent = agents[0] || null;
  const defaultPrinter = agentPrinters.find((printer) => printer.isDefault) || agentPrinters[0] || null;
  const agentStatus = primaryAgent ? (primaryAgent.paused ? "Paused" : primaryAgent.status || "Offline") : "Offline";
  const jobByOrderId = useMemo(() => {
    return new Map(printJobs.map((job) => [job.orderId, job]));
  }, [printJobs]);

  async function refreshAgentStatus() {
    setAgentLoading(true);
    setAgentError("");

    try {
      const data = await getHubAgents();
      setAgents(Array.isArray(data.agents) ? data.agents : []);
      setAgentPrinters(Array.isArray(data.printers) ? data.printers : []);
      setPrintJobs(Array.isArray(data.printJobs) ? data.printJobs : []);
    } catch (error) {
      setAgentError(error.message || "Could not load agent status.");
    } finally {
      setAgentLoading(false);
    }
  }

  useEffect(() => {
    if (currentHub?.id) {
      refreshAgentStatus();
    }
  }, [currentHub?.id]);

  if (!currentHub) return <Card>Please login as print hub.</Card>;

  async function submitPairingCode() {
    const code = pairingCode.trim();
    setPairingMessage("");
    setAgentError("");

    if (!code) {
      setPairingMessage("Enter the code shown in the local PrintEase Hub Agent.");
      return;
    }

    setAgentLoading(true);

    try {
      const data = await pairAgent(code);
      setPairingCode("");
      setPairingMessage(data.message || "Agent paired.");
      await refreshAgentStatus();
    } catch (error) {
      setPairingMessage(error.message || "Could not pair agent.");
    } finally {
      setAgentLoading(false);
    }
  }

  async function sendToAgent(order) {
    const orderId = order.backendId || order.id;
    setSendingOrderId(orderId);
    setAgentError("");

    try {
      await sendOrderToAgent(orderId);
      await Promise.all([refreshAgentStatus(), refreshOrders?.()]);
    } catch (error) {
      setAgentError(error.message || "Could not send order to agent.");
    } finally {
      setSendingOrderId("");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold">Print Hub Dashboard</h2>
          <p className="text-slate-600">{currentHub.name} · Code {currentHub.code}</p>
        </div>
        <button onClick={() => navigate("hubPricing")} className="rounded-2xl bg-slate-900 px-5 py-3 font-semibold text-white">
          Manage Pricing
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Metric title="Total Orders" value={ordersForHub.length} icon={<FileText />} />
        <Metric title="Pending" value={pendingOrders} icon={<Printer />} />
        <Metric title="Pages Printed" value={totalPages} icon={<BarChart3 />} />
        <Metric title="Money Collected" value={`₹${totalRevenue}`} icon={<IndianRupee />} />
      </div>

      <Card>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Wifi size={20} />
              <h3 className="text-xl font-bold">PrintEase Agent</h3>
            </div>
            <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="font-semibold text-slate-900">Agent status</p>
                <StatusBadge>{agentStatus}</StatusBadge>
              </div>
              <div>
                <p className="font-semibold text-slate-900">Connected printer</p>
                <p>{defaultPrinter?.printerName || "Not selected"}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-900">Last seen</p>
                <p>{formatDateTime(primaryAgent?.lastSeenAt)}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-900">Agent ID</p>
                <p className="break-all">{primaryAgent?.id || "Not paired"}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:min-w-[320px]">
            <div className="flex gap-2">
              <input
                value={pairingCode}
                onChange={(event) => setPairingCode(event.target.value)}
                placeholder="Pairing code"
                className="min-w-0 flex-1 rounded-xl border px-3 py-2"
              />
              <button
                onClick={submitPairingCode}
                disabled={agentLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-50"
              >
                <Link2 size={16} /> Pair Agent
              </button>
            </div>
            <button
              onClick={refreshAgentStatus}
              disabled={agentLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2 font-semibold"
            >
              <RefreshCw size={16} /> Refresh Agent Status
            </button>
            {(pairingMessage || agentError) && (
              <p className={agentError ? "text-sm font-semibold text-rose-600" : "text-sm font-semibold text-emerald-700"}>
                {agentError || pairingMessage}
              </p>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="text-xl font-bold">Incoming / Active Orders</h3>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead>
              <tr className="border-b text-slate-500">
                <th className="py-3">Order ID</th>
                <th>Document</th>
                <th>Pages</th>
                <th>Amount</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Update</th>
                <th>Agent</th>
              </tr>
            </thead>
            <tbody>
              {ordersForHub.map((item) => {
                const job = jobByOrderId.get(item.backendId);
                const orderId = item.backendId || item.id;
                const sendEnabled = canSendToAgent(item);

                return (
                  <tr key={item.id} className="border-b">
                    <td className="py-3 font-semibold">{item.id}</td>
                    <td>{item.document}</td>
                    <td>{item.pages} × {item.copies}</td>
                    <td>₹{item.amount}</td>
                    <td><StatusBadge color="green">{item.paymentStatus}</StatusBadge></td>
                    <td>
                      <StatusBadge>{item.status}</StatusBadge>
                      {job?.failureReasonText && <p className="mt-1 text-xs font-semibold text-rose-600">{job.failureReasonText}</p>}
                    </td>
                    <td>
                      <select value={item.status} onChange={(e) => updateOrderStatus(item.id, e.target.value)} className="rounded-xl border px-3 py-2">
                        {hubStatusOptions.map((status) => <option key={status}>{status}</option>)}
                      </select>
                    </td>
                    <td>
                      <div className="flex flex-col gap-2">
                        {job && <StatusBadge>{job.status}</StatusBadge>}
                        {sendEnabled && (
                          <button
                            onClick={() => sendToAgent(item)}
                            disabled={sendingOrderId === orderId}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 py-2 font-semibold text-white disabled:bg-slate-300"
                          >
                            <Send size={15} /> {sendingOrderId === orderId ? "Sending" : "Send to Agent"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
