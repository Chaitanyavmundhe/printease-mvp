const ONLINE_WINDOW_MS = 45 * 1000;

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function isToday(value) {
  if (!value) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

export function getAgentLiveStatus(agent) {
  if (!agent) return 'offline';
  if (agent.revokedAt) return 'revoked';
  if (agent.paused) return 'paused';

  const lastSeenMs = new Date(agent.lastSeenAt || 0).getTime();
  if (!lastSeenMs || Number.isNaN(lastSeenMs)) return 'offline';

  return Date.now() - lastSeenMs <= ONLINE_WINDOW_MS ? 'online' : 'offline';
}

export function getPrinterCondition(printer) {
  const condition = normalize(printer?.condition);
  const fallbackStatus = normalize(printer?.status);
  const status = condition && condition !== 'unknown' ? condition : fallbackStatus;

  if (printer?.accepting === false) return 'paused';
  if (['idle', 'available', 'enabled', 'accepting'].includes(status)) return 'available';
  if (['printing', 'processing'].includes(status)) return 'printing';
  if (['paused', 'disabled', 'stopped', 'not accepting'].includes(status)) return 'paused';
  if (['offline', 'unable', 'disconnected'].includes(status)) return 'offline';
  return 'unknown';
}

export function decorateAgent(agent) {
  return {
    ...agent,
    liveStatus: getAgentLiveStatus(agent),
    status: getAgentLiveStatus(agent)
  };
}

export function decoratePrinter(printer) {
  return {
    ...printer,
    condition: getPrinterCondition(printer)
  };
}

export function buildHubAgentAnalytics(agents = [], printers = [], printJobs = []) {
  const liveAgents = agents.map(decorateAgent);
  const decoratedPrinters = printers.map(decoratePrinter);
  const agentStatusById = new Map(liveAgents.map((agent) => [agent.id, agent.liveStatus]));

  return {
    totalAgents: liveAgents.length,
    onlineAgents: liveAgents.filter((agent) => agent.liveStatus === 'online').length,
    offlineAgents: liveAgents.filter((agent) => agent.liveStatus === 'offline').length,
    pausedAgents: liveAgents.filter((agent) => agent.liveStatus === 'paused').length,
    revokedAgents: liveAgents.filter((agent) => agent.liveStatus === 'revoked').length,
    totalPrinters: decoratedPrinters.length,
    availablePrinters: decoratedPrinters.filter((printer) => (
      printer.condition === 'available' && agentStatusById.get(printer.agentId) === 'online'
    )).length,
    offlinePrinters: decoratedPrinters.filter((printer) => (
      printer.condition === 'offline' || ['offline', 'revoked'].includes(agentStatusById.get(printer.agentId))
    )).length,
    pausedPrinters: decoratedPrinters.filter((printer) => (
      printer.condition === 'paused' || agentStatusById.get(printer.agentId) === 'paused'
    )).length,
    queuedJobs: printJobs.filter((job) => ['queued', 'assigned', 'accepted', 'downloading'].includes(normalize(job.status))).length,
    printingJobs: printJobs.filter((job) => normalize(job.status) === 'printing').length,
    completedJobsToday: printJobs.filter((job) => normalize(job.status) === 'completed' && isToday(job.completedAt || job.createdAt)).length,
    failedJobsToday: printJobs.filter((job) => normalize(job.status) === 'failed' && isToday(job.failedAt || job.createdAt)).length
  };
}
