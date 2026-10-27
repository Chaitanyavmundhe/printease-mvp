import { beforeEach, expect, it, vi } from 'vitest';
import * as agents from '../agentRepository.js';
import * as jobs from '../printJobRepository.js';
import { findOrderByIdOrCode } from '../orderRepository.js';

vi.mock('../../../config/db.js', () => ({ pool: { query: vi.fn() }, query: vi.fn(), withTransaction: vi.fn() }));
vi.mock('../orderRepository.js', () => ({ findOrderByIdOrCode: vi.fn() }));
let client;
beforeEach(() => {
  vi.resetAllMocks();
  client = { query: vi.fn().mockResolvedValue({ rows: [] }) };
});

it('does not let heartbeat overwrite the hub pause flag', async () => {
  await agents.updateAgentHeartbeat('agent', { paused: false, status: 'revoked' }, client);
  const [sql, params] = client.query.mock.calls[0];
  expect(sql).not.toMatch(/paused\s*=/);
  expect(sql).toContain("case when paused then 'paused'");
  expect(params[1]).toBe('online');
});

it.each(['upsertAgentForPairing', 'upsertAgentForDesktopDevice'])('%s rejects cross-hub device takeover', async method => {
  await expect(agents[method]({ deviceId: 'device' }, 'hub', client)).rejects.toMatchObject({ statusCode: 409 });
  expect(client.query.mock.calls[0][0]).toContain('where agents.hub_id = excluded.hub_id');
  expect(client.query).toHaveBeenCalledTimes(1);
});

it('revokes existing tokens during re-pairing, before confirmation', async () => {
  client.query.mockResolvedValueOnce({ rows: [{ id: 'agent', hub_id: 'hub' }] });
  await agents.upsertAgentForPairing({ deviceId: 'device' }, 'hub', client);
  expect(client.query.mock.calls[1][0]).toContain('update agent_tokens set revoked_at');
});

it('confirms only current, unexpired pairings of a non-revoked agent under its lock', async () => {
  await agents.markPairingSessionConfirmed('session', client);
  expect(client.query.mock.calls[0][0]).toContain('for update of a');
  const sql = client.query.mock.calls[1][0];
  expect(sql).toContain("s.status = 'claimed'");
  expect(sql).toContain('a.revoked_at is null');
  expect(sql).toContain('a.paired_at <= s.claimed_at');
  expect(sql).toContain('s.approval_expires_at');
  expect(sql).toContain('> now()');
});

it('does not disclose unclaimed jobs as owned jobs', async () => {
  await jobs.findPrintJobForAgent('job', 'agent', 'hub', client);
  expect(client.query.mock.calls[0][0]).toContain('and agent_id = $3');
  expect(client.query.mock.calls[0][0]).not.toContain('agent_id is null');
});

function jobState({ paymentStatus = 'collected', orderStatus = 'queued_for_print', jobStatus = 'downloading', paused = false, agentId = 'agent' } = {}) {
  const row = { id: 'job', order_id: 'order', hub_id: 'hub', agent_id: agentId, status: jobStatus };
  findOrderByIdOrCode.mockResolvedValue({ id: 'order', centreId: 'hub', status: orderStatus, paymentStatus });
  client.query.mockImplementation(async sql => ({ rows: sql.includes('from agents') ? [{ id: 'agent', paused }] : [row] }));
}

it.each(['pending', 'requested', 'paid', 'failed'])('rejects printing with untrusted payment status %s', async paymentStatus => {
  jobState({ paymentStatus });
  await expect(jobs.updatePrintJobStatus('job', 'hub', { agentId: 'agent', status: 'printing' }, client)).rejects.toMatchObject({ statusCode: 409 });
  expect(client.query.mock.calls.some(([sql]) => sql.startsWith('update print_jobs'))).toBe(false);
});

it('rejects callbacks that attempt to claim an unowned job', async () => {
  jobState({ agentId: null });
  expect(await jobs.updatePrintJobStatus('job', 'hub', { agentId: 'agent', status: 'printing' }, client)).toBeNull();
});

it('rejects printing while the hub has paused the agent', async () => {
  jobState({ paused: true });
  await expect(jobs.updatePrintJobStatus('job', 'hub', { agentId: 'agent', status: 'printing' }, client)).rejects.toMatchObject({ statusCode: 409 });
});

it('rejects a stale failed-job retry after an order was requeued', async () => {
  jobState({ jobStatus: 'failed' });
  await expect(jobs.updatePrintJobStatus('job', 'hub', { agentId: 'agent', status: 'failed' }, client)).rejects.toMatchObject({ statusCode: 409 });
});

it('allows the claimed paid job to advance under the order lock', async () => {
  jobState();
  await jobs.updatePrintJobStatus('job', 'hub', { agentId: 'agent', status: 'printing' }, client);
  expect(findOrderByIdOrCode).toHaveBeenCalledWith('order', client, { forUpdate: true });
  expect(client.query.mock.calls.at(-1)[0]).toContain('and agent_id = $6');
});

it('limits conversion polling to unexpired, exclusively hub-scoped documents', async () => {
  await agents.getNextConversionJobForAgent('hub', client);
  const [sql, params] = client.query.mock.calls[0];
  expect(sql).toContain('d.hub_id = $1');
  expect(sql).toContain('d.expires_at > now()');
  expect(sql).toContain('o.hub_id <> $1');
  expect(params).toEqual(['hub']);
});
